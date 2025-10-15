import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import type { PaymentStatus } from '@/lib/types/payment';

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
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = parsePaymentStatus(searchParams.status);
  const paymentMethod = searchParams.paymentMethod;
  const sortBy = searchParams.sortBy || 'createdAt';
  const sortOrder = searchParams.sortOrder || 'desc';

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

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

  // 查询收款记录
  const [payments, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: whereConditions,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        salesOrder: {
          select: { id: true, orderNumber: true, totalAmount: true },
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

  // 计算统计数据
  const allPayments = await prisma.paymentRecord.findMany({
    where: whereConditions,
    select: {
      paymentAmount: true,
      status: true,
    },
  });

  const statistics = {
    totalAmount: allPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    ),
    confirmedAmount: allPayments
      .filter(p => p.status === 'confirmed' || p.status === 'applied')
      .reduce((sum, p) => sum + Number(p.paymentAmount), 0),
    pendingAmount: allPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.paymentAmount), 0),
    recordCount: allPayments.length,
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

  // 计算每个订单的已收款总额和待确认金额
  const normalizedPayments = await Promise.all(
    paymentsWithRelations.map(async payment => {
      // 查询该订单的所有收款记录(按状态分组)
      const [confirmedPayments, pendingPayments] = await Promise.all([
        prisma.paymentRecord.findMany({
          where: {
            salesOrderId: payment.salesOrderId,
            status: 'confirmed',
          },
          select: {
            paymentAmount: true,
          },
        }),
        prisma.paymentRecord.findMany({
          where: {
            salesOrderId: payment.salesOrderId,
            status: 'pending',
          },
          select: {
            paymentAmount: true,
          },
        }),
      ]);

      const orderPaidAmount = confirmedPayments.reduce(
        (sum, p) => sum + Number(p.paymentAmount),
        0
      );
      const orderPendingAmount = pendingPayments.reduce(
        (sum, p) => sum + Number(p.paymentAmount),
        0
      );
      const orderTotalAmount = Number(payment.salesOrder.totalAmount);
      const orderRemainingAmount =
        orderTotalAmount - orderPaidAmount - orderPendingAmount;

      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        paymentAmount: Number(payment.paymentAmount),
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
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPaymentsData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search,
    status: parsePaymentStatus(params.status),
    paymentMethod: params.paymentMethod,
    sortBy: params.sortBy || 'createdAt',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <PaymentsPageClient initialData={initialData} initialParams={queryParams} />
  );
}
