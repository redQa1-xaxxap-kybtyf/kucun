import type { Prisma } from '@prisma/client';
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  PAYMENT_OUT_SORT_OPTIONS,
  type PaymentOutMethod,
  type PaymentOutRecordDetail,
  type PaymentOutStatus,
} from '@/lib/types/payable';
import { parseLocalDateString } from '@/lib/utils/datetime';
// ✅ P0修复: 导入统一的付款方式常量和查询参数校验 Schema
import {
  PAYMENT_OUT_METHODS,
  paymentOutRecordQuerySchema,
} from '@/lib/validations/payable';

// ✅ P0修复: 使用统一的付款方式常量，避免多处定义导致漂移
const ALLOWED_PAYMENT_OUT_METHODS: PaymentOutMethod[] = [
  ...PAYMENT_OUT_METHODS,
];

type PaymentOutSortField = 'createdAt' | 'paymentAmount' | 'paymentDate';

import { PaymentsOutPageClient } from './page-client';

export const metadata: Metadata = {
  title: '付款记录 - 财务管理',
  description: '管理采购订单的付款记录，跟踪付款状态和金额',
};

/**
 * 服务器端获取付款数据
 * ✅ P0修复: 添加参数校验，防止非法参数导致 500 错误
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
  // ✅ P0修复: 使用 Schema 校验参数，防止 NaN 导致 Prisma 错误
  const validationResult = paymentOutRecordQuerySchema.safeParse(searchParams);

  if (!validationResult.success) {
    // 如果校验失败，使用默认值而不是抛出错误
    // 这样可以提供更好的用户体验
    const firstIssue = validationResult.error.issues[0];
    logger.warn('finance-payments-out', '付款记录查询参数校验失败', {
      errorMessage: firstIssue?.message,
      errorPath: firstIssue?.path?.join('.') || undefined,
      rawSearchParams: JSON.stringify(searchParams),
    });
  }

  // 使用校验后的数据或默认值
  const {
    page = 1,
    limit = 20,
    search,
    status,
    paymentMethod,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
  } = validationResult.success ? validationResult.data : {};

  const skip = (page - 1) * limit;

  // ✅ P0修复: 移除重复的参数解析逻辑，直接使用校验后的值

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

  // ✅ P0修复: 使用校验后的 startDate 和 endDate
  if (startDate || endDate) {
    const paymentDateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      paymentDateFilter.gte =
        parseLocalDateString(startDate) ?? new Date(startDate);
    }
    if (endDate) {
      const endDateObj = parseLocalDateString(endDate) ?? new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      paymentDateFilter.lte = endDateObj;
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

  // ✅ 优化：使用聚合查询替代全表扫描
  // 修复前：3 次 findMany 全表扫描（总计、当月、上月）
  // 修复后：5 次 aggregate/groupBy 查询，只返回标量结果

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  // 并行执行聚合查询
  const [
    totalStats,
    confirmedStats,
    pendingStats,
    currentMonthStats,
    previousMonthStats,
  ] = await Promise.all([
    // 总体统计
    prisma.paymentOutRecord.aggregate({
      where: whereConditions,
      _sum: { paymentAmount: true },
      _count: { _all: true },
    }),
    // 已确认金额
    prisma.paymentOutRecord.aggregate({
      where: {
        ...whereConditions,
        status: 'confirmed',
      },
      _sum: { paymentAmount: true },
    }),
    // 待确认金额
    prisma.paymentOutRecord.aggregate({
      where: {
        ...whereConditions,
        status: 'pending',
      },
      _sum: { paymentAmount: true },
    }),
    // 当月统计
    prisma.paymentOutRecord.groupBy({
      by: ['status'],
      where: {
        ...whereConditions,
        paymentDate: {
          gte: startOfCurrentMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: { paymentAmount: true },
      _count: true,
    }),
    // 上月统计
    prisma.paymentOutRecord.groupBy({
      by: ['status'],
      where: {
        ...whereConditions,
        paymentDate: {
          gte: startOfPreviousMonth,
          lt: startOfCurrentMonth,
        },
      },
      _sum: { paymentAmount: true },
      _count: true,
    }),
  ]);

  // 计算总体指标
  const totalAmount = Number(totalStats._sum.paymentAmount ?? 0);
  const confirmedAmount = Number(confirmedStats._sum.paymentAmount ?? 0);
  const pendingAmount = Number(pendingStats._sum.paymentAmount ?? 0);

  // ✅ 优化：从 groupBy 结果计算月度已确认金额
  const calculateMonthlyConfirmedAmount = (
    groupedStats: Array<{
      status: string;
      _sum: { paymentAmount: unknown };
    }>
  ) => {
    const confirmed = groupedStats.find(stat => stat.status === 'confirmed');
    return Number(confirmed?._sum.paymentAmount ?? 0);
  };

  const currentMonthConfirmedAmount =
    calculateMonthlyConfirmedAmount(currentMonthStats);
  const previousMonthConfirmedAmount =
    calculateMonthlyConfirmedAmount(previousMonthStats);

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
    recordCount: totalStats._count?._all ?? 0,
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
      payableRecord: payment.payableRecord
        ? {
            ...payment.payableRecord,
            payableAmount: Number(payment.payableRecord.payableAmount),
            remainingAmount: Number(payment.payableRecord.remainingAmount),
          }
        : undefined,
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
  // ✅ Next.js 15: searchParams 需要 await
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
