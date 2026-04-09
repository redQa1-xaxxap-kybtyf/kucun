import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  calculatePaymentStatus,
  isAutoReceivableConfirmationPayment,
} from '@/lib/services/receivables-helpers';
import {
  getSalesOrderReceivableTotal,
  shouldCreateReceivableForOrder,
} from '@/lib/utils/sample-order';
import { parseExtendedInfo } from '@/lib/validations/customer';

type ReceivableParams = { id: string };

const RECEIVABLE_ORDER_STATUSES = ['confirmed', 'shipped', 'completed'];

const receivableInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      extendedInfo: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  payments: {
    where: {
      paymentType: 'order_payment',
      status: { in: ['confirmed', 'pending'] },
    },
    select: {
      id: true,
      paymentNumber: true,
      actualPaymentAmount: true,
      roundingAmount: true,
      paymentMethod: true,
      paymentDate: true,
      status: true,
      remarks: true,
      createdAt: true,
    },
    orderBy: [{ paymentDate: 'desc' as const }, { createdAt: 'desc' as const }],
  },
  prepaymentUsages: {
    select: {
      id: true,
      appliedAmount: true,
      createdAt: true,
      paymentRecord: {
        select: {
          paymentNumber: true,
          paymentMethod: true,
          paymentDate: true,
          status: true,
          remarks: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  },
} satisfies Prisma.SalesOrderInclude;

type SalesOrderWithReceivableDetail = Prisma.SalesOrderGetPayload<{
  include: typeof receivableInclude;
}>;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return Number(value ?? 0);
}

function parseDueDays(paymentTerms: string): number {
  const normalized = paymentTerms.trim();
  if (!normalized) {
    return 30;
  }

  if (normalized.includes('现结') || normalized.includes('预付')) {
    return 0;
  }

  const matchedDays = normalized.match(/(\d+)/);
  if (!matchedDays) {
    return 30;
  }

  const dueDays = Number(matchedDays[1]);
  return Number.isFinite(dueDays) ? dueDays : 30;
}

function buildDueDate(createdAt: Date, paymentTerms: string): Date {
  const dueDate = new Date(createdAt);
  dueDate.setDate(dueDate.getDate() + parseDueDays(paymentTerms));
  return dueDate;
}

function serializeReceivableDetail(order: SalesOrderWithReceivableDetail) {
  const customerExtendedInfo = parseExtendedInfo(
    order.customer.extendedInfo ?? undefined
  );
  const paymentTerms = customerExtendedInfo.paymentTerms?.trim() || '30天';

  const receivableConfirmation = order.payments
    .filter(payment => isAutoReceivableConfirmationPayment(payment))
    .sort(
      (left, right) =>
        right.paymentDate.getTime() - left.paymentDate.getTime()
    )[0];
  const actualPayments = order.payments.filter(
    payment => !isAutoReceivableConfirmationPayment(payment)
  );
  const confirmedPayments = actualPayments.filter(
    payment => payment.status === 'confirmed'
  );
  const pendingPayments = actualPayments.filter(
    payment => payment.status === 'pending'
  );

  const confirmedActual = confirmedPayments.reduce(
    (sum, payment) => sum + toNumber(payment.actualPaymentAmount),
    0
  );
  const confirmedRounding = confirmedPayments.reduce(
    (sum, payment) => sum + toNumber(payment.roundingAmount),
    0
  );
  const pendingActual = pendingPayments.reduce(
    (sum, payment) => sum + toNumber(payment.actualPaymentAmount),
    0
  );
  const pendingRounding = pendingPayments.reduce(
    (sum, payment) => sum + toNumber(payment.roundingAmount),
    0
  );
  const prepaymentApplied = order.prepaymentUsages.reduce(
    (sum, usage) => sum + toNumber(usage.appliedAmount),
    0
  );

  const receivableAmount = getSalesOrderReceivableTotal({
    isSampleOrder: order.isSampleOrder,
    sampleSettlementType: order.sampleSettlementType,
    totalAmount: order.totalAmount,
    roundingAdjustment: order.roundingAdjustment,
  });
  const settledAmount =
    confirmedActual + confirmedRounding + prepaymentApplied;
  const remainingAmount = Math.max(0, receivableAmount - settledAmount);
  const pendingAmount = pendingActual + pendingRounding;
  const status = calculatePaymentStatus(
    settledAmount,
    receivableAmount,
    order.createdAt,
    pendingAmount
  );

  const paymentRecords = [
    ...actualPayments.map(payment => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      amount: toNumber(payment.actualPaymentAmount),
      roundingAmount: toNumber(payment.roundingAmount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      remarks: payment.remarks ?? undefined,
      status: payment.status,
      sourceType: 'payment' as const,
    })),
    ...order.prepaymentUsages.map(usage => ({
      id: usage.id,
      paymentNumber: usage.paymentRecord.paymentNumber,
      amount: toNumber(usage.appliedAmount),
      roundingAmount: 0,
      paymentMethod: usage.paymentRecord.paymentMethod,
      paymentDate: usage.createdAt,
      remarks: usage.paymentRecord.remarks ?? '预收款冲抵至当前订单',
      status: 'applied',
      sourceType: 'prepayment' as const,
    })),
  ].sort(
    (left, right) =>
      new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime()
  );

  return {
    id: order.id,
    receivableNumber: order.orderNumber,
    customerId: order.customerId,
    userId: order.userId,
    salesOrderId: order.id,
    receivableAmount,
    receivedAmount: confirmedActual,
    remainingAmount,
    pendingAmount: pendingActual,
    prepaymentApplied,
    orderRoundingAdjustment: toNumber(order.roundingAdjustment),
    paymentRoundingAmount: confirmedRounding,
    pendingRoundingAmount: pendingRounding,
    dueDate: buildDueDate(order.createdAt, paymentTerms),
    status,
    paymentTerms,
    description: `销售订单 ${order.orderNumber} 形成的应收账款`,
    remarks: order.remarks ?? undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(receivableConfirmation
      ? {
          receivableConfirmation: {
            id: receivableConfirmation.id,
            paymentNumber: receivableConfirmation.paymentNumber,
            paymentDate: receivableConfirmation.paymentDate,
            status: receivableConfirmation.status,
            remarks: receivableConfirmation.remarks ?? undefined,
          },
        }
      : {}),
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      phone: order.customer.phone ?? undefined,
      contactPerson: customerExtendedInfo.contactPerson,
    },
    user: {
      id: order.user.id,
      name: order.user.name,
    },
    salesOrder: {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: toNumber(order.totalAmount),
    },
    paymentRecords,
  };
}

const getReceivableDetailHandler = withAuth(
  async (_request: NextRequest, context) => {
    let receivableId: string | undefined;
    try {
      const { id } = await resolveParams<ReceivableParams>(
        context.params as
          | Promise<ReceivableParams>
          | ReceivableParams
          | undefined
      );
      receivableId = id;

      const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: receivableInclude,
      });

      if (
        !order ||
        !RECEIVABLE_ORDER_STATUSES.includes(order.status) ||
        !shouldCreateReceivableForOrder(order)
      ) {
        return NextResponse.json(
          { success: false, error: '应收记录不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: serializeReceivableDetail(order),
      });
    } catch (error) {
      logger.error(
        'finance-receivables',
        '获取应收详情失败',
        error,
        receivableId ? { receivableId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '获取应收详情失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getReceivableDetailHandler);
