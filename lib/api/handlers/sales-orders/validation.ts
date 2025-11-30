import { ApiError } from '@/lib/api/errors';

import type { CreateInput, OrderItemInput, Tx } from './types';

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct &&
  typeof item.productId === 'string' &&
  item.productId.trim().length > 0;

export const ensureCustomerExists = async (tx: Tx, customerId: string) => {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    // 返回明确的业务错误，避免 500
    throw ApiError.notFound('客户');
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
    throw ApiError.notFound('供应商');
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
      throw ApiError.notFound('产品');
    }
  }
};
