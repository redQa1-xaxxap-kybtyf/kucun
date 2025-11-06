import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  InventoryCount,
  SubmitCountDataRequest,
  UpdateInventoryCountRequest,
} from '@/lib/types/inventory-count';

import {
  INVENTORY_COUNT_RELATIONS,
  INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  toInventoryCount,
  toInventoryCountWithItems,
} from './utils';
import { buildInventoryItems } from './items';

export async function updateInventoryCount(
  id: string,
  data: UpdateInventoryCountRequest,
  _userId: string
): Promise<InventoryCount> {
  await ensureCountExists(id);

  const count = await prisma.inventoryCount.update({
    where: { id },
    data: buildUpdatePayload(data),
    include: INVENTORY_COUNT_RELATIONS,
  });

  return toInventoryCount(count);
}

export async function deleteInventoryCount(
  id: string,
  _userId: string
): Promise<void> {
  await ensureCountExists(id, 'draft');
  await prisma.inventoryCount.delete({ where: { id } });
}

export async function addCountItems(
  countId: string,
  items: Array<{
    productId: string;
    variantId?: string;
    batchNumber?: string;
    location?: string;
    remarks?: string;
  }>
): Promise<{ success: boolean; message: string; addedCount: number }> {
  await ensureCountExists(countId, 'draft');

  const addedCount = await prisma.$transaction(async tx => {
    const itemsData = await buildInventoryItems(tx, items);

    if (itemsData.length === 0) {
      return 0;
    }

    await tx.inventoryCountItem.createMany({
      data: itemsData.map(item => ({ ...item, countId })),
    });

    await tx.inventoryCount.update({
      where: { id: countId },
      data: {
        totalItems: {
          increment: itemsData.length,
        },
      },
    });

    return itemsData.length;
  });

  return {
    success: true,
    message: `成功添加 ${addedCount} 条盘点明细`,
    addedCount,
  };
}

export async function startCount(
  countId: string,
  userId: string
): Promise<InventoryCount> {
  await ensureCountExists(countId, 'draft');

  const count = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'in_progress',
      startDate: new Date(),
      operatorId: userId,
    },
    include: INVENTORY_COUNT_RELATIONS,
  });

  return toInventoryCount(count);
}

export async function submitCountData(
  countId: string,
  data: SubmitCountDataRequest,
  userId: string
): Promise<{ success: boolean; message: string }> {
  await ensureCountExists(countId, 'in_progress');

  await prisma.$transaction(async tx => {
    await applyItemUpdates(tx, countId, data, userId);
    await refreshCountStatistics(tx, countId);
  });

  return {
    success: true,
    message: `成功提交 ${data.items.length} 条盘点数据`,
  };
}

export async function completeCount(
  countId: string,
  _userId: string
): Promise<InventoryCount> {
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    select: {
      status: true,
      items: {
        select: { status: true },
      },
    },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  if (existingCount.status !== 'in_progress') {
    throw new Error('只有进行中状态的盘点计划可以完成');
  }

  const allCounted = existingCount.items.every(
    item => item.status === 'counted'
  );
  if (!allCounted) {
    throw new Error('还有未盘点的明细，无法完成盘点');
  }

  const count = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'completed',
      endDate: new Date(),
    },
    include: INVENTORY_COUNT_RELATIONS,
  });

  return toInventoryCount(count);
}

export async function getInventoryCountWithItems(
  id: string
): Promise<InventoryCount> {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  });

  if (!count) {
    throw new Error('盘点计划不存在');
  }

  return toInventoryCountWithItems(count);
}

async function ensureCountExists(id: string, status?: string): Promise<void> {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!count) {
    throw new Error('盘点计划不存在');
  }

  if (status && count.status !== status) {
    throw new Error(
      status === 'draft'
        ? '只有草稿状态的盘点计划可以执行该操作'
        : '盘点计划状态不允许当前操作'
    );
  }
}

function buildUpdatePayload(data: UpdateInventoryCountRequest) {
  return {
    ...(data.countName && { countName: data.countName }),
    ...(data.countType && { countType: data.countType }),
    ...(data.planDate && { planDate: new Date(data.planDate) }),
    ...(data.location !== undefined && { location: data.location }),
    ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    ...(data.status && { status: data.status }),
    ...(data.remarks !== undefined && { remarks: data.remarks || null }),
    ...(data.attachments !== undefined && {
      attachments: data.attachments || null,
    }),
  } satisfies Prisma.InventoryCountUpdateInput;
}

async function applyItemUpdates(
  tx: Prisma.TransactionClient,
  countId: string,
  data: SubmitCountDataRequest,
  userId: string
) {
  const itemIds = data.items.map(item => item.id);
  if (itemIds.length === 0) {
    return;
  }

  const countItems = await tx.inventoryCountItem.findMany({
    where: {
      id: { in: itemIds },
      countId,
    },
    select: {
      id: true,
      systemQuantity: true,
      unitCost: true,
    },
  });

  if (countItems.length !== itemIds.length) {
    throw new Error('存在不属于当前盘点计划的明细');
  }

  const countItemMap = new Map(countItems.map(item => [item.id, item]));

  for (const item of data.items) {
    const existingItem = countItemMap.get(item.id);
    if (!existingItem) {
      throw new Error(`盘点明细 ${item.id} 不存在`);
    }
    if (!Number.isFinite(item.actualQuantity)) {
      throw new Error(`盘点明细 ${item.id} 的实际数量无效`);
    }

    const difference = item.actualQuantity - existingItem.systemQuantity;
    const unitCost = existingItem.unitCost ?? null;
    const totalCost = unitCost !== null ? difference * unitCost : null;

    await tx.inventoryCountItem.update({
      where: { id: item.id },
      data: {
        actualQuantity: item.actualQuantity,
        difference,
        totalCost,
        status: 'counted',
        countedBy: userId,
        countedAt: new Date(),
        remarks: item.remarks ?? null,
      },
    });
  }
}

async function refreshCountStatistics(
  tx: Prisma.TransactionClient,
  countId: string
) {
  const items = await tx.inventoryCountItem.findMany({
    where: { countId },
    select: {
      status: true,
      difference: true,
    },
  });

  const completedItems = items.filter(i => i.status === 'counted').length;
  const differenceItems = items.filter(i => i.difference !== 0).length;
  const totalDifference = items.reduce(
    (sum, i) => sum + Math.abs(i.difference),
    0
  );

  await tx.inventoryCount.update({
    where: { id: countId },
    data: {
      completedItems,
      differenceItems,
      totalDifference,
    },
  });
}
