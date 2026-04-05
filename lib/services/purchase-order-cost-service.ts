import type { Prisma } from '@prisma/client';

import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import { roundCostPrice } from '@/lib/utils/cost-price';
import { toNumber } from '@/lib/utils/number';
import {
  convertPurchaseOrderQuantityToPieces,
  convertPurchaseOrderUnitPriceToPieceCost,
} from '@/lib/utils/purchase-order-unit';

export interface PurchaseOrderExpenseAllocationInput {
  id: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  piecesPerUnit?: number | null;
  displayName?: string | null;
  productCode?: string | null;
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

  const normalizedItems = items.map(item => ({
    ...item,
    actualQuantity: convertPurchaseOrderQuantityToPieces(item, { strict: true }),
    pieceUnitCost: convertPurchaseOrderUnitPriceToPieceCost(item, {
      strict: true,
    }),
  }));

  const totalQuantity = normalizedItems.reduce(
    (sum, item) => sum + item.actualQuantity,
    0
  );

  if (totalQuantity <= 0) {
    throw new Error('采购订单明细数量总和必须大于0');
  }

  const normalizedExpense = roundToTwoDecimals(Math.max(totalExpense ?? 0, 0));
  const totalExpenseCents = Math.round(normalizedExpense * 100);
  const perUnitExpenseRaw =
    totalQuantity > 0 ? totalExpenseCents / totalQuantity / 100 : 0;

  const allocations = normalizedItems.map(item => {
    const ratio = item.actualQuantity / totalQuantity;
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
        quantity: allocation.actualQuantity,
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
    unitCostWithExpense: roundCostPrice(
      allocation.pieceUnitCost + perUnitExpenseRaw
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
    return roundCostPrice(unitCostWithExpense);
  }

  if (typeof unitPrice === 'number' && !Number.isNaN(unitPrice)) {
    return roundCostPrice(unitPrice);
  }

  return roundCostPrice(fallback);
}

export async function ensurePurchaseOrderCostAllocatedBeforeInbound(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{
  totalExpenseAmount: number;
  allocationsByItemId: Map<string, PurchaseOrderExpenseAllocationResult>;
}> {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      expenseAmount: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          unit: true,
          piecesPerUnit: true,
          displayName: true,
          productCode: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error('采购订单不存在');
  }

  if (!order.items.length) {
    throw new Error('采购订单没有明细项');
  }

  const expenseSum = await tx.expenseRecord.aggregate({
    where: {
      relatedType: 'purchase_order',
      relatedId: orderId,
      voidedAt: null,
    },
    _sum: {
      expenseAmount: true,
    },
  });

  const totalExpenseAmount = roundToTwoDecimals(
    Math.max(0, toNumber(expenseSum._sum.expenseAmount, 0))
  );

  const storedExpenseAmount = roundToTwoDecimals(
    Math.max(0, toNumber(order.expenseAmount, 0))
  );

  // 同步订单级费用汇总，避免“费用台账 != 订单汇总”导致分摊不一致
  if (Math.abs(storedExpenseAmount - totalExpenseAmount) > 0.009) {
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        expenseAmount: totalExpenseAmount,
      },
    });
  }

  const allocations = allocatePurchaseOrderExpensesByQuantity(
    order.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      unit: item.unit,
      piecesPerUnit: item.piecesPerUnit,
      displayName: item.displayName,
      productCode: item.productCode,
    })),
    totalExpenseAmount
  );

  const allocationsByItemId = new Map<
    string,
    PurchaseOrderExpenseAllocationResult
  >();
  const quantityByItemId = new Map<string, number>();
  const unitPriceByItemId = new Map<string, number>();

  for (const item of order.items) {
    quantityByItemId.set(item.id, item.quantity);
    unitPriceByItemId.set(item.id, toNumber(item.unitPrice));
  }

  for (const allocation of allocations) {
    allocationsByItemId.set(allocation.id, allocation);
    await tx.purchaseOrderItem.update({
      where: { id: allocation.id },
      data: {
        allocatedExpense: allocation.allocatedExpense,
        unitCostWithExpense: allocation.unitCostWithExpense,
        unitCost: allocation.unitCostWithExpense,
      },
    });
  }

  const costAmount = roundToTwoDecimals(
    allocations.reduce((sum, allocation) => {
      const qty = quantityByItemId.get(allocation.id) ?? 0;
      const unitPrice = unitPriceByItemId.get(allocation.id) ?? 0;
      return sum + unitPrice * qty + allocation.allocatedExpense;
    }, 0)
  );

  await tx.purchaseOrder.update({
    where: { id: orderId },
    data: { costAmount },
  });

  return {
    totalExpenseAmount,
    allocationsByItemId,
  };
}
