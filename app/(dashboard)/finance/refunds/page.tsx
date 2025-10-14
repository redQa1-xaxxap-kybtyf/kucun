import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paginationConfig } from '@/lib/env';
import type {
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
 * 服务器组件传递给客户端的退款记录类型
 * Date 被序列化为 string，包含关联数据
 */
type SerializedRefundRecord = {
  id: string;
  refundNumber: string;
  returnOrderId: string | null;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  refundDate: string;
  processedDate: string | null;
  status: RefundStatus;
  reason: string;
  remarks: string | null;
  bankInfo: string | null;
  receiptNumber: string | null;
  returnOrderNumber: string | null;
  createdAt: string;
  updatedAt: string;
  // 关联数据
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  } | null;
  returnOrder: {
    id: string;
    returnOrderNumber: string;
    totalAmount: number;
    status?: string;
  } | null;
  user: {
    id: string;
    name: string;
  } | null;
};

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
  const [refundsData, total] = await Promise.all([
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
  ]);

  // 计算统计数据（使用相同的筛选条件）
  const allRefunds = await prisma.refundRecord.findMany({
    where: whereConditions,
    select: {
      refundAmount: true,
      processedAmount: true,
      remainingAmount: true,
      status: true,
    },
  });

  const totalRefundable = allRefunds.reduce(
    (sum, r) => sum + r.refundAmount,
    0
  );
  const totalProcessed = allRefunds.reduce(
    (sum, r) => sum + r.processedAmount,
    0
  );
  const totalRemaining = allRefunds.reduce(
    (sum, r) => sum + r.remainingAmount,
    0
  );

  const pendingCount = allRefunds.filter(r => r.status === 'pending').length;
  const processingCount = allRefunds.filter(
    r => r.status === 'processing'
  ).length;
  const completedCount = allRefunds.filter(
    r => r.status === 'completed'
  ).length;

  // 序列化退款记录，包含关联数据
  const refunds = refundsData.map(refund => ({
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
    reason: refund.reason,
    remarks: refund.remarks,
    bankInfo: refund.bankInfo,
    receiptNumber: refund.receiptNumber,
    returnOrderNumber:
      refund.returnOrder?.returnNumber ?? refund.returnOrderNumber,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
    // 关联数据
    customer: refund.customer
      ? {
          id: refund.customer.id,
          name: refund.customer.name,
          phone: refund.customer.phone,
        }
      : null,
    salesOrder: refund.salesOrder
      ? {
          id: refund.salesOrder.id,
          orderNumber: refund.salesOrder.orderNumber,
          totalAmount: Number(refund.salesOrder.totalAmount),
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

  return {
    refunds,
    statistics: {
      totalRefundable,
      totalProcessed,
      totalRemaining,
      pendingCount,
      processingCount,
      completedCount,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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
  const initialData = await getRefundsData(params);

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

  const queryParams = {
    page: validatedParams.page ?? 1,
    limit: validatedParams.limit ?? paginationConfig.defaultPageSize,
    search: validatedParams.search,
    status: validatedParams.status,
    sortBy: validatedParams.sortBy ?? 'refundDate',
    sortOrder: (validatedParams.sortOrder as 'asc' | 'desc') ?? 'desc',
  };

  return (
    <RefundsPageClient initialData={initialData} initialParams={queryParams} />
  );
}
