import type { CreateInput, OrderItemInput, Tx } from './types';

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct && typeof item.productId === 'string';

export const ensureCustomerExists = async (tx: Tx, customerId: string) => {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new Error('指定的客户不存在');
  }
};

export const ensureSupplierExists = async (
  tx: Tx,
  supplierId?: string | null
) => {
  if (!supplierId) {
    return;
  }

  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });

  if (!supplier) {
    throw new Error('指定的供应商不存在');
  }
};

export const ensureProductsExist = async (
  tx: Tx,
  items: CreateInput['items']
) => {
  const productIds = Array.from(
    new Set(items.filter(isProductItem).map(item => item.productId))
  );

  if (productIds.length === 0) {
    return;
  }

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });

  const existingIds = new Set(products.map(product => product.id));
  for (const productId of productIds) {
    if (!existingIds.has(productId)) {
      throw new Error(`产品ID ${productId} 不存在`);
    }
  }
};
