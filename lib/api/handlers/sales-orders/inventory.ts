import type { Prisma } from '@prisma/client';

import type { CreateInput, OrderItemInput, Tx } from './types';

type InventoryRecord = Prisma.InventoryGetPayload<{}>;

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct && typeof item.productId === 'string';

const buildInventoryKey = (productId: string, batchNumber?: string | null) =>
  `${productId}::${(batchNumber ?? '').trim()}`;

const loadInventory = async (
  tx: Tx,
  targets: Array<{ productId: string }>
) => {
  if (targets.length === 0) {
    return new Map<string, InventoryRecord[]>();
  }

  const uniqueIds = Array.from(
    new Set(targets.map(target => target.productId))
  );
  const inventories = await tx.inventory.findMany({
    where: { productId: { in: uniqueIds } },
  });

  const grouped = new Map<string, InventoryRecord[]>();
  for (const inventory of inventories) {
    const bucket = grouped.get(inventory.productId) ?? [];
    bucket.push(inventory);
    grouped.set(inventory.productId, bucket);
  }

  return grouped;
};

const resolveInventory = (
  item: OrderItemInput & { productId: string },
  productInventories: Map<string, InventoryRecord[]>,
  cache: Map<string, InventoryRecord>
) => {
  const inventories = productInventories.get(item.productId) ?? [];

  if (inventories.length === 0) {
    throw new Error(`产品ID ${item.productId} 库存记录不存在`);
  }

  const preferredKey = buildInventoryKey(item.productId, item.batchNumber ?? null);
  const cached = cache.get(preferredKey);
  if (cached) {
    return cached;
  }

  const normalizedTarget = (item.batchNumber ?? '').trim();
  const matched =
    normalizedTarget.length > 0
      ? inventories.find(
          inventory => (inventory.batchNumber ?? '').trim() === normalizedTarget
        )
      : inventories.length === 1
        ? inventories[0]
        : undefined;

  if (!matched) {
    if (normalizedTarget.length > 0) {
      throw new Error(`产品ID ${item.productId} 库存记录不存在`);
    }

    throw new Error(
      `产品ID ${item.productId} 存在多个库存批次，请在订单明细中指定批次号`
    );
  }

  cache.set(preferredKey, matched);
  return matched;
};

const processReservation = async (
  tx: Tx,
  item: OrderItemInput,
  transferMode: CreateInput['transferMode'],
  inventories: Map<string, InventoryRecord[]>,
  cache: Map<string, InventoryRecord>,
  localReservation: Map<string, number>
) => {
  if (!isProductItem(item)) {
    return;
  }

  if (
    transferMode === 'MIXED' &&
    item.localQuantity !== undefined &&
    item.localQuantity <= 0
  ) {
    return;
  }

  const inventory = resolveInventory(item, inventories, cache);
  const reservationKey = buildInventoryKey(inventory.productId, inventory.batchNumber);
  const pendingReservation = localReservation.get(reservationKey) ?? 0;
  const effectiveReserved = inventory.reservedQuantity + pendingReservation;
  const itemQuantity =
    transferMode === 'MIXED'
      ? item.localQuantity ?? 0
      : item.quantity ?? 0;

  if (itemQuantity <= 0) {
    return;
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

  for (const item of data.items) {
    await processReservation(
      tx,
      item,
      transferMode,
      inventories,
      cache,
      localReservation
    );
  }
};
