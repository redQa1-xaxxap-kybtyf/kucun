import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';

export function computePurchaseOrderItemTotalPrice(
  quantity: number,
  unitPrice: number
): number {
  const q = Number(quantity ?? 0);
  const p = Number(unitPrice ?? 0);
  return roundToTwoDecimals(q * p);
}

export function normalizePurchaseOrderItems<
  T extends { quantity: number; unitPrice: number; totalPrice?: number },
>(items: T[]): Array<Omit<T, 'totalPrice'> & { totalPrice: number }> {
  return items.map(item => ({
    ...(item as Omit<T, 'totalPrice'>),
    totalPrice: computePurchaseOrderItemTotalPrice(item.quantity, item.unitPrice),
  }));
}

export function calculatePurchaseOrderTotal(
  items: Array<{ quantity: number; unitPrice: number }>
): number {
  const total = items.reduce(
    (sum, item) => sum + computePurchaseOrderItemTotalPrice(item.quantity, item.unitPrice),
    0
  );
  return roundToTwoDecimals(total);
}

