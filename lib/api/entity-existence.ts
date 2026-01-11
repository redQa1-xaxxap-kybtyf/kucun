import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';

export type EntityExistenceDb = Pick<
  Prisma.TransactionClient,
  'product' | 'supplier' | 'customer'
>;

function normalizeIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      ids
        .map(id => (id ?? '').trim())
        .filter((id): id is string => id.length > 0)
    )
  );
}

export async function ensureSuppliersExistByIds(
  db: EntityExistenceDb,
  supplierIds: Array<string | null | undefined>
): Promise<void> {
  const ids = normalizeIds(supplierIds);
  if (ids.length === 0) {
    return;
  }

  const existing = await db.supplier.findMany({
    where: { id: { in: ids } },
    select: { id: true },
    take: ids.length,
  });

  const existingIds = new Set(existing.map(row => row.id));
  const missing = ids.filter(id => !existingIds.has(id));

  if (missing.length > 0) {
    throw ApiError.badRequest(`供应商不存在: ${missing.join(', ')}`);
  }
}

export async function ensureProductsExistFromItems(
  db: EntityExistenceDb,
  items: Array<{ isManualProduct?: boolean; productId?: string | null }>
): Promise<void> {
  const productIds = normalizeIds(
    items
      .filter(item => !item.isManualProduct && item.productId)
      .map(item => item.productId)
  );

  if (productIds.length === 0) {
    return;
  }

  const existing = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
    take: productIds.length,
  });

  const existingIds = new Set(existing.map(row => row.id));
  const missing = productIds.filter(id => !existingIds.has(id));

  if (missing.length > 0) {
    throw ApiError.badRequest(`产品不存在: ${missing.join(', ')}`);
  }
}

export async function ensureCustomersExistByIds(
  db: EntityExistenceDb,
  customerIds: Array<string | null | undefined>
): Promise<void> {
  const ids = normalizeIds(customerIds);
  if (ids.length === 0) {
    return;
  }

  const existing = await db.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true },
    take: ids.length,
  });

  const existingIds = new Set(existing.map(row => row.id));
  const missing = ids.filter(id => !existingIds.has(id));

  if (missing.length > 0) {
    throw ApiError.badRequest(`客户不存在: ${missing.join(', ')}`);
  }
}
