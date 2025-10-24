import type { Prisma } from '@prisma/client';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import {
  PAYMENT_OUT_SORT_OPTIONS,
  type PaymentOutMethod,
  type PaymentOutRecordDetail,
  type PaymentOutStatus,
} from '@/lib/types/payable';
import { parseLocalDateString } from '@/lib/utils/datetime';

const ALLOWED_PAYMENT_OUT_METHODS: PaymentOutMethod[] = [
  'cash',
  'bank_transfer',
  'check',
  'other',
];

const ALLOWED_PAYMENT_OUT_SORT_FIELDS = [
  'createdAt',
  'paymentAmount',
  'paymentDate',
] as const;
type PaymentOutSortField = (typeof ALLOWED_PAYMENT_OUT_SORT_FIELDS)[number];

import { PaymentsOutPageClient } from './page-client';

export const metadata: Metadata = {
  title: '付款记录 - 财务管理',
  description: '管理采购订单的付款记录，跟踪付款状态和金额',
};

/**
 * 服务器端获取付款数据
 */
async function getPaymentsOutData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: string;
  startDate?: string;
  endDate?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const statusParam = searchParams.status;
  const allowedStatuses: PaymentOutStatus[] = [
    'pending',
    'confirmed',
    'cancelled',
  ];
  const status =
    statusParam && allowedStatuses.includes(statusParam as PaymentOutStatus)
      ? (statusParam as PaymentOutStatus)
      : undefined;
  const paymentMethodParam = searchParams.paymentMethod;
  const paymentMethod =
    paymentMethodParam &&
    ALLOWED_PAYMENT_OUT_METHODS.includes(paymentMethodParam as PaymentOutMethod)
      ? (paymentMethodParam as PaymentOutMethod)
      : undefined;
  const sortByParam = searchParams.sortBy || 'createdAt';
  const sortBy: PaymentOutSortField = ALLOWED_PAYMENT_OUT_SORT_FIELDS.includes(
    sortByParam as PaymentOutSortField
  )
    ? (sortByParam as PaymentOutSortField)
    : 'createdAt';
  const sortOrder =
    searchParams.sortOrder === 'asc' || searchParams.sortOrder === 'desc'
      ? (searchParams.sortOrder as 'asc' | 'desc')
      : 'desc';
  const startDateParam = searchParams.startDate;
  const endDateParam = searchParams.endDate;

  // 构建查询条件
  const whereConditions: Prisma.PaymentOutRecordWhereInput = {};

  if (search) {
    whereConditions.OR = [
      { paymentNumber: { contains: search } },
      { voucherNumber: { contains: search } },
      { remarks: { contains: search } },
      { supplier: { name: { contains: search } } },
      {
        payableRecord: {
          OR: [
            { payableNumber: { contains: search } },
            { sourceNumber: { contains: search } },
          ],
        },
      },
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

  // 查询付款记录
  const [payments, total] = await Promise.all([
    prisma.paymentOutRecord.findMany({
      where: whereConditions,
      include: {
        payableRecord: {
          select: {
            id: true,
            payableNumber: true,
            payableAmount: true,
            remainingAmount: true,
          },
        },
        supplier: {
          select: { id: true, name: true, phone: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    }),
    prisma.paymentOutRecord.count({ where: whereConditions }),
  ]);

  // 计算统计数据
  const allPayments = await prisma.paymentOutRecord.findMany({
    where: whereConditions,
    select: {
      paymentAmount: true,
      status: true,
    },
  });

  const totalAmount = allPayments.reduce(
    (sum, payment) => sum + Number(payment.paymentAmount),
    0
  );
  const confirmedAmount = allPayments
    .filter(payment => payment.status === 'confirmed')
    .reduce((sum, payment) => sum + Number(payment.paymentAmount), 0);
  const pendingAmount = allPayments
    .filter(payment => payment.status === 'pending')
    .reduce((sum, payment) => sum + Number(payment.paymentAmount), 0);

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const buildMonthlyWhere = (dateRange: {
    gte: Date;
    lt: Date;
  }): Prisma.PaymentOutRecordWhereInput => ({
    AND: [
      whereConditions,
      {
        paymentDate: dateRange,
      },
    ],
  });

  const [currentMonthPayments, previousMonthPayments] = await Promise.all([
    prisma.paymentOutRecord.findMany({
      where: buildMonthlyWhere({
        gte: startOfCurrentMonth,
        lt: startOfNextMonth,
      }),
      select: { paymentAmount: true, status: true },
    }),
    prisma.paymentOutRecord.findMany({
      where: buildMonthlyWhere({
        gte: startOfPreviousMonth,
        lt: startOfCurrentMonth,
      }),
      select: { paymentAmount: true, status: true },
    }),
  ]);

  const calculateConfirmedSum = (
    list: Array<{ paymentAmount: Prisma.Decimal | number; status: string }>
  ) =>
    list
      .filter(payment => payment.status === 'confirmed')
      .reduce((sum, payment) => sum + Number(payment.paymentAmount), 0);

  const currentMonthConfirmedAmount =
    calculateConfirmedSum(currentMonthPayments);
  const previousMonthConfirmedAmount = calculateConfirmedSum(
    previousMonthPayments
  );

  const confirmedAmountChangePercent =
    previousMonthConfirmedAmount > 0
      ? Number(
          (
            ((currentMonthConfirmedAmount - previousMonthConfirmedAmount) /
              previousMonthConfirmedAmount) *
            100
          ).toFixed(1)
        )
      : null;

  const statistics = {
    totalAmount,
    confirmedAmount,
    pendingAmount,
    recordCount: allPayments.length,
    currentMonthConfirmedAmount: Number(currentMonthConfirmedAmount.toFixed(2)),
    previousMonthConfirmedAmount:
      previousMonthConfirmedAmount > 0
        ? Number(previousMonthConfirmedAmount.toFixed(2))
        : previousMonthConfirmedAmount,
    confirmedAmountChangePercent,
  };

  const normalizedPayments: PaymentOutRecordDetail[] = payments.map(
    payment => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      payableRecordId: payment.payableRecordId ?? undefined,
      supplierId: payment.supplierId,
      userId: payment.userId,
      paymentMethod: (payment.paymentMethod ?? 'other') as PaymentOutMethod,
      paymentAmount: Number(payment.paymentAmount),
      paymentDate: payment.paymentDate,
      status: (payment.status ?? 'pending') as PaymentOutStatus,
      remarks: payment.remarks ?? undefined,
      voucherNumber: payment.voucherNumber ?? undefined,
      bankInfo: payment.bankInfo ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      payableRecord: payment.payableRecord ?? undefined,
      supplier: {
        ...payment.supplier,
        phone: payment.supplier.phone ?? undefined,
      },
      user: payment.user,
    })
  );

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
 * 付款记录页面 - 服务器组件
 */
export default async function PaymentsOutPage({
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
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPaymentsOutData(params);

  const safeSortOrder =
    typeof params.sortOrder === 'string' &&
    (params.sortOrder === 'asc' || params.sortOrder === 'desc')
      ? (params.sortOrder as 'asc' | 'desc')
      : 'desc';

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search || '',
    status: ((): PaymentOutStatus | undefined => {
      const value = params.status;
      const statuses: PaymentOutStatus[] = [
        'pending',
        'confirmed',
        'cancelled',
      ];
      return value && statuses.includes(value as PaymentOutStatus)
        ? (value as PaymentOutStatus)
        : undefined;
    })(),
    paymentMethod: ((): PaymentOutMethod | undefined => {
      const value = params.paymentMethod;
      return value &&
        ALLOWED_PAYMENT_OUT_METHODS.includes(value as PaymentOutMethod)
        ? (value as PaymentOutMethod)
        : undefined;
    })(),
    sortBy: ((): PaymentOutSortField => {
      const value = params.sortBy;
      const sortValues = PAYMENT_OUT_SORT_OPTIONS.map(option => option.value);
      return value && sortValues.includes(value)
        ? (value as PaymentOutSortField)
        : 'createdAt';
    })(),
    sortOrder: safeSortOrder,
    startDate:
      typeof params.startDate === 'string' && params.startDate.trim().length > 0
        ? params.startDate
        : undefined,
    endDate:
      typeof params.endDate === 'string' && params.endDate.trim().length > 0
        ? params.endDate
        : undefined,
  };

  return (
    <PaymentsOutPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}
