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
  sortBy?: string;
  sortOrder?: string;
};

type ParsedQuery = {
  page: number;
  limit: number;
  search: string;
  status?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

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
    sortBy: searchParams.sortBy || undefined,
    sortOrder: searchParams.sortOrder || undefined,
  };
}

function buildQueryConditions(search: string, status?: string) {
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

export async function fetchRefundsList(query: ParsedQuery) {
  const whereConditions = buildQueryConditions(query.search, query.status);

  const [refundsData, total, statisticsSource] = await Promise.all([
    fetchRefundRecords(whereConditions, query),
    prisma.refundRecord.count({ where: whereConditions }),
    prisma.refundRecord.findMany({
      where: whereConditions,
      select: {
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        status: true,
      },
    }),
  ]);

  const refunds = serializeRefundRecords(refundsData);
  const statistics = calculateRefundStatistics(statisticsSource);
  const pagination = buildRefundPagination(total, query);

  return { refunds, statistics, pagination } satisfies RefundListData;
}

export function buildRefundQueryParams(
  validatedParams: Partial<RefundListQueryParams>
): RefundListQueryParams {
  return {
    page: validatedParams.page ?? 1,
    limit: validatedParams.limit ?? 20,
    search: validatedParams.search,
    status: validatedParams.status,
    sortBy:
      (validatedParams.sortBy as RefundListQueryParams['sortBy']) ??
      'refundDate',
    sortOrder: (validatedParams.sortOrder as 'asc' | 'desc') ?? 'desc',
  };
}
