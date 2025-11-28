// 应付款统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type {
  PayableRecordQuery,
  PayableStatistics,
} from '@/lib/types/payable';

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    endOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
};

// 统计接口只关心筛选条件的子集，不依赖分页/排序字段
type PayableStatsQuery = Pick<
  PayableRecordQuery,
  'search' | 'supplierId' | 'status' | 'sourceType' | 'startDate' | 'endDate'
>;

/**
 * 构建筛选条件（与列表查询保持一致）
 */
const buildWhereConditions = (
  query: PayableStatsQuery
): Prisma.PayableRecordWhereInput => {
  const where: Prisma.PayableRecordWhereInput = {};

  // 搜索条件
  if (query.search) {
    where.OR = [
      { payableNumber: { contains: query.search } },
      { supplier: { name: { contains: query.search } } },
      { sourceNumber: { contains: query.search } },
    ];
  }

  // 供应商筛选
  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  // 状态筛选
  if (query.status) {
    where.status = query.status;
  }

  // 来源类型筛选
  if (query.sourceType) {
    where.sourceType = query.sourceType;
  }

  // 日期范围筛选
  if (query.startDate || query.endDate) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) {
      dateFilter.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      dateFilter.lte = new Date(query.endDate);
    }
    where.createdAt = dateFilter;
  }

  return where;
};

const fetchPayablesAggregates = async (
  where: Prisma.PayableRecordWhereInput,
  startOfMonth: Date,
  endOfMonth: Date
) => {
  // 基础筛选条件：排除已取消的记录
  const baseWhere: Prisma.PayableRecordWhereInput = {
    ...where,
    status: where.status ? where.status : { not: 'cancelled' },
  };

  const [
    totalPayablesResult,
    totalPaidAmountResult,
    totalRemainingAmountResult,
    statusCounts,
    thisMonthPayablesResult,
    thisMonthPaymentsResult,
  ] = await Promise.all([
    prisma.payableRecord.aggregate({
      _sum: {
        payableAmount: true,
      },
      where: baseWhere,
    }),
    prisma.payableRecord.aggregate({
      _sum: {
        paidAmount: true,
      },
      where: baseWhere,
    }),
    prisma.payableRecord.aggregate({
      _sum: {
        remainingAmount: true,
      },
      where: baseWhere,
    }),
    prisma.payableRecord.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      where: baseWhere,
    }),
    prisma.payableRecord.aggregate({
      _sum: {
        payableAmount: true,
      },
      where: {
        ...baseWhere,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),
    prisma.paymentOutRecord.aggregate({
      _sum: {
        paymentAmount: true,
      },
      where: {
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: 'confirmed',
      },
    }),
  ]);

  return {
    totalPayablesResult,
    totalPaidAmountResult,
    totalRemainingAmountResult,
    statusCounts,
    thisMonthPayablesResult,
    thisMonthPaymentsResult,
  };
};

const createStatusCountMap = (
  statusCounts: Array<{ status: string; _count: { id: number } }>
) =>
  statusCounts.reduce(
    (acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

const buildStatistics = ({
  totalPayablesResult,
  totalPaidAmountResult,
  totalRemainingAmountResult,
  statusCounts,
  thisMonthPayablesResult,
  thisMonthPaymentsResult,
}: Awaited<ReturnType<typeof fetchPayablesAggregates>>): PayableStatistics => {
  const statusCountMap = createStatusCountMap(statusCounts);
  return {
    totalPayables: totalPayablesResult._sum.payableAmount || 0,
    totalPaidAmount: totalPaidAmountResult._sum.paidAmount || 0,
    totalRemainingAmount: totalRemainingAmountResult._sum.remainingAmount || 0,
    pendingCount: statusCountMap.pending || 0,
    partialCount: statusCountMap.partial || 0,
    paidCount: statusCountMap.paid || 0,
    thisMonthPayables: thisMonthPayablesResult._sum.payableAmount || 0,
    thisMonthPayments: thisMonthPaymentsResult._sum.paymentAmount || 0,
    // 采购相关统计在下方构建时补充
  };
};

/**
 * GET /api/finance/payables/statistics - 获取应付款统计数据
 * 支持与列表查询相同的筛选参数
 */
export const GET = withAuth(async (request: Request) => {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams: PayableStatsQuery = {
      search: searchParams.get('search') || undefined,
      supplierId: searchParams.get('supplierId') || undefined,
      status:
        (searchParams.get('status') as PayableRecordQuery['status']) ||
        undefined,
      sourceType:
        (searchParams.get('sourceType') as PayableRecordQuery['sourceType']) ||
        undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 构建筛选条件
    const where = buildWhereConditions(queryParams);

    const { startOfMonth, endOfMonth } = getCurrentMonthRange();
    const aggregates = await fetchPayablesAggregates(
      where,
      startOfMonth,
      endOfMonth
    );
    const statistics = buildStatistics(aggregates);

    // 扩展：采购相关货款+运费+总成本
    // 默认：totalPayables 等于「应付款合计」，具体含义取决于是否开启费用→应付集成
    let purchaseGoodsAmount = statistics.totalPayables;

    // 2) 运费：统计与供应商和筛选条件匹配的、关联采购订单的费用记录
    const freightWhere: Prisma.ExpenseRecordWhereInput = {
      relatedType: 'purchase_order',
      // 仅统计已经挂到应付款上的费用，避免「有费用没应付」导致统计数据虚高
      payableId: { not: null },
      // 仅针对本次应付筛选范围内的供应商
      ...(queryParams.supplierId ? { supplierId: queryParams.supplierId } : {}),
    };

    if (queryParams.startDate || queryParams.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (queryParams.startDate) {
        dateFilter.gte = new Date(queryParams.startDate);
      }
      if (queryParams.endDate) {
        const end = new Date(queryParams.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      freightWhere.expenseDate = dateFilter;
    }

    const freightAggregate = await prisma.expenseRecord.aggregate({
      _sum: { expenseAmount: true },
      where: freightWhere,
    });

    const rawFreightAmount = freightAggregate._sum.expenseAmount || 0;

    let purchaseFreightAmount = rawFreightAmount;
    let purchaseTotalCost: number;

    if (env.EXPENSE_TO_PAYABLE_ENABLED) {
      // ✅ 阶段3模式：费用已经通过 createOrMergePayableFromExpense 合并进应付款
      // - payableRecord.payableAmount ≈ 货款 + 已挂账费用
      // - expenseRecord 再算一遍会导致运费等费用被「重复统计」
      //
      // 约定：
      // - totalPayables 视为「货款 + 运费等费用」的合计成本
      // - 货款 = totalPayables - 运费
      // - 总成本 = totalPayables（避免再次把运费加一遍）
      purchaseGoodsAmount = Math.max(
        0,
        statistics.totalPayables - rawFreightAmount
      );
      purchaseFreightAmount = rawFreightAmount;
      purchaseTotalCost = statistics.totalPayables;
    } else {
      // 旧模式：应付只包含货款，费用单独统计
      // - 货款 = totalPayables
      // - 运费 = 费用记录之和
      // - 总成本 = 货款 + 运费
      purchaseGoodsAmount = statistics.totalPayables;
      purchaseFreightAmount = rawFreightAmount;
      purchaseTotalCost = purchaseGoodsAmount + purchaseFreightAmount;
    }

    const extendedStatistics: PayableStatistics = {
      ...statistics,
      purchaseGoodsAmount,
      purchaseFreightAmount,
      purchaseTotalCost,
    };

    return NextResponse.json({
      success: true,
      data: extendedStatistics,
    });
  } catch (error) {
    logger.error('finance-payables', '获取应付款统计失败', error);
    return NextResponse.json(
      { success: false, error: '获取应付款统计失败' },
      { status: 500 }
    );
  }
});
