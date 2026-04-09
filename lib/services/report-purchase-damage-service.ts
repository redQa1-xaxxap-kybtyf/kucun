import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import type {
  PurchaseDamageBreakdown,
  PurchaseDamageMetrics,
} from '@/lib/types/report';
import { toNumber } from '@/lib/utils/number';

function createEmptyBreakdown(): PurchaseDamageBreakdown {
  return {
    quantity: 0,
    amount: 0,
  };
}

export function createEmptyPurchaseDamageMetrics(): PurchaseDamageMetrics {
  return {
    totalQuantity: 0,
    totalAmount: 0,
    supplierClaim: createEmptyBreakdown(),
    internalLoss: createEmptyBreakdown(),
  };
}

function normalizeBreakdown(group?: {
  _sum?: {
    damagedQuantity?: number | null;
    damageTotalCost?: unknown;
  };
}): PurchaseDamageBreakdown {
  if (!group?._sum) {
    return createEmptyBreakdown();
  }

  return {
    quantity: Number(group._sum.damagedQuantity ?? 0),
    amount: roundToTwoDecimals(toNumber(group._sum.damageTotalCost)),
  };
}

export async function getPurchaseDamageMetricsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<PurchaseDamageMetrics> {
  const where = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    reason: 'purchase' as const,
    damagedQuantity: {
      gt: 0,
    },
  };

  const [summary, grouped] = await Promise.all([
    prisma.inboundRecord.aggregate({
      where,
      _sum: {
        damagedQuantity: true,
        damageTotalCost: true,
      },
    }),
    prisma.inboundRecord.groupBy({
      by: ['damageHandling'],
      where,
      _sum: {
        damagedQuantity: true,
        damageTotalCost: true,
      },
    }),
  ]);

  return {
    totalQuantity: Number(summary._sum.damagedQuantity ?? 0),
    totalAmount: roundToTwoDecimals(toNumber(summary._sum.damageTotalCost)),
    supplierClaim: normalizeBreakdown(
      grouped.find(group => group.damageHandling === 'supplier_claim')
    ),
    internalLoss: normalizeBreakdown(
      grouped.find(group => group.damageHandling === 'internal_loss')
    ),
  };
}
