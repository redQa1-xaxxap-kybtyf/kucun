import type { Prisma } from '@prisma/client';
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import { buildExcludeAutoReceivableConfirmationWhere } from '@/lib/services/receivables-helpers';
import { getSystemMode } from '@/lib/services/system-mode-service';
import type {
  PaymentMethod,
  PaymentRecordQuery,
  PaymentStatus,
} from '@/lib/types/payment';
import { parseLocalDateString } from '@/lib/utils/datetime';

const ALLOWED_PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'wechat_transfer',
  'abc_qr',
  'icbc_qr',
  'ccb_qr',
  'cib_qr',
];

const ALLOWED_PAYMENT_SORT_FIELDS = [
  'createdAt',
  'paymentAmount',
  'paymentDate',
] as const;
type PaymentSortField = (typeof ALLOWED_PAYMENT_SORT_FIELDS)[number];

import { PaymentsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '收款记录 - 财务管理',
  description: '管理销售订单的收款记录，跟踪收款状态和金额',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

function isPaymentStatus(value: string): value is PaymentStatus {
  return (
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'cancelled' ||
    value === 'applied'
  );
}

function parsePaymentStatus(value?: string): PaymentStatus | undefined {
  if (!value) {
    return undefined;
  }

  return isPaymentStatus(value) ? value : undefined;
}

/**
 * 服务器端获取收款数据
 */
async function getPaymentsData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: string;
  startDate?: string;
  endDate?: string;
  includeTest?: string;
  includeVoided?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = parsePaymentStatus(searchParams.status);
  const paymentMethodParam = searchParams.paymentMethod;
  const paymentMethod =
    paymentMethodParam &&
    ALLOWED_PAYMENT_METHODS.includes(paymentMethodParam as PaymentMethod)
      ? (paymentMethodParam as PaymentMethod)
      : undefined;
  const sortByParam = searchParams.sortBy || 'createdAt';
  const sortBy: PaymentSortField = ALLOWED_PAYMENT_SORT_FIELDS.includes(
    sortByParam as PaymentSortField
  )
    ? (sortByParam as PaymentSortField)
    : 'createdAt';
  const sortOrder =
    searchParams.sortOrder === 'asc' || searchParams.sortOrder === 'desc'
      ? (searchParams.sortOrder as 'asc' | 'desc')
      : 'desc';
  const startDateParam = searchParams.startDate;
  const endDateParam = searchParams.endDate;
  const includeTest = searchParams.includeTest === 'true' ? true : undefined;
  const includeVoided =
    searchParams.includeVoided === 'true' ? true : undefined;

  // 构建查询条件
  const whereConditions: Prisma.PaymentRecordWhereInput = {};

  if (!includeVoided) {
    whereConditions.voidedAt = null;
  }

  const systemMode = await getSystemMode();
  if (systemMode === 'production' && !includeTest) {
    whereConditions.dataTag = 'prod';
  }

  if (search) {
    whereConditions.OR = [
      { paymentNumber: { contains: search } },
      { receiptNumber: { contains: search } },
      { remarks: { contains: search } },
      { customer: { name: { contains: search } } },
      { salesOrder: { orderNumber: { contains: search } } },
    ];
  }

  if (status) {
    whereConditions.status = status;
  }

  if (paymentMethod) {
    whereConditions.paymentMethod = paymentMethod;
  }

  if (startDateParam || endDateParam) {
    const paymentDateFilter: { gte?: Date; lte?: Date } = {};
    if (startDateParam) {
      paymentDateFilter.gte =
        parseLocalDateString(startDateParam) ?? new Date(startDateParam);
    }
    if (endDateParam) {
      const endDate =
        parseLocalDateString(endDateParam) ?? new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      paymentDateFilter.lte = endDate;
    }
    whereConditions.paymentDate = paymentDateFilter;
  }

  Object.assign(
    whereConditions,
    buildExcludeAutoReceivableConfirmationWhere()
  );

  // 查询收款记录
  const [payments, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: whereConditions,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
          },
        },
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    }),
    prisma.paymentRecord.count({ where: whereConditions }),
  ]);

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const currentMonthWhere: Prisma.PaymentRecordWhereInput = {
    ...whereConditions,
    paymentDate: {
      gte: startOfCurrentMonth,
      lt: startOfNextMonth,
    },
  };

  const previousMonthWhere: Prisma.PaymentRecordWhereInput = {
    ...whereConditions,
    paymentDate: {
      gte: startOfPreviousMonth,
      lt: startOfCurrentMonth,
    },
  };

  // 统计数据：使用 groupBy + sum，避免 findMany 全量扫描导致不必要的数据传输与内存占用
  const [overallSums, currentMonthSums, previousMonthSums] = await Promise.all([
    prisma.paymentRecord.groupBy({
      by: ['status'],
      where: whereConditions,
      _sum: { paymentAmount: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['status'],
      where: currentMonthWhere,
      _sum: { paymentAmount: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['status'],
      where: previousMonthWhere,
      _sum: { paymentAmount: true },
    }),
  ]);

  const CONFIRMED_STATUSES = new Set(['confirmed', 'applied'] as const);

  const sumPaymentAmount = (
    rows: Array<{
      status: string;
      _sum: { paymentAmount: Prisma.Decimal | null };
    }>,
    allowedStatuses?: Set<string>
  ) =>
    rows.reduce((acc, row) => {
      if (allowedStatuses && !allowedStatuses.has(row.status)) {
        return acc;
      }
      return acc + Number(row._sum.paymentAmount ?? 0);
    }, 0);

  const totalAmount = sumPaymentAmount(overallSums);
  const confirmedAmount = sumPaymentAmount(overallSums, CONFIRMED_STATUSES);
  const pendingAmount = sumPaymentAmount(overallSums, new Set(['pending']));
  const collectionRate =
    totalAmount > 0 ? (confirmedAmount / totalAmount) * 100 : 0;

  const calculateRate = (confirmed: number, total: number) =>
    total === 0 ? null : (confirmed / total) * 100;

  const formatRate = (rate: number | null) =>
    rate === null ? null : Number(rate.toFixed(1));

  const currentMonthTotal = sumPaymentAmount(currentMonthSums);
  const previousMonthTotal = sumPaymentAmount(previousMonthSums);
  const currentMonthConfirmed = sumPaymentAmount(
    currentMonthSums,
    CONFIRMED_STATUSES
  );
  const previousMonthConfirmed = sumPaymentAmount(
    previousMonthSums,
    CONFIRMED_STATUSES
  );

  const currentMonthCollectionRate = formatRate(
    calculateRate(currentMonthConfirmed, currentMonthTotal)
  );
  const previousMonthCollectionRate = formatRate(
    calculateRate(previousMonthConfirmed, previousMonthTotal)
  );
  const collectionRateChange =
    currentMonthCollectionRate !== null && previousMonthCollectionRate !== null
      ? Number(
          (currentMonthCollectionRate - previousMonthCollectionRate).toFixed(1)
        )
      : null;

  const statistics = {
    totalAmount,
    confirmedAmount,
    pendingAmount,
    recordCount: total,
    collectionRate: Number(collectionRate.toFixed(1)),
    currentMonthCollectionRate,
    previousMonthCollectionRate,
    collectionRateChange,
  };

  const paymentsWithRelations = payments.filter(
    (
      payment
    ): payment is typeof payment & {
      customer: NonNullable<typeof payment.customer>;
      salesOrder: NonNullable<typeof payment.salesOrder>;
      user: NonNullable<typeof payment.user>;
    } =>
      Boolean(payment.customer) &&
      Boolean(payment.salesOrder) &&
      Boolean(payment.user)
  );

  // 计算每个订单的已收款总额和待确认金额（批量聚合，避免 N+1 查询）
  const salesOrderIds = Array.from(
    new Set(
      paymentsWithRelations
        .map(payment => payment.salesOrderId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const paymentTotalsByOrder: Record<
    string,
    { confirmedAmount: number; pendingAmount: number }
  > = {};

  if (salesOrderIds.length > 0) {
    const paymentAggregations = await prisma.paymentRecord.groupBy({
      by: ['salesOrderId', 'status'],
      where: {
        salesOrderId: { in: salesOrderIds },
        status: { in: ['confirmed', 'pending'] as PaymentStatus[] },
      },
      _sum: {
        paymentAmount: true,
      },
    });

    for (const agg of paymentAggregations) {
      if (!agg.salesOrderId) continue;
      const existing = paymentTotalsByOrder[agg.salesOrderId] ?? {
        confirmedAmount: 0,
        pendingAmount: 0,
      };
      const amount = Number(agg._sum.paymentAmount ?? 0);

      if (agg.status === 'confirmed') {
        existing.confirmedAmount += amount;
      } else if (agg.status === 'pending') {
        existing.pendingAmount += amount;
      }

      paymentTotalsByOrder[agg.salesOrderId] = existing;
    }
  }

  const normalizedPayments = paymentsWithRelations.map(payment => {
    const salesOrderId = payment.salesOrderId as string;
    const totals = paymentTotalsByOrder[salesOrderId] ?? {
      confirmedAmount: 0,
      pendingAmount: 0,
    };

    const orderPaidAmount = totals.confirmedAmount;
    const orderPendingAmount = totals.pendingAmount;
    const orderTotalAmount = Number(payment.salesOrder.totalAmount);
    // ✅ 新增: 获取订单抹零金额
    const orderRoundingAdjustment = Number(
      payment.salesOrder.roundingAdjustment || 0
    );
    // ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
    const actualTotalAmount = orderTotalAmount + orderRoundingAdjustment;
    const orderRemainingAmount =
      actualTotalAmount - orderPaidAmount - orderPendingAmount;

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(
        (payment as unknown as { actualPaymentAmount?: number })
          .actualPaymentAmount ?? payment.paymentAmount
      ),
      roundingAmount: Number(
        (payment as unknown as { roundingAmount?: number }).roundingAmount ?? 0
      ),
      paymentMethod: payment.paymentMethod ?? 'other',
      paymentDate: payment.paymentDate.toISOString(),
      status: (payment.status ?? 'pending') as PaymentStatus,
      remarks: payment.remarks ?? undefined,
      receiptNumber: payment.receiptNumber ?? undefined,
      customer: {
        id: payment.customer.id,
        name: payment.customer.name,
        phone: payment.customer.phone ?? undefined,
      },
      salesOrder: {
        id: payment.salesOrder.id,
        orderNumber: payment.salesOrder.orderNumber,
        totalAmount: orderTotalAmount,
        roundingAdjustment: orderRoundingAdjustment, // ✅ 新增: 订单抹零金额
        paidAmount: orderPaidAmount,
        pendingAmount: orderPendingAmount,
        remainingAmount: orderRemainingAmount,
      },
      user: {
        id: payment.user.id,
        name: payment.user.name,
      },
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  });

  return {
    payments: normalizedPayments,
    statistics,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 收款记录页面 - 服务器组件
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: string;
    startDate?: string;
    endDate?: string;
    includeTest?: string;
    includeVoided?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPaymentsData(params);

  const paymentMethod =
    typeof params.paymentMethod === 'string' &&
    ALLOWED_PAYMENT_METHODS.includes(params.paymentMethod as PaymentMethod)
      ? (params.paymentMethod as PaymentMethod)
      : undefined;

  const sortByParam = params.sortBy || 'createdAt';
  const sortBy: PaymentSortField = ALLOWED_PAYMENT_SORT_FIELDS.includes(
    sortByParam as PaymentSortField
  )
    ? (sortByParam as PaymentSortField)
    : 'createdAt';

  const safeSortOrder =
    params.sortOrder === 'asc' || params.sortOrder === 'desc'
      ? (params.sortOrder as 'asc' | 'desc')
      : 'desc';

  const queryParams: PaymentRecordQuery = {
    page: parseInt(params.page || '1', 10),
    pageSize: parseInt(params.limit || '20', 10),
    limit: parseInt(params.limit || '20', 10),
    search:
      typeof params.search === 'string' && params.search.trim().length > 0
        ? params.search.trim()
        : undefined,
    status: parsePaymentStatus(params.status),
    paymentMethod,
    sortBy,
    sortOrder: safeSortOrder,
    startDate:
      typeof params.startDate === 'string' && params.startDate.trim().length > 0
        ? params.startDate
        : undefined,
    endDate:
      typeof params.endDate === 'string' && params.endDate.trim().length > 0
        ? params.endDate
        : undefined,
    includeTest: params.includeTest === 'true' ? true : undefined,
    includeVoided: params.includeVoided === 'true' ? true : undefined,
  };

  const clientParams = {
    page: queryParams.page,
    limit: queryParams.pageSize ?? queryParams.limit ?? 20,
    search: params.search || '',
    status: parsePaymentStatus(params.status),
    paymentMethod: params.paymentMethod,
    sortBy,
    sortOrder: safeSortOrder,
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
    includeTest: queryParams.includeTest,
    includeVoided: queryParams.includeVoided,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  queryClient.setQueryData(queryKeys.payments.list(queryParams), {
    records: initialData.payments,
    total: initialData.pagination.total,
    page: initialData.pagination.page,
    pageSize: initialData.pagination.limit,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PaymentsPageClient
        initialData={initialData}
        initialParams={clientParams}
      />
    </HydrationBoundary>
  );
}
