// 应付款统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
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

/**
 * 构建筛选条件（与列表查询保持一致）
 */
const buildWhereConditions = (
  query: PayableRecordQuery
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
    const queryParams: PayableRecordQuery = {
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

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    logger.error('finance-payables', '获取应付款统计失败', error);
    return NextResponse.json(
      { success: false, error: '获取应付款统计失败' },
      { status: 500 }
    );
  }
});
