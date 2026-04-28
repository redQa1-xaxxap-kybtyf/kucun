import type { Prisma } from '@prisma/client';

import {
  buildExcludeAutoReceivableConfirmationWhere,
  isAutoReceivableConfirmationPayment,
} from '@/lib/services/receivables-helpers';
import { toNumber } from '@/lib/utils/number';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';

const SETTLED_PAYMENT_STATUSES = new Set(['confirmed', 'applied']);

export interface SettlementPayment {
  status?: string | null;
  paymentAmount?: unknown;
  actualPaymentAmount?: unknown;
  roundingAmount?: unknown;
  remarks?: string | null;
}

export interface SettlementPrepaymentUsage {
  appliedAmount?: unknown;
}

export function calculateConfirmedPaymentSettledAmount(
  payments: SettlementPayment[] | null | undefined
): number {
  if (!payments?.length) {
    return 0;
  }

  return payments.reduce((sum, payment) => {
    if (!SETTLED_PAYMENT_STATUSES.has(payment.status ?? '')) {
      return sum;
    }

    if (isAutoReceivableConfirmationPayment(payment)) {
      return sum;
    }

    const paymentAmount = toNumber(payment.paymentAmount, Number.NaN);
    if (Number.isFinite(paymentAmount)) {
      return sum + paymentAmount;
    }

    return (
      sum +
      toNumber(payment.actualPaymentAmount, 0) +
      toNumber(payment.roundingAmount, 0)
    );
  }, 0);
}

export function calculatePrepaymentAppliedAmount(
  prepaymentUsages: SettlementPrepaymentUsage[] | null | undefined
): number {
  if (!prepaymentUsages?.length) {
    return 0;
  }

  return prepaymentUsages.reduce(
    (sum, usage) => sum + toNumber(usage.appliedAmount, 0),
    0
  );
}

export function calculateSalesOrderSettledAmount(params: {
  payments?: SettlementPayment[] | null;
  prepaymentUsages?: SettlementPrepaymentUsage[] | null;
}): number {
  return (
    calculateConfirmedPaymentSettledAmount(params.payments) +
    calculatePrepaymentAppliedAmount(params.prepaymentUsages)
  );
}

export function calculateSalesOrderRemainingAmount(params: {
  receivableTotal: number;
  payments?: SettlementPayment[] | null;
  prepaymentUsages?: SettlementPrepaymentUsage[] | null;
}): number {
  const settledAmount = calculateSalesOrderSettledAmount(params);
  return Math.max(0, params.receivableTotal - settledAmount);
}

export async function recalculateSalesOrderPaidAmount(
  tx: Prisma.TransactionClient,
  salesOrderId: string,
  options: { autoCompleteShipped?: boolean } = {}
): Promise<{
  paidAmount: number;
  settledAmount: number;
  receivableTotal: number;
} | null> {
  const salesOrder = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      id: true,
      totalAmount: true,
      roundingAdjustment: true,
      isSampleOrder: true,
      sampleSettlementType: true,
      status: true,
      prepaymentUsages: {
        select: {
          appliedAmount: true,
        },
      },
    },
  });

  if (!salesOrder) {
    return null;
  }

  const confirmedPayments = await tx.paymentRecord.aggregate({
    where: {
      salesOrderId,
      status: { in: ['confirmed', 'applied'] },
      ...buildExcludeAutoReceivableConfirmationWhere(),
    },
    _sum: {
      paymentAmount: true,
    },
  });

  const paymentSettledAmount = toNumber(
    confirmedPayments._sum.paymentAmount,
    0
  );
  const prepaymentSettledAmount = calculatePrepaymentAppliedAmount(
    salesOrder.prepaymentUsages
  );
  const settledAmount = paymentSettledAmount + prepaymentSettledAmount;
  const receivableTotal = getSalesOrderReceivableTotal({
    isSampleOrder: salesOrder.isSampleOrder,
    sampleSettlementType: salesOrder.sampleSettlementType,
    totalAmount: salesOrder.totalAmount,
    roundingAdjustment: salesOrder.roundingAdjustment,
  });
  const paidAmount = Math.min(receivableTotal, settledAmount);

  await tx.salesOrder.update({
    where: { id: salesOrder.id },
    data: {
      paidAmount,
      ...(options.autoCompleteShipped &&
      salesOrder.status === 'shipped' &&
      settledAmount >= receivableTotal
        ? { status: 'completed' }
        : {}),
    },
  });

  return {
    paidAmount,
    settledAmount,
    receivableTotal,
  };
}
