import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';

export interface PurchaseOrderExpenseAllocationInput {
  id: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderExpenseAllocationResult {
  id: string;
  allocatedExpense: number;
  unitCostWithExpense: number;
}

export function allocatePurchaseOrderExpensesByQuantity(
  items: PurchaseOrderExpenseAllocationInput[],
  totalExpense: number | null | undefined
): PurchaseOrderExpenseAllocationResult[] {
  if (!items.length) {
    throw new Error('采购订单至少需要一个明细进行费用分摊');
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  if (totalQuantity <= 0) {
    throw new Error('采购订单明细数量总和必须大于0');
  }

  const normalizedExpense = roundToTwoDecimals(Math.max(totalExpense ?? 0, 0));
  const totalExpenseCents = Math.round(normalizedExpense * 100);
  const perUnitExpenseRaw =
    totalQuantity > 0 ? totalExpenseCents / totalQuantity / 100 : 0;

  const allocations = items.map(item => {
    const ratio = item.quantity / totalQuantity;
    const rawCents = ratio * totalExpenseCents;
    const baseCents = Math.floor(rawCents);
    const remainder = rawCents - baseCents;

    return {
      ...item,
      baseCents,
      remainder,
    };
  });

  const distributedCents = allocations.reduce(
    (sum, allocation) => sum + allocation.baseCents,
    0
  );
  let remainingCents = totalExpenseCents - distributedCents;

  if (remainingCents > 0) {
    const distributionOrder = allocations
      .map((allocation, index) => ({
        index,
        remainder: allocation.remainder,
        quantity: allocation.quantity,
      }))
      .sort((a, b) => {
        if (b.remainder !== a.remainder) {
          return b.remainder - a.remainder;
        }
        return b.quantity - a.quantity;
      });

    for (const entry of distributionOrder) {
      if (remainingCents <= 0) {
        break;
      }
      allocations[entry.index].baseCents += 1;
      remainingCents -= 1;
    }
  }

  return allocations.map(allocation => ({
    id: allocation.id,
    allocatedExpense: roundToTwoDecimals(allocation.baseCents / 100),
    unitCostWithExpense: roundToTwoDecimals(
      allocation.unitPrice + perUnitExpenseRaw
    ),
  }));
}

export function resolveInboundUnitCost(options: {
  unitCostWithExpense?: number | null;
  unitPrice?: number | null;
  fallback: number;
}): number {
  const { unitCostWithExpense, unitPrice, fallback } = options;

  if (
    typeof unitCostWithExpense === 'number' &&
    !Number.isNaN(unitCostWithExpense)
  ) {
    return roundToTwoDecimals(unitCostWithExpense);
  }

  if (typeof unitPrice === 'number' && !Number.isNaN(unitPrice)) {
    return roundToTwoDecimals(unitPrice);
  }

  return roundToTwoDecimals(fallback);
}
