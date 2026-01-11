import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  InventoryCount,
  InventoryCountDetail,
  SubmitCountDataRequest,
  UpdateInventoryCountRequest,
} from '@/lib/types/inventory-count';
import { generateAdjustmentNumber } from '@/lib/utils/adjustment-number-generator';

import { buildInventoryItems } from './items';
import {
  INVENTORY_COUNT_RELATIONS,
  INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  toInventoryCount,
  toInventoryCountWithItems,
} from './utils';

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
  userId: string
): Promise<InventoryCount> {
  // 1. 验证盘点计划状态
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    select: {
      status: true,
      items: {
        select: {
          id: true,
          status: true,
          productId: true,
          variantId: true,
          batchNumber: true,
          systemQuantity: true,
          actualQuantity: true,
          difference: true,
          unitCost: true,
        },
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

  // 2. 在事务中完成盘点并自动调整库存
  const count = await prisma.$transaction(async tx => {
    // 2.1 遍历所有有差异的盘点明细，自动创建调整记录
    const itemsWithDifference = existingCount.items.filter(
      item => item.difference !== 0 && item.actualQuantity !== null
    );

    for (const item of itemsWithDifference) {
      // 2.1.1 生成调整单号
      const adjustmentNumber = await generateAdjustmentNumber(tx);

      // 2.1.2 确定调整原因（盘盈或盘亏）
      const reason = item.difference > 0 ? 'surplus' : 'deficit';
      const beforeQuantity = item.systemQuantity;
      const afterQuantity = item.actualQuantity!;

      // 2.1.3 更新库存数量
      await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          variantId: item.variantId ?? null,
          batchNumber: item.batchNumber ?? null,
        },
        data: {
          quantity: afterQuantity,
        },
      });

      // 2.1.4 创建调整记录（包含成本信息）
      await tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber,
          productId: item.productId,
          variantId: item.variantId,
          batchNumber: item.batchNumber,
          beforeQuantity,
          adjustQuantity: item.difference,
          afterQuantity,
          unitCost: item.unitCost,
          totalCost: item.unitCost
            ? item.difference * Number(item.unitCost)
            : null,
          reason,
          notes: `盘点自动调整（盘点单：${countId}）`,
          status: 'approved',
          operatorId: userId,
          approverId: userId,
          approvedAt: new Date(),
        },
      });

      // 2.1.5 将盘点明细状态改为 'adjusted'
      await tx.inventoryCountItem.update({
        where: { id: item.id },
        data: {
          status: 'adjusted',
        },
      });
    }

    // 2.2 更新盘点计划状态
    const updatedCount = await tx.inventoryCount.update({
      where: { id: countId },
      data: {
        status: 'completed',
        endDate: new Date(),
      },
      include: INVENTORY_COUNT_RELATIONS,
    });

    return updatedCount;
  });

  return toInventoryCount(count);
}

export async function getInventoryCountWithItems(
  id: string
): Promise<InventoryCountDetail> {
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
    take: itemIds.length,
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
    const unitCost =
      existingItem.unitCost === null || existingItem.unitCost === undefined
        ? null
        : Number(existingItem.unitCost);
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
  const [completedItems, differenceItems, positiveDiff, negativeDiff] =
    await Promise.all([
      tx.inventoryCountItem.count({
        where: { countId, status: 'counted' },
      }),
      tx.inventoryCountItem.count({
        where: { countId, difference: { not: 0 } },
      }),
      tx.inventoryCountItem.aggregate({
        where: { countId, difference: { gt: 0 } },
        _sum: { difference: true },
      }),
      tx.inventoryCountItem.aggregate({
        where: { countId, difference: { lt: 0 } },
        _sum: { difference: true },
      }),
    ]);

  const totalDifference =
    (positiveDiff._sum.difference ?? 0) +
    Math.abs(negativeDiff._sum.difference ?? 0);

  await tx.inventoryCount.update({
    where: { id: countId },
    data: {
      completedItems,
      differenceItems,
      totalDifference,
    },
  });
}
