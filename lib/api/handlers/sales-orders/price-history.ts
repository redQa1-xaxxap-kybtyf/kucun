import type { CreateInput, OrderItemInput, Tx } from './types';

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct && typeof item.productId === 'string';

const hasPriceRecord = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string; unitPrice: number } =>
  isProductItem(item) &&
  typeof item.unitPrice === 'number' &&
  item.unitPrice !== 0;

export const recordCustomerPriceHistory = async (
  tx: Tx,
  data: CreateInput,
  salesOrderId: string
) => {
  const priceType = data.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
  const records = data.items.filter(hasPriceRecord).map(item => ({
    customerId: data.customerId,
    productId: item.productId,
    priceType,
    unitPrice: item.unitPrice,
    orderId: salesOrderId,
    orderType: 'SALES_ORDER' as const,
  }));

  for (const record of records) {
    try {
      await tx.customerProductPrice.create({ data: record });
    } catch {
      // skip duplicates
    }
  }
};
