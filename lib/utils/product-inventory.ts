import type { Product, ProductInventoryBatch } from '@/lib/types/product';

const normalizeBatchNumber = (value?: string | null) => (value ?? '').trim();

const toSafeNumber = (value: unknown): number | undefined => {
  const numeric =
    typeof value === 'number'
      ? value
      : value === null || value === undefined
        ? undefined
        : Number(value);

  if (numeric === undefined || !Number.isFinite(numeric)) {
    return undefined;
  }

  return numeric;
};

export function getInventoryBatchAvailableQuantity(
  batch?:
    | (Pick<ProductInventoryBatch, 'quantity'> & {
        availableQuantity?: number | null;
      })
    | null
) {
  const available = toSafeNumber(batch?.availableQuantity);
  if (available !== undefined) {
    return Math.max(available, 0);
  }

  const quantity = toSafeNumber(batch?.quantity);
  return Math.max(quantity ?? 0, 0);
}

export function getInventoryBatchReservedQuantity(
  batch?: {
    reservedQuantity?: number | null;
  } | null
) {
  return Math.max(toSafeNumber(batch?.reservedQuantity) ?? 0, 0);
}

export function findProductInventoryBatch(
  product?: Pick<Product, 'inventory'> | null,
  batchNumber?: string | null
) {
  const normalizedBatchNumber = normalizeBatchNumber(batchNumber);
  if (!normalizedBatchNumber) {
    return undefined;
  }

  return product?.inventory?.batches?.find(
    batch => normalizeBatchNumber(batch.batchNumber) === normalizedBatchNumber
  );
}

export function getProductSelectableInventoryBatches(
  product?: Pick<Product, 'inventory'> | null
) {
  return (product?.inventory?.batches ?? []).filter(
    batch => getInventoryBatchAvailableQuantity(batch) > 0
  );
}

export function requiresProductBatchSelection(
  product?: Pick<Product, 'inventory'> | null,
  batchNumber?: string | null
) {
  if (normalizeBatchNumber(batchNumber)) {
    return false;
  }

  return getProductSelectableInventoryBatches(product).length > 1;
}

export function getProductAvailableQuantity(
  product?: Pick<Product, 'inventory'> | null,
  batchNumber?: string | null
) {
  const normalizedBatchNumber = normalizeBatchNumber(batchNumber);

  if (normalizedBatchNumber) {
    const batch = findProductInventoryBatch(product, normalizedBatchNumber);
    return batch ? getInventoryBatchAvailableQuantity(batch) : 0;
  }

  const available = toSafeNumber(product?.inventory?.availableQuantity);
  const batchAvailableQuantity = (product?.inventory?.batches ?? []).reduce(
    (sum, batch) => sum + getInventoryBatchAvailableQuantity(batch),
    0
  );

  if ((product?.inventory?.batches?.length ?? 0) > 0) {
    if (available === undefined) {
      return batchAvailableQuantity;
    }

    return Math.max(Math.max(available, 0), batchAvailableQuantity);
  }

  if (available === undefined) {
    return undefined;
  }

  return Math.max(available, 0);
}
