import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { financeKeys } from '@/lib/queryKeys';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';
import { refundQuerySchema } from '@/lib/validations/refund';

import { RefundsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应退货款管理 - 财务管理',
  description: '管理退货订单产生的应退账款，跟踪退款处理状态',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * 服务器端获取退款数据
 */
async function getRefundsData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const sanitizedParams = {
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

  const validationResult = refundQuerySchema.safeParse(sanitizedParams);
  const parsedParams = validationResult.success ? validationResult.data : {};

  if (!validationResult.success && process.env.NODE_ENV !== 'production') {
    logger.warn(
      'finance-refunds',
      '[RefundsPage] Query params validation failed',
      undefined,
      {
        issues: validationResult.error.issues,
        params: sanitizedParams,
      }
    );
  }

  const {
    page = 1,
    limit = paginationConfig.defaultPageSize,
    search = '',
    status,
    sortBy = 'refundDate',
    sortOrder = 'desc',
  } = parsedParams;

  const skip = (page - 1) * limit;

  // 构建查询条件
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

  // 查询退款记录 - 包含关联数据
  const [refundsData, total, statisticsSource] = await Promise.all([
    prisma.refundRecord.findMany({
      where: whereConditions,
      orderBy: {
        [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
      },
      skip,
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
    }),
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

  // 序列化退款记录，包含关联数据
  const refunds: RefundListData['refunds'] = refundsData.map(refund => ({
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

  const statistics: RefundListData['statistics'] = {
    totalRefundable: statisticsSource.reduce(
      (sum, record) => sum + Number(record.refundAmount ?? 0),
      0
    ),
    totalProcessed: statisticsSource.reduce(
      (sum, record) => sum + Number(record.processedAmount ?? 0),
      0
    ),
    totalRemaining: statisticsSource.reduce(
      (sum, record) => sum + Number(record.remainingAmount ?? 0),
      0
    ),
    pendingCount: statisticsSource.filter(record => record.status === 'pending')
      .length,
    processingCount: statisticsSource.filter(
      record => record.status === 'processing'
    ).length,
    completedCount: statisticsSource.filter(
      record => record.status === 'completed'
    ).length,
  };

  const pagination: RefundListData['pagination'] = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };

  return { refunds, statistics, pagination };
}

/**
 * 应退货款管理页面 - 服务器组件
 * 使用服务器端数据获取，优化首屏加载和SEO
 */
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const refundsData = await getRefundsData(params);

  const sanitizedParams = {
    page: params.page ? Number.parseInt(params.page, 10) : undefined,
    limit: params.limit ? Number.parseInt(params.limit, 10) : undefined,
    search: params.search?.trim() || undefined,
    status: params.status || undefined,
    sortBy: params.sortBy || undefined,
    sortOrder: params.sortOrder || undefined,
  };

  const validationResult = refundQuerySchema.safeParse(sanitizedParams);
  const validatedParams = validationResult.success ? validationResult.data : {};

  if (!validationResult.success && process.env.NODE_ENV !== 'production') {
    logger.warn(
      'finance-refunds',
      '[RefundsPage] Query params validation failed (initialParams)',
      undefined,
      {
        issues: validationResult.error.issues,
        params: sanitizedParams,
      }
    );
  }

  const queryParams: RefundListQueryParams = {
    page: validatedParams.page ?? 1,
    limit: validatedParams.limit ?? paginationConfig.defaultPageSize,
    search: validatedParams.search,
    status: validatedParams.status,
    sortBy:
      (validatedParams.sortBy as RefundListQueryParams['sortBy']) ??
      'refundDate',
    sortOrder: (validatedParams.sortOrder as 'asc' | 'desc') ?? 'desc',
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  queryClient.setQueryData(financeKeys.refundsList(queryParams), refundsData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RefundsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
