// 库存盘点服务层
// 提供库存盘点的创建、查询、更新和删除功能

import type { Prisma } from '@prisma/client';

import { generateInboundRecordNumber } from '@/lib/api/inbound-handlers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  addToFIFOQueue,
  consumeFIFOQueueByBatch,
  getWeightedAverageCostFromFIFO,
} from '@/lib/services/fifo-cost-service';
import { getInventoryCountById as getInventoryCountDetailById } from '@/lib/services/inventory-count/queries';
import {
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountStatus,
  type CreateInventoryCountRequest,
  type InventoryCount,
  type InventoryCountListItem,
  type InventoryCountQueryParams,
  type InventoryCountStatistics,
  type SubmitCountDataRequest,
  type UpdateInventoryCountRequest,
} from '@/lib/types/inventory-count';
import { generateAdjustmentNumber } from '@/lib/utils/adjustment-number-generator';
import { toNumber } from '@/lib/utils/number';

const roundCurrency = (value: number): number =>
  Math.round(Number(value || 0) * 100) / 100;

/**
 * 生成盘点编号
 * 格式：COUNT-YYYYMMDD-序号
 * 例如：COUNT-20251103-001
 */
export async function generateCountNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;

  // 获取当前日期（YYYYMMDD格式）
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 查询今天已有的最大序号
  const prefix = `COUNT-${dateStr}-`;
  const lastRecord = await db.inventoryCount.findFirst({
    where: {
      countNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      countNumber: 'desc',
    },
    select: {
      countNumber: true,
    },
  });

  let sequence = 1;
  if (lastRecord) {
    // 从最后一条记录中提取序号
    const lastSequence = parseInt(
      lastRecord.countNumber.substring(prefix.length),
      10
    );
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  // 生成新的盘点编号（序号补齐3位）
  const sequenceStr = String(sequence).padStart(3, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * 创建盘点计划
 */
export async function createInventoryCount(
  data: CreateInventoryCountRequest,
  userId: string
): Promise<InventoryCount> {
  // 使用事务确保单号生成和记录创建的原子性
  const count = await prisma.$transaction(async tx => {
    // 在事务内生成盘点编号
    const countNumber = await generateCountNumber(tx);

    // 如果提供了盘点明细，需要从库存表获取系统数量
    let itemsData: Prisma.InventoryCountItemCreateManyCountInput[] = [];
    if (data.items && data.items.length > 0) {
      // 批量查询库存信息
      const inventoryRecords = await tx.inventory.findMany({
        where: {
          OR: data.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId || null,
            batchNumber: item.batchNumber || null,
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
        take: data.items.length,
      });

      // 创建库存映射
      const inventoryMap = new Map(
        inventoryRecords.map(inv => [
          `${inv.productId}-${inv.variantId || ''}-${inv.batchNumber || ''}`,
          inv,
        ])
      );

      // 构建盘点明细数据
      itemsData = data.items.map(item => {
        const key = `${item.productId}-${item.variantId || ''}-${item.batchNumber || ''}`;
        const inventory = inventoryMap.get(key);
        const systemQuantity = inventory?.quantity ?? 0;
        const actualQuantity = item.actualQuantity ?? null;
        const unitCost = inventory?.unitCost ?? null;

        return {
          productId: item.productId,
          variantId: item.variantId || null,
          batchNumber: item.batchNumber || null,
          systemQuantity,
          actualQuantity,
          difference: 0,
          status: 'pending',
          unitCost,
          totalCost: null,
          location: item.location ?? inventory?.location ?? null,
          remarks: item.remarks || null,
          countedBy: null,
          countedAt: null,
        };
      });
    }

    // 创建盘点计划
    const createdCount = await tx.inventoryCount.create({
      data: {
        countNumber,
        countName: data.countName,
        countType: data.countType,
        status: 'draft',
        planDate: new Date(data.planDate),
        location: data.location || null,
        categoryId: data.categoryId || null,
        remarks: data.remarks || null,
        attachments: data.attachments || null,
        totalItems: itemsData.length,
        completedItems: 0,
        differenceItems: 0,
        totalDifference: 0,
        creatorId: userId,
        operatorId: null,
        approverId: null,
        approvedAt: null,
        startDate: null,
        endDate: null,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // 如果有盘点明细，批量创建
    if (itemsData.length > 0) {
      await tx.inventoryCountItem.createMany({
        data: itemsData.map(item => ({
          ...item,
          countId: createdCount.id,
        })),
      });
    }

    return createdCount;
  });

  // 转换为 InventoryCount 类型
  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    status: count.status as CountStatus,
    location: count.location || undefined,
    categoryId: count.categoryId || undefined,
    planDate: count.planDate.toISOString(),
    startDate: count.startDate?.toISOString(),
    endDate: count.endDate?.toISOString(),
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    totalDifference: count.totalDifference,
    remarks: count.remarks || undefined,
    attachments: count.attachments || undefined,
    creatorId: count.creatorId,
    operatorId: count.operatorId || undefined,
    approverId: count.approverId || undefined,
    approvedAt: count.approvedAt?.toISOString(),
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    creator: count.creator,
    category: count.category || undefined,
  };
}

/**
 * 获取盘点计划列表
 */
export async function getInventoryCounts(
  query: InventoryCountQueryParams = {}
): Promise<{
  counts: InventoryCountListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const {
    page = 1,
    pageSize = 20,
    status,
    countType,
    location,
    categoryId,
    startDate,
    endDate,
    sortBy = 'planDate',
    sortOrder = 'desc',
  } = query;

  const skip = (page - 1) * pageSize;

  // 构建查询条件
  const where: Prisma.InventoryCountWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (countType) {
    where.countType = countType;
  }

  if (location) {
    where.location = {
      contains: location,
    };
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (startDate || endDate) {
    where.planDate = {};
    if (startDate) {
      where.planDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.planDate.lte = new Date(endDate);
    }
  }

  // 查询总数
  const total = await prisma.inventoryCount.count({ where });

  // 查询记录
  const countsData = await prisma.inventoryCount.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // 转换为 InventoryCountListItem 类型
  const counts: InventoryCountListItem[] = countsData.map(count => ({
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    countTypeName:
      COUNT_TYPE_LABELS[count.countType as InventoryCount['countType']],
    status: count.status as CountStatus,
    statusName: COUNT_STATUS_LABELS[count.status as CountStatus],
    planDate: count.planDate.toISOString().split('T')[0],
    location: count.location || undefined,
    categoryName: count.category?.name,
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    progress:
      count.totalItems > 0
        ? Math.round((count.completedItems / count.totalItems) * 100)
        : 0,
    creatorName: count.creator.name,
    createdAt: count.createdAt.toISOString(),
  }));

  return {
    counts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 获取盘点计划详情
 */
export async function getInventoryCountById(
  id: string
): Promise<InventoryCount | null> {
  // ✅ 复用新版查询服务，保证与前端 Query 模块逻辑一致（含批次每件片数处理）
  const detail = await getInventoryCountDetailById(id);
  return detail ?? null;
}

/**
 * 更新盘点计划
 */
export async function updateInventoryCount(
  id: string,
  data: UpdateInventoryCountRequest,
  _userId: string
): Promise<InventoryCount> {
  // 验证盘点计划是否存在
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  // 只有草稿状态可以更新基本信息
  if (existingCount.status !== 'draft' && Object.keys(data).length > 1) {
    throw new Error('只有草稿状态的盘点计划可以更新');
  }

  const count = await prisma.inventoryCount.update({
    where: { id },
    data: {
      ...(data.countName && { countName: data.countName }),
      ...(data.countType && { countType: data.countType }),
      ...(data.planDate && { planDate: new Date(data.planDate) }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.status && { status: data.status }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
      ...(data.attachments !== undefined && { attachments: data.attachments }),
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // 转换为 InventoryCount 类型
  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    status: count.status as CountStatus,
    location: count.location || undefined,
    categoryId: count.categoryId || undefined,
    planDate: count.planDate.toISOString(),
    startDate: count.startDate?.toISOString(),
    endDate: count.endDate?.toISOString(),
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    totalDifference: count.totalDifference,
    remarks: count.remarks || undefined,
    attachments: count.attachments || undefined,
    creatorId: count.creatorId,
    operatorId: count.operatorId || undefined,
    approverId: count.approverId || undefined,
    approvedAt: count.approvedAt?.toISOString(),
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    creator: count.creator,
    category: count.category || undefined,
  };
}

/**
 * 删除盘点计划
 */
export async function deleteInventoryCount(
  id: string,
  _userId: string
): Promise<void> {
  // 验证盘点计划是否存在
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  // 只有草稿状态可以删除
  if (existingCount.status !== 'draft') {
    throw new Error('只有草稿状态的盘点计划可以删除');
  }

  await prisma.inventoryCount.delete({
    where: { id },
  });
}

/**
 * 添加盘点明细
 */
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
  // 验证盘点计划是否存在
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    select: { status: true },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  // 只有草稿状态可以添加明细
  if (existingCount.status !== 'draft') {
    throw new Error('只有草稿状态的盘点计划可以添加明细');
  }

  // 使用事务批量创建盘点明细
  const result = await prisma.$transaction(async tx => {
    // 批量查询库存信息
    const inventoryRecords = await tx.inventory.findMany({
      where: {
        OR: items.map(item => ({
          productId: item.productId,
          variantId: item.variantId || null,
          batchNumber: item.batchNumber || null,
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
      take: items.length,
    });

    // 创建库存映射
    const inventoryMap = new Map(
      inventoryRecords.map(inv => [
        `${inv.productId}-${inv.variantId || ''}-${inv.batchNumber || ''}`,
        inv,
      ])
    );

    // 构建盘点明细数据
    const itemsData = items.map(item => {
      const key = `${item.productId}-${item.variantId || ''}-${item.batchNumber || ''}`;
      const inventory = inventoryMap.get(key);

      return {
        countId,
        productId: item.productId,
        variantId: item.variantId || null,
        batchNumber: item.batchNumber || null,
        systemQuantity: inventory?.quantity || 0,
        actualQuantity: null,
        difference: 0,
        status: 'pending',
        unitCost: inventory?.unitCost || null,
        totalCost: null,
        location: item.location || inventory?.location || null,
        remarks: item.remarks || null,
        countedBy: null,
        countedAt: null,
      };
    });

    // 批量创建盘点明细
    await tx.inventoryCountItem.createMany({
      data: itemsData,
    });

    // 更新盘点计划的总项目数
    await tx.inventoryCount.update({
      where: { id: countId },
      data: {
        totalItems: {
          increment: items.length,
        },
      },
    });

    return items.length;
  });

  return {
    success: true,
    message: `成功添加 ${result} 条盘点明细`,
    addedCount: result,
  };
}

/**
 * 开始盘点
 */
export async function startCount(
  countId: string,
  userId: string
): Promise<InventoryCount> {
  // 验证盘点计划是否存在
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    select: { status: true },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  // 只有草稿状态可以开始盘点
  if (existingCount.status !== 'draft') {
    throw new Error('只有草稿状态的盘点计划可以开始');
  }

  const count = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'in_progress',
      startDate: new Date(),
      operatorId: userId,
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // 转换为 InventoryCount 类型
  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    status: count.status as CountStatus,
    location: count.location || undefined,
    categoryId: count.categoryId || undefined,
    planDate: count.planDate.toISOString(),
    startDate: count.startDate?.toISOString(),
    endDate: count.endDate?.toISOString(),
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    totalDifference: count.totalDifference,
    remarks: count.remarks || undefined,
    attachments: count.attachments || undefined,
    creatorId: count.creatorId,
    operatorId: count.operatorId || undefined,
    approverId: count.approverId || undefined,
    approvedAt: count.approvedAt?.toISOString(),
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    creator: count.creator,
    operator: count.operator || undefined,
    category: count.category || undefined,
  };
}

/**
 * 提交盘点数据
 */
export async function submitCountData(
  countId: string,
  data: SubmitCountDataRequest,
  userId: string
): Promise<{ success: boolean; message: string }> {
  logger.info('inventory-count', '提交盘点数据开始', {
    countId,
    userId,
    itemCount: data.items.length,
  });

  try {
    // 验证盘点计划是否存在
    const existingCount = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      select: { status: true },
    });

    if (!existingCount) {
      throw new Error('盘点计划不存在');
    }

    // 只有进行中状态可以提交盘点数据
    if (existingCount.status !== 'in_progress') {
      throw new Error('只有进行中状态的盘点计划可以提交数据');
    }

    // 使用事务批量更新盘点明细
    const updatedStats = await prisma.$transaction(async tx => {
      const now = new Date();
      const itemIds = data.items.map(item => item.id);

      if (itemIds.length > 0) {
        const countItems = await tx.inventoryCountItem.findMany({
          where: {
            id: {
              in: itemIds,
            },
            countId,
          },
          select: {
            id: true,
            productId: true,
            variantId: true,
            systemQuantity: true,
            unitCost: true,
          },
          take: itemIds.length,
        });

        if (countItems.length !== itemIds.length) {
          const foundIds = new Set(countItems.map(item => item.id));
          const missingIds = data.items
            .filter(item => !foundIds.has(item.id))
            .map(item => item.id);
          throw new Error(
            `存在不属于当前盘点计划的明细：${missingIds.join(', ')}`
          );
        }

        const countItemMap = new Map(countItems.map(item => [item.id, item]));
        const fifoCostCache = new Map<string, number>();

        for (const item of data.items) {
          const existingItem = countItemMap.get(item.id);
          if (!existingItem) {
            throw new Error(`盘点明细 ${item.id} 不存在`);
          }

          if (!Number.isFinite(item.actualQuantity)) {
            throw new Error(`盘点明细 ${item.id} 的实际数量无效`);
          }

          const difference = item.actualQuantity - existingItem.systemQuantity;

          const cacheKey = `${existingItem.productId}-${
            existingItem.variantId || ''
          }`;

          let unitCost =
            existingItem.unitCost !== null &&
            existingItem.unitCost !== undefined
              ? Number(existingItem.unitCost)
              : null;

          if (unitCost === null) {
            if (!fifoCostCache.has(cacheKey)) {
              const fifoAvgCost = await getWeightedAverageCostFromFIFO(
                existingItem.productId,
                existingItem.variantId
              );
              fifoCostCache.set(cacheKey, fifoAvgCost);
            }
            const fifoCost = fifoCostCache.get(cacheKey) ?? 0;
            unitCost = fifoCost > 0 ? fifoCost : null;
          }

          const totalCost =
            unitCost !== null ? roundCurrency(difference * unitCost) : null;

          await tx.inventoryCountItem.update({
            where: { id: item.id },
            data: {
              actualQuantity: item.actualQuantity,
              difference,
              unitCost,
              totalCost,
              status: 'counted',
              countedBy: userId,
              countedAt: now,
              remarks: item.remarks ?? null,
            },
          });
        }
      }

      // 重新计算盘点计划的统计信息（聚合，避免拉全量明细）
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

      // 更新盘点计划统计
      await tx.inventoryCount.update({
        where: { id: countId },
        data: {
          completedItems,
          differenceItems,
          totalDifference,
        },
      });

      return {
        completedItems,
        differenceItems,
        totalDifference,
      };
    });

    logger.info('inventory-count', '提交盘点数据完成', {
      countId,
      userId,
      itemCount: data.items.length,
      completedItems: updatedStats.completedItems,
      differenceItems: updatedStats.differenceItems,
      totalDifference: updatedStats.totalDifference,
    });

    return {
      success: true,
      message: `成功提交 ${data.items.length} 条盘点数据`,
    };
  } catch (error) {
    logger.error('inventory-count', '提交盘点数据失败', error, {
      countId,
      userId,
      itemCount: data.items.length,
    });
    throw error;
  }
}

/**
 * 完成盘点（自动调整库存）
 */
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
      const difference = item.difference;

      // 2.1.1 生成调整单号
      const adjustmentNumber = await generateAdjustmentNumber(tx);

      // 2.1.2 确定调整原因（盘盈或盘亏）
      const reason = difference > 0 ? 'surplus' : 'deficit';
      const beforeQuantity = item.systemQuantity;
      const afterQuantity = item.actualQuantity!;

      // 2.1.3 更新库存数量
      const inventories = await tx.inventory.findMany({
        where: {
          productId: item.productId,
          variantId: item.variantId ?? null,
          batchNumber: item.batchNumber ?? null,
        },
        select: {
          id: true,
          reservedQuantity: true,
          unitCost: true,
        },
        take: 2,
      });

      const inventory = inventories[0];

      if (!inventory) {
        throw new Error(
          `库存记录不存在: productId=${item.productId}, variantId=${item.variantId ?? 'null'}, batchNumber=${item.batchNumber ?? 'null'}`
        );
      }

      if (inventories.length > 1) {
        throw new Error(
          `库存记录不唯一: productId=${item.productId}, variantId=${item.variantId ?? 'null'}, batchNumber=${item.batchNumber ?? 'null'}`
        );
      }

      if (afterQuantity < inventory.reservedQuantity) {
        throw new Error(
          `盘点调整后库存(${afterQuantity})不能低于预留数量(${inventory.reservedQuantity})。请先释放预留量或拆分盘点调整。`
        );
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: afterQuantity },
      });

      // 2.1.4 计算调整成本（严格按 FIFO 成本优先）
      let unitCost: number | null =
        item.unitCost !== null && item.unitCost !== undefined
          ? Number(item.unitCost)
          : null;
      let totalCost: number | null = null;

      if (difference > 0) {
        // 盘盈：视为“补录库存”，优先使用已有单价，其次使用 FIFO 队列的加权平均成本
        if (unitCost === null) {
          const fifoAvg = await getWeightedAverageCostFromFIFO(
            item.productId,
            item.variantId
          );
          unitCost = fifoAvg > 0 ? fifoAvg : null;

          if (unitCost === null) {
            if (
              inventory.unitCost !== null &&
              inventory.unitCost !== undefined
            ) {
              unitCost = Number(inventory.unitCost);
            }
          }
        }

        totalCost =
          unitCost !== null ? roundCurrency(difference * unitCost) : null;
      } else if (difference < 0) {
        // 盘亏：按 FIFO 队列逐批次消耗，得到真实差异成本
        const absDiff = Math.abs(difference);

        try {
          const fifoCost = await consumeFIFOQueueByBatch(
            item.productId,
            item.variantId,
            item.batchNumber ?? null,
            absDiff,
            tx
          );

          if (absDiff > 0) {
            unitCost = roundCurrency(fifoCost.totalCost / absDiff);
          }
          // 差异为负数，totalCost 也应为负数
          totalCost = -roundCurrency(fifoCost.totalCost);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('FIFO队列为空')
          ) {
            // FIFO 队列为空时退回到平均成本/库存单价，但仍完成盘点
            const fifoAvg = await getWeightedAverageCostFromFIFO(
              item.productId,
              item.variantId
            );
            unitCost =
              fifoAvg > 0 ? fifoAvg : unitCost !== null ? unitCost : null;

            if (unitCost === null) {
              if (
                inventory.unitCost !== null &&
                inventory.unitCost !== undefined
              ) {
                unitCost = Number(inventory.unitCost);
              }
            }

            totalCost =
              unitCost !== null ? roundCurrency(difference * unitCost) : null;
          } else {
            // 其它 FIFO 错误（如库存数量不足）直接抛出，避免账实不符
            throw error;
          }
        }
      }

      // 2.1.4.1 盘盈时补录 FIFO 队列（视为盘盈入库），确保 FIFO 队列可用量与库存一致
      if (difference > 0 && unitCost !== null) {
        const inboundRecord = await tx.inboundRecord.create({
          data: {
            recordNumber: generateInboundRecordNumber(),
            productId: item.productId,
            variantId: item.variantId,
            batchNumber: item.batchNumber,
            batchSpecificationId: null,
            quantity: difference,
            unitCost,
            totalCost: roundCurrency(difference * unitCost),
            reason: 'surplus',
            remarks: `盘点盘盈自动补录（盘点单：${countId}）`,
            userId,
            purchaseOrderId: null,
            purchaseOrderItemId: null,
            supplierId: null,
          },
        });

        await addToFIFOQueue(
          {
            productId: item.productId,
            variantId: item.variantId,
            batchNumber: item.batchNumber,
            inboundRecordId: inboundRecord.id,
            quantity: difference,
            unitCost,
            inboundDate: new Date(),
          },
          tx
        );
      }

      // 2.1.4 创建调整记录（包含成本信息）
      await tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber,
          productId: item.productId,
          variantId: item.variantId,
          batchNumber: item.batchNumber,
          beforeQuantity,
          adjustQuantity: difference,
          afterQuantity,
          unitCost,
          totalCost,
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
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updatedCount;
  });

  // 转换为 InventoryCount 类型
  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    status: count.status as CountStatus,
    location: count.location || undefined,
    categoryId: count.categoryId || undefined,
    planDate: count.planDate.toISOString(),
    startDate: count.startDate?.toISOString(),
    endDate: count.endDate?.toISOString(),
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    totalDifference: count.totalDifference,
    remarks: count.remarks || undefined,
    attachments: count.attachments || undefined,
    creatorId: count.creatorId,
    operatorId: count.operatorId || undefined,
    approverId: count.approverId || undefined,
    approvedAt: count.approvedAt?.toISOString(),
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    creator: count.creator,
    operator: count.operator || undefined,
    category: count.category || undefined,
  };
}

/**
 * 获取盘点统计数据
 */
export async function getCountStatistics(params: {
  startDate?: string;
  endDate?: string;
  status?: CountStatus;
}): Promise<InventoryCountStatistics> {
  const { startDate, endDate, status } = params;

  // 构建查询条件
  const where: Prisma.InventoryCountWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.planDate = {};
    if (startDate) {
      where.planDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.planDate.lte = new Date(endDate);
    }
  }

  // 1. 计算总览数据
  const aggregateResult = await prisma.inventoryCount.aggregate({
    where,
    _sum: {
      totalItems: true,
      completedItems: true,
      differenceItems: true,
      totalDifference: true,
    },
    _count: {
      id: true,
    },
  });

  const totalCounts = aggregateResult._count.id || 0;
  const totalItems = aggregateResult._sum.totalItems || 0;
  const completedItems = aggregateResult._sum.completedItems || 0;
  const differenceItems = aggregateResult._sum.differenceItems || 0;
  const totalDifference = aggregateResult._sum.totalDifference || 0;

  // 2. 按状态分组统计
  const statusCounts = await prisma.inventoryCount.groupBy({
    by: ['status'],
    where,
    _count: {
      id: true,
    },
  });

  const draftCounts =
    statusCounts.find(s => s.status === 'draft')?._count.id || 0;
  const inProgressCounts =
    statusCounts.find(s => s.status === 'in_progress')?._count.id || 0;
  const completedCounts =
    statusCounts.find(s => s.status === 'completed')?._count.id || 0;

  // 3. 按盘点类型分组统计
  const byTypeRaw = await prisma.inventoryCount.groupBy({
    by: ['countType'],
    where,
    _count: {
      id: true,
    },
  });

  const byType = byTypeRaw.map(item => ({
    countType: item.countType as InventoryCount['countType'],
    countTypeName:
      COUNT_TYPE_LABELS[item.countType as InventoryCount['countType']],
    count: item._count.id,
    percentage:
      totalCounts > 0
        ? Math.round((item._count.id / totalCounts) * 10000) / 100
        : 0,
  }));

  // 4. 计算总差异成本
  const itemsResult = await prisma.inventoryCountItem.aggregate({
    where: {
      count: where,
    },
    _sum: {
      totalCost: true,
    },
  });

  const totalDifferenceCost = toNumber(itemsResult._sum.totalCost, 0);

  return {
    totalCounts,
    draftCounts,
    inProgressCounts,
    completedCounts,
    totalItems,
    completedItems,
    differenceItems,
    totalDifference,
    totalDifferenceCost,
    byType,
    startDate,
    endDate,
  };
}
