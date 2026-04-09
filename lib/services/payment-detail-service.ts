import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  buildExcludeAutoReceivableConfirmationWhere,
  isAutoReceivableConfirmationPayment,
} from '@/lib/services/receivables-helpers';

const paymentDetailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  prepaymentUsages: {
    include: {
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PaymentRecordInclude;

type PaymentDetailEntity = Prisma.PaymentRecordGetPayload<{
  include: typeof paymentDetailInclude;
}>;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return Number(value ?? 0);
}

async function buildSalesOrderSummary(payment: PaymentDetailEntity) {
  if (!payment.salesOrderId || !payment.salesOrder) {
    return null;
  }

  const [confirmedPaymentsAggregate, prepaymentUsageAggregate] =
    await Promise.all([
      prisma.paymentRecord.aggregate({
        where: {
          salesOrderId: payment.salesOrderId,
          status: 'confirmed',
          ...buildExcludeAutoReceivableConfirmationWhere(),
        },
        _sum: { paymentAmount: true },
      }),
      prisma.prepaymentUsage.aggregate({
        where: {
          salesOrderId: payment.salesOrderId,
        },
        _sum: { appliedAmount: true },
      }),
    ]);

  const totalAmount = toNumber(payment.salesOrder.totalAmount);
  const paidAmount =
    toNumber(confirmedPaymentsAggregate._sum.paymentAmount) +
    toNumber(prepaymentUsageAggregate._sum.appliedAmount);

  return {
    id: payment.salesOrder.id,
    orderNumber: payment.salesOrder.orderNumber,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    status: payment.salesOrder.status,
    createdAt: payment.salesOrder.createdAt.toISOString(),
  };
}

export interface PaymentDetailRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  appliedAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  paymentType: string;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  isSystemReceivableConfirmation: boolean;
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  salesOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  } | null;
  user: {
    id: string;
    name: string;
    email?: string;
  };
  prepaymentUsages?: Array<{
    id: string;
    salesOrderId?: string;
    orderNumber?: string;
    orderStatus?: string;
    orderCreatedAt?: string;
    appliedAmount: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function getPaymentDetailRecord(
  id: string
): Promise<PaymentDetailRecord | null> {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id },
    include: paymentDetailInclude,
  });

  if (!payment || !payment.customer || !payment.user) {
    return null;
  }

  const prepaymentUsages =
    payment.prepaymentUsages?.map(usage => ({
      id: usage.id,
      salesOrderId: usage.salesOrder?.id ?? undefined,
      orderNumber: usage.salesOrder?.orderNumber ?? undefined,
      orderStatus: usage.salesOrder?.status ?? undefined,
      orderCreatedAt: usage.salesOrder?.createdAt
        ? usage.salesOrder.createdAt.toISOString()
        : undefined,
      appliedAmount: toNumber(usage.appliedAmount),
      createdAt: usage.createdAt.toISOString(),
    })) ?? [];

  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    paymentAmount: toNumber(payment.paymentAmount),
    actualPaymentAmount: toNumber(
      payment.actualPaymentAmount ?? payment.paymentAmount
    ),
    roundingAmount: toNumber(payment.roundingAmount),
    appliedAmount: toNumber(payment.appliedAmount),
    paymentMethod: payment.paymentMethod,
    paymentDate: payment.paymentDate.toISOString(),
    status: payment.status,
    paymentType: payment.paymentType,
    remarks: payment.remarks ?? undefined,
    receiptNumber: payment.receiptNumber ?? undefined,
    bankInfo: payment.bankInfo ?? undefined,
    isSystemReceivableConfirmation:
      isAutoReceivableConfirmationPayment(payment),
    customer: {
      id: payment.customer.id,
      name: payment.customer.name,
      phone: payment.customer.phone ?? undefined,
      address: payment.customer.address ?? undefined,
    },
    salesOrder: await buildSalesOrderSummary(payment),
    user: {
      id: payment.user.id,
      name: payment.user.name,
      email: payment.user.email ?? undefined,
    },
    prepaymentUsages,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
