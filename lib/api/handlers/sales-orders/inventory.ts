import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';
import { mapProductionDateToBatchNumber } from '@/lib/utils/inventory-variant-mapper';

import type { CreateInput, OrderItemInput, Tx } from './types';

const inventoryReservationSelect = {
  id: true,
  productId: true,
  variantId: true,
  batchNumber: true,
  quantity: true,
  reservedQuantity: true,
} satisfies Prisma.InventorySelect;

type InventoryRecord = Prisma.InventoryGetPayload<{
  select: typeof inventoryReservationSelect;
}>;

const normalizeText = (value?: string | null) => (value ?? '').trim();

export type ReservationOutcome = {
  salesOrderItemId?: string;
  inventoryId: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  reservedQuantity: number;
};

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct && typeof item.productId === 'string';

const buildInventoryKey = (
  productId: string,
  variantId?: string | null,
  batchNumber?: string | null
) => `${productId}::${variantId ?? ''}::${normalizeText(batchNumber)}`;

const loadInventory = async (tx: Tx, targets: Array<{ productId: string }>) => {
  if (targets.length === 0) {
    return new Map<string, InventoryRecord[]>();
  }

  const uniqueIds = Array.from(
    new Set(targets.map(target => target.productId))
  );

  const inventories: InventoryRecord[] = [];
  const pageSize = 2000;
  let cursor: string | undefined;

  while (true) {
    const page = await tx.inventory.findMany({
      where: { productId: { in: uniqueIds } },
      select: inventoryReservationSelect,
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    inventories.push(...page);
    if (page.length < pageSize) {
      break;
    }

    cursor = page[page.length - 1]?.id;
    if (!cursor) {
      break;
    }
  }

  const grouped = new Map<string, InventoryRecord[]>();
  for (const inventory of inventories) {
    const bucket = grouped.get(inventory.productId) ?? [];
    bucket.push(inventory);
    grouped.set(inventory.productId, bucket);
  }

  return grouped;
};

const resolveInventory = (
  input: {
    productId: string;
    variantId: string | null;
    batchNumber?: string | null;
    productionDate?: string | null;
  },
  productInventories: Map<string, InventoryRecord[]>,
  cache: Map<string, InventoryRecord>
) => {
  const inventoriesByProduct = productInventories.get(input.productId) ?? [];
  const inventories = inventoriesByProduct.filter(
    inventory => (inventory.variantId ?? null) === input.variantId
  );

  if (inventories.length === 0) {
    throw ApiError.notFound(`库存记录`);
  }

  const normalizedTarget = normalizeText(input.batchNumber ?? null);
  const normalizedProductionDate = normalizeText(input.productionDate ?? null);
  const productionDateToken =
    mapProductionDateToBatchNumber(normalizedProductionDate) ?? '';

  const cacheBatchKey =
    normalizedTarget.length > 0
      ? normalizedTarget
      : normalizedProductionDate.length > 0
        ? `@pd:${productionDateToken || normalizedProductionDate}`
        : '';

  const preferredKey = buildInventoryKey(
    input.productId,
    input.variantId,
    cacheBatchKey
  );

  const cached = cache.get(preferredKey);
  if (cached) {
    return cached;
  }

  const matchedByBatchNumber =
    normalizedTarget.length > 0
      ? inventories.find(
          inventory => normalizeText(inventory.batchNumber) === normalizedTarget
        )
      : undefined;

  const matchedByProductionDate =
    normalizedTarget.length === 0 && normalizedProductionDate.length > 0
      ? inventories.filter(inventory => {
          const batch = normalizeText(inventory.batchNumber);
          if (!batch) return false;
          if (batch === normalizedProductionDate) return true;
          if (productionDateToken && batch === productionDateToken) return true;
          return productionDateToken.length > 0 && batch.includes(productionDateToken);
        })
      : [];

  const matched =
    matchedByBatchNumber ??
    (matchedByProductionDate.length === 1
      ? matchedByProductionDate[0]
      : inventories.length === 1
        ? inventories[0]
        : undefined);

  if (!matched) {
    const variantHint = input.variantId ? ` (variantId: ${input.variantId})` : '';
    if (normalizedTarget.length > 0) {
      throw new Error(
        `产品ID ${input.productId}${variantHint} 库存记录不存在 (批次: ${normalizedTarget})`
      );
    }

    if (matchedByProductionDate.length > 1) {
      throw new Error(
        `产品ID ${input.productId}${variantHint} 存在多个匹配生产日期的库存批次，请在订单明细中指定批次号`
      );
    }

    throw new Error(
      `产品ID ${input.productId}${variantHint} 存在多个库存批次，请在订单明细中指定批次号`
    );
  }

  cache.set(preferredKey, matched);
  return matched;
};

const resolveVariantId = async (
  tx: Tx,
  item: OrderItemInput & { productId: string }
): Promise<string | null> => {
  const explicitVariantId = normalizeText((item as { variantId?: string }).variantId);
  if (explicitVariantId.length > 0) {
    return explicitVariantId;
  }

  const colorCode = normalizeText((item as { colorCode?: string }).colorCode);
  if (colorCode.length === 0) {
    return null;
  }

  const variant = await tx.productVariant.findFirst({
    where: {
      productId: item.productId,
      colorCode,
    },
    select: { id: true },
  });

  return variant?.id ?? null;
};

const processReservation = async (
  tx: Tx,
  item: OrderItemInput,
  transferMode: CreateInput['transferMode'],
  inventories: Map<string, InventoryRecord[]>,
  cache: Map<string, InventoryRecord>,
  localReservation: Map<string, number>
): Promise<ReservationOutcome | null> => {
  if (!isProductItem(item)) {
    return null;
  }

  if (
    transferMode === 'MIXED' &&
    item.localQuantity !== undefined &&
    item.localQuantity <= 0
  ) {
    return null;
  }

  const variantId = await resolveVariantId(tx, item);
  const inventory = resolveInventory(
    {
      productId: item.productId,
      variantId,
      batchNumber: item.batchNumber ?? null,
      productionDate: (item as { productionDate?: string | null }).productionDate ?? null,
    },
    inventories,
    cache
  );

  const reservationKey = buildInventoryKey(
    inventory.productId,
    inventory.variantId,
    inventory.batchNumber
  );
  const pendingReservation = localReservation.get(reservationKey) ?? 0;
  const effectiveReserved = inventory.reservedQuantity + pendingReservation;
  const itemQuantity =
    transferMode === 'MIXED' ? (item.localQuantity ?? 0) : (item.quantity ?? 0);

  if (itemQuantity <= 0) {
    return null;
  }

  const availableQuantity = inventory.quantity - effectiveReserved;
  if (availableQuantity < itemQuantity) {
    const batchLabel = (inventory.batchNumber ?? '').trim();
    const batchMessage = batchLabel ? ` (批次: ${batchLabel})` : '';
    throw new Error(
      `产品ID ${inventory.productId}${batchMessage} 可用库存不足。可用: ${availableQuantity}, 需要: ${itemQuantity}`
    );
  }

  const updatedCount = await tx.inventory.updateMany({
    where: {
      id: inventory.id,
      reservedQuantity: effectiveReserved,
      quantity: { gte: effectiveReserved + itemQuantity },
    },
    data: {
      reservedQuantity: { increment: itemQuantity },
    },
  });

  if (updatedCount.count === 0) {
    const batchLabel = (inventory.batchNumber ?? '').trim();
    const batchMessage = batchLabel ? ` (批次: ${batchLabel})` : '';
    throw new Error(
      `产品ID ${inventory.productId}${batchMessage} 库存预留失败,可能已被其他订单占用,请重试`
    );
  }

  localReservation.set(reservationKey, pendingReservation + itemQuantity);

  const salesOrderItemId = normalizeText(
    (item as unknown as { id?: string }).id
  );

  return {
    salesOrderItemId: salesOrderItemId.length > 0 ? salesOrderItemId : undefined,
    inventoryId: inventory.id,
    productId: inventory.productId,
    variantId: inventory.variantId ?? null,
    batchNumber: inventory.batchNumber ?? null,
    reservedQuantity: itemQuantity,
  };
};

export const shouldReserveInventory = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) =>
  data.status === 'confirmed' &&
  (data.orderType !== 'TRANSFER' || transferMode === 'MIXED');

export const reserveInventory = async (
  tx: Tx,
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) => {
  const productItems = data.items
    .filter(isProductItem)
    .filter(item =>
      data.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.localQuantity ?? 0) > 0
        : true
    )
    .map(item => ({ productId: item.productId }));

  const inventories = await loadInventory(tx, productItems);
  const cache = new Map<string, InventoryRecord>();
  const localReservation = new Map<string, number>();
  const outcomes: ReservationOutcome[] = [];

  for (const item of data.items) {
    const outcome = await processReservation(
      tx,
      item,
      transferMode,
      inventories,
      cache,
      localReservation
    );
    if (outcome) {
      outcomes.push(outcome);
    }
  }

  return outcomes;
};
