import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import { getManualDamageMetricsForPeriod } from '@/lib/services/manual-damage-ledger-service';
import type {
  PurchaseDamageBreakdown,
  PurchaseDamageCategoryBreakdown,
  PurchaseDamageHandlingBreakdown,
  PurchaseDamageMetrics,
} from '@/lib/types/report';
import { toNumber } from '@/lib/utils/number';

function createEmptyBreakdown(): PurchaseDamageBreakdown {
  return {
    quantity: 0,
    amount: 0,
  };
}

function createEmptyCategoryBreakdown(): PurchaseDamageCategoryBreakdown {
  return {
    damage: createEmptyBreakdown(),
    scrap: createEmptyBreakdown(),
    loss: createEmptyBreakdown(),
    other: createEmptyBreakdown(),
  };
}

function createEmptyHandlingBreakdown(): PurchaseDamageHandlingBreakdown {
  return {
    pendingConfirm: createEmptyBreakdown(),
    supplierClaim: createEmptyBreakdown(),
    internalLoss: createEmptyBreakdown(),
  };
}

export function createEmptyPurchaseDamageMetrics(): PurchaseDamageMetrics {
  return {
    totalQuantity: 0,
    totalAmount: 0,
    purchaseInbound: createEmptyBreakdown(),
    manualDamage: createEmptyBreakdown(),
    supplierClaim: createEmptyBreakdown(),
    internalLoss: createEmptyBreakdown(),
    manualDamageByCategory: createEmptyCategoryBreakdown(),
    manualDamageByHandling: createEmptyHandlingBreakdown(),
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

  const [summary, grouped, manualDamage] = await Promise.all([
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
    getManualDamageMetricsForPeriod(startDate, endDate),
  ]);

  const purchaseInbound: PurchaseDamageBreakdown = {
    quantity: Number(summary._sum.damagedQuantity ?? 0),
    amount: roundToTwoDecimals(toNumber(summary._sum.damageTotalCost)),
  };

  return {
    totalQuantity: purchaseInbound.quantity + manualDamage.quantity,
    totalAmount: roundToTwoDecimals(purchaseInbound.amount + manualDamage.amount),
    purchaseInbound,
    manualDamage: {
      quantity: manualDamage.quantity,
      amount: manualDamage.amount,
    },
    supplierClaim: normalizeBreakdown(
      grouped.find(group => group.damageHandling === 'supplier_claim')
    ),
    internalLoss: normalizeBreakdown(
      grouped.find(group => group.damageHandling === 'internal_loss')
    ),
    manualDamageByCategory: manualDamage.byCategory,
    manualDamageByHandling: manualDamage.byHandling,
  };
}
