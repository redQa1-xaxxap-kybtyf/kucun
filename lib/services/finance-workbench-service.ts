import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { CUSTOMER_ROLES } from '@/lib/services/finance-statistics-shared';
import { getSystemMode } from '@/lib/services/system-mode-service';
import { toNumber } from '@/lib/utils/number';

export interface FinanceWorkbenchMetric {
  count: number;
  amount: number;
}

export interface FinanceWorkbenchMetrics {
  receivables: FinanceWorkbenchMetric;
  payables: FinanceWorkbenchMetric;
  overduePayables: FinanceWorkbenchMetric;
  pendingReceipts: FinanceWorkbenchMetric;
  pendingPayments: FinanceWorkbenchMetric;
  pendingRefunds: FinanceWorkbenchMetric;
  expenseDrafts: FinanceWorkbenchMetric;
}

function buildProductionTagFilter(systemMode: string) {
  return systemMode === 'production' ? { dataTag: 'prod' } : {};
}

function buildPayablePendingWhere(
  extra: Prisma.PayableRecordWhereInput = {}
): Prisma.PayableRecordWhereInput {
  return {
    status: { not: 'cancelled' },
    remainingAmount: { gt: 0 },
    voidedAt: null,
    ...extra,
  };
}

export async function getFinanceWorkbenchMetrics(): Promise<FinanceWorkbenchMetrics> {
  const systemMode = await getSystemMode();
  const productionTagFilter = buildProductionTagFilter(systemMode);
  const now = new Date();

  const [
    receivablesAggregate,
    payablesAggregate,
    overduePayablesAggregate,
    pendingReceiptsAggregate,
    pendingPaymentsAggregate,
    pendingRefundsAggregate,
    expenseDraftsAggregate,
  ] = await Promise.all([
    prisma.accountStatement.aggregate({
      where: {
        partnerRole: { in: CUSTOMER_ROLES },
        currentBalance: { gt: 0 },
      },
      _count: { _all: true },
      _sum: { currentBalance: true },
    }),
    prisma.payableRecord.aggregate({
      where: {
        ...buildPayablePendingWhere(),
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { remainingAmount: true },
    }),
    prisma.payableRecord.aggregate({
      where: {
        ...buildPayablePendingWhere({
          dueDate: { lt: now },
        }),
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { remainingAmount: true },
    }),
    prisma.paymentRecord.aggregate({
      where: {
        status: 'pending',
        voidedAt: null,
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { paymentAmount: true },
    }),
    prisma.paymentOutRecord.aggregate({
      where: {
        status: 'pending',
        voidedAt: null,
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { paymentAmount: true },
    }),
    prisma.refundRecord.aggregate({
      where: {
        status: { in: ['pending', 'processing'] },
        remainingAmount: { gt: 0 },
        voidedAt: null,
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { remainingAmount: true },
    }),
    prisma.expenseRecord.aggregate({
      where: {
        status: 'draft',
        voidedAt: null,
        ...productionTagFilter,
      },
      _count: { _all: true },
      _sum: { expenseAmount: true },
    }),
  ]);

  return {
    receivables: {
      count: receivablesAggregate._count._all,
      amount: toNumber(receivablesAggregate._sum.currentBalance),
    },
    payables: {
      count: payablesAggregate._count._all,
      amount: toNumber(payablesAggregate._sum.remainingAmount),
    },
    overduePayables: {
      count: overduePayablesAggregate._count._all,
      amount: toNumber(overduePayablesAggregate._sum.remainingAmount),
    },
    pendingReceipts: {
      count: pendingReceiptsAggregate._count._all,
      amount: toNumber(pendingReceiptsAggregate._sum.paymentAmount),
    },
    pendingPayments: {
      count: pendingPaymentsAggregate._count._all,
      amount: toNumber(pendingPaymentsAggregate._sum.paymentAmount),
    },
    pendingRefunds: {
      count: pendingRefundsAggregate._count._all,
      amount: toNumber(pendingRefundsAggregate._sum.remainingAmount),
    },
    expenseDrafts: {
      count: expenseDraftsAggregate._count._all,
      amount: toNumber(expenseDraftsAggregate._sum.expenseAmount),
    },
  };
}
