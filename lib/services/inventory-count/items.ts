import type { Prisma } from '@prisma/client';

import type { CreateInventoryCountRequest } from '@/lib/types/inventory-count';

type InventoryItemBaseInput = {
  productId: string;
  variantId?: string;
  batchNumber?: string;
  actualQuantity?: number;
  location?: string;
  remarks?: string;
};

type InventoryItemInput =
  | NonNullable<CreateInventoryCountRequest['items']>
  | InventoryItemBaseInput[];

type InventoryRecord = {
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number;
  unitCost: number | null;
  location: string | null;
};

export async function buildInventoryItems(
  tx: Prisma.TransactionClient,
  items?: InventoryItemInput
): Promise<Omit<Prisma.InventoryCountItemCreateManyInput, 'countId'>[]> {
  if (!items?.length) {
    return [];
  }

  const inventoryRecords = await tx.inventory.findMany({
    where: {
      OR: items.map(item => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        batchNumber: item.batchNumber ?? null,
      })),
    },
    select: {
      productId: true,
      variantId: true,
      batchNumber: true,
      quantity: true,
      unitCost: true,
      location: true,
    },
  });

  const inventoryMap = new Map<string, InventoryRecord>(
    inventoryRecords.map(inv => [
      buildInventoryKey(inv.productId, inv.variantId, inv.batchNumber),
      inv,
    ])
  );

  return items.map(item => {
    const inventory = inventoryMap.get(
      buildInventoryKey(
        item.productId,
        item.variantId ?? null,
        item.batchNumber ?? null
      )
    );

    const systemQuantity = inventory?.quantity ?? 0;
    const actualQuantity = item.actualQuantity ?? null;
    const unitCost = inventory?.unitCost ?? null;

    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      batchNumber: item.batchNumber ?? null,
      systemQuantity,
      actualQuantity,
      difference: 0,
      status: 'pending',
      unitCost,
      totalCost: null,
      location: item.location ?? inventory?.location ?? null,
      remarks: item.remarks ?? null,
      countedBy: null,
      countedAt: null,
    } satisfies Omit<Prisma.InventoryCountItemCreateManyInput, 'countId'>;
  });
}

export function buildInventoryKey(
  productId: string,
  variantId: string | null,
  batchNumber: string | null
): string {
  const variantPart = variantId ?? 'null';
  const batchPart = batchNumber ?? 'null';
  return `${productId}::${variantPart}::${batchPart}`;
}
