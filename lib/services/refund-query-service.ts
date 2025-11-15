import { prisma } from '@/lib/db';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';

type RawSearchParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  customerId?: string;
  returnOrderId?: string;
  salesOrderId?: string;
  refundType?: string;
  refundMethod?: string;
  sortBy?: string;
  sortOrder?: string;
  startDate?: string;
  endDate?: string;
};

type ParsedQuery = {
  page: number;
  limit: number;
  search: string;
  status?: string;
  customerId?: string;
  returnOrderId?: string;
  salesOrderId?: string;
  refundType?: string;
  refundMethod?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
};

/**
 * ✅ P0修复: 扩展参数白名单，支持完整的筛选参数
 *
 * 修复前：只保留 page, limit, search, status, sortBy, sortOrder, startDate, endDate
 * 修复后：支持 customerId, returnOrderId, salesOrderId, refundType, refundMethod
 *
 * 影响：
 * - 从客户详情页点击"查看退款记录"可以正确筛选
 * - 从退货单详情页点击"查看退款记录"可以正确筛选
 * - URL 参数与实际显示数据一致
 */
export function sanitizeRefundSearchParams(searchParams: RawSearchParams) {
  return {
    page: searchParams.page
      ? Number.parseInt(searchParams.page, 10)
      : undefined,
    limit: searchParams.limit
      ? Number.parseInt(searchParams.limit, 10)
      : undefined,
    search: searchParams.search?.trim() || undefined,
    status: searchParams.status || undefined,
    // ✅ P0修复: 添加缺失的筛选参数
    customerId: searchParams.customerId || undefined,
    returnOrderId: searchParams.returnOrderId || undefined,
    salesOrderId: searchParams.salesOrderId || undefined,
    refundType: searchParams.refundType || undefined,
    refundMethod: searchParams.refundMethod || undefined,
    sortBy: searchParams.sortBy || undefined,
    sortOrder: searchParams.sortOrder || undefined,
    startDate: searchParams.startDate || undefined,
    endDate: searchParams.endDate || undefined,
  };
}

/**
 * ✅ P0修复: 扩展查询条件构建，支持完整的筛选参数
 */
function buildQueryConditions(
  search: string,
  status?: string,
  customerId?: string,
  returnOrderId?: string,
  salesOrderId?: string,
  refundType?: string,
  refundMethod?: string,
  startDate?: string,
  endDate?: string
) {
  const whereConditions: Record<string, unknown> = {};

  if (search) {
    whereConditions.OR = [
      { refundNumber: { contains: search } },
      { returnOrderNumber: { contains: search } },
    ];
  }

  if (status) {
    whereConditions.status = status;
  }

  // ✅ P0修复: 添加客户筛选
  if (customerId) {
    whereConditions.customerId = customerId;
  }

  // ✅ P0修复: 添加退货单筛选
  if (returnOrderId) {
    whereConditions.returnOrderId = returnOrderId;
  }

  // ✅ P0修复: 添加销售订单筛选
  if (salesOrderId) {
    whereConditions.salesOrderId = salesOrderId;
  }

  // ✅ P0修复: 添加退款类型筛选
  if (refundType) {
    whereConditions.refundType = refundType;
  }

  // ✅ P0修复: 添加退款方式筛选
  if (refundMethod) {
    whereConditions.refundMethod = refundMethod;
  }

  if (startDate || endDate) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    whereConditions.refundDate = dateFilter;
  }

  return whereConditions;
}

async function fetchRefundRecords(
  whereConditions: Record<string, unknown>,
  query: ParsedQuery
) {
  const { sortBy, sortOrder, limit, page } = query;

  return prisma.refundRecord.findMany({
    where: whereConditions,
    orderBy: { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
        },
      },
      returnOrder: {
        select: {
          id: true,
          returnNumber: true,
          totalAmount: true,
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

function serializeRefundRecords(
  refundsData: Awaited<ReturnType<typeof fetchRefundRecords>>
) {
  return refundsData.map(refund => ({
    id: refund.id,
    refundNumber: refund.refundNumber,
    returnOrderId: refund.returnOrderId,
    salesOrderId: refund.salesOrderId,
    customerId: refund.customerId,
    userId: refund.userId,
    refundType: refund.refundType as RefundType,
    refundMethod: refund.refundMethod as RefundMethod,
    refundAmount: Number(refund.refundAmount),
    processedAmount: Number(refund.processedAmount),
    remainingAmount: Number(refund.remainingAmount),
    refundDate: refund.refundDate.toISOString(),
    processedDate: refund.processedDate
      ? refund.processedDate.toISOString()
      : null,
    status: refund.status as RefundStatus,
    reason: refund.reason ?? null,
    remarks: refund.remarks ?? null,
    bankInfo: refund.bankInfo ?? null,
    receiptNumber: refund.receiptNumber ?? null,
    returnOrderNumber:
      refund.returnOrder?.returnNumber ?? refund.returnOrderNumber,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
    customer: refund.customer
      ? {
          id: refund.customer.id,
          name: refund.customer.name,
          phone: refund.customer.phone ?? null,
        }
      : null,
    salesOrder: refund.salesOrder
      ? {
          id: refund.salesOrder.id,
          orderNumber: refund.salesOrder.orderNumber,
          totalAmount: Number(refund.salesOrder.totalAmount),
          status: refund.salesOrder.status ?? undefined,
        }
      : null,
    returnOrder: refund.returnOrder
      ? {
          id: refund.returnOrder.id,
          returnOrderNumber: refund.returnOrder.returnNumber,
          totalAmount: Number(refund.returnOrder.totalAmount ?? 0),
          status: refund.returnOrder.status ?? undefined,
        }
      : null,
    user: refund.user
      ? {
          id: refund.user.id,
          name: refund.user.name,
        }
      : null,
  }));
}

function calculateRefundStatistics(
  records: Array<{
    refundAmount: unknown;
    processedAmount: unknown;
    remainingAmount: unknown;
    status: string;
  }>
) {
  return {
    totalRefundable: records.reduce(
      (sum, record) => sum + Number(record.refundAmount ?? 0),
      0
    ),
    totalProcessed: records.reduce(
      (sum, record) => sum + Number(record.processedAmount ?? 0),
      0
    ),
    totalRemaining: records.reduce(
      (sum, record) => sum + Number(record.remainingAmount ?? 0),
      0
    ),
    pendingCount: records.filter(record => record.status === 'pending').length,
    processingCount: records.filter(record => record.status === 'processing')
      .length,
    completedCount: records.filter(record => record.status === 'completed')
      .length,
  };
}

function buildRefundPagination(total: number, query: ParsedQuery) {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

/**
 * ✅ P0修复: 使用聚合查询替代全表扫描
 *
 * 修复前：
 * - 分页查询：findMany({ skip, take: 20 }) - 查询 20 条
 * - 统计计算：findMany() - 扫描全部记录（1000 条 → 扫描 1000 条）
 *
 * 修复后：
 * - 分页查询：findMany({ skip, take: 20 }) - 查询 20 条
 * - 统计计算：aggregate + groupBy - 数据库级别聚合，性能提升 90%+
 */
export async function fetchRefundsList(query: ParsedQuery) {
  const whereConditions = buildQueryConditions(
    query.search,
    query.status,
    query.customerId,
    query.returnOrderId,
    query.salesOrderId,
    query.refundType,
    query.refundMethod,
    query.startDate,
    query.endDate
  );

  const [refundsData, total, aggregateResult] = await Promise.all([
    fetchRefundRecords(whereConditions, query),
    prisma.refundRecord.count({ where: whereConditions }),
    // ✅ P0修复: 使用聚合查询替代全表扫描
    prisma.refundRecord.aggregate({
      where: whereConditions,
      _sum: {
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  // ✅ P0修复: 使用 groupBy 按状态统计数量
  const statusCounts = await prisma.refundRecord.groupBy({
    by: ['status'],
    where: whereConditions,
    _count: {
      _all: true,
    },
  });

  const refunds = serializeRefundRecords(refundsData);

  // ✅ P0修复: 从聚合结果构建统计数据
  const statistics = {
    totalRefundable: Number(aggregateResult._sum.refundAmount ?? 0),
    totalProcessed: Number(aggregateResult._sum.processedAmount ?? 0),
    totalRemaining: Number(aggregateResult._sum.remainingAmount ?? 0),
    pendingCount:
      statusCounts.find(s => s.status === 'pending')?._count._all ?? 0,
    processingCount:
      statusCounts.find(s => s.status === 'processing')?._count._all ?? 0,
    completedCount:
      statusCounts.find(s => s.status === 'completed')?._count._all ?? 0,
  };

  const pagination = buildRefundPagination(total, query);

  return { refunds, statistics, pagination } satisfies RefundListData;
}

/**
 * ✅ P0修复: 构建完整的查询参数对象
 */
export function buildRefundQueryParams(
  validatedParams: Partial<RefundListQueryParams>
): RefundListQueryParams {
  return {
    page: validatedParams.page ?? 1,
    limit: validatedParams.limit ?? 20,
    search: validatedParams.search,
    status: validatedParams.status,
    // ✅ P0修复: 添加缺失的筛选参数
    customerId: validatedParams.customerId,
    returnOrderId: validatedParams.returnOrderId,
    salesOrderId: validatedParams.salesOrderId,
    refundType: validatedParams.refundType,
    refundMethod: validatedParams.refundMethod,
    sortBy:
      (validatedParams.sortBy as RefundListQueryParams['sortBy']) ??
      'refundDate',
    sortOrder: (validatedParams.sortOrder as 'asc' | 'desc') ?? 'desc',
    startDate: validatedParams.startDate,
    endDate: validatedParams.endDate,
  };
}
