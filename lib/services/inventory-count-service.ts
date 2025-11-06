// 库存盘点服务层
// 提供库存盘点的创建、查询、更新和删除功能

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountStatus,
  type CreateInventoryCountRequest,
  type InventoryCount,
  type InventoryCountItem,
  type InventoryCountListItem,
  type InventoryCountQueryParams,
  type InventoryCountStatistics,
  type SubmitCountDataRequest,
  type UpdateInventoryCountRequest,
} from '@/lib/types/inventory-count';

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
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
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
      approver: {
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
      items: {
        include: {
          product: true,
          variant: true,
          counter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!count) {
    return null;
  }

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
    approver: count.approver || undefined,
    category: count.category || undefined,
    items: count.items.map(
      (item): InventoryCountItem => ({
        id: item.id,
        countId: item.countId,
        productId: item.productId,
        variantId: item.variantId || undefined,
        batchNumber: item.batchNumber || undefined,
        systemQuantity: item.systemQuantity,
        actualQuantity: item.actualQuantity || undefined,
        difference: item.difference,
        status: item.status as InventoryCountItem['status'],
        unitCost: item.unitCost || undefined,
        totalCost: item.totalCost || undefined,
        location: item.location || undefined,
        remarks: item.remarks || undefined,
        countedBy: item.countedBy || undefined,
        countedAt: item.countedAt?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        product: {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          unit: item.product.unit as 'piece' | 'sheet',
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              colorCode: item.variant.colorCode,
              colorName: item.variant.colorName || undefined,
              sku: item.variant.sku,
            }
          : undefined,
        counter: item.counter || undefined,
      })
    ),
  };
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
  await prisma.$transaction(async tx => {
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
          systemQuantity: true,
          unitCost: true,
        },
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
            countedAt: now,
            remarks: item.remarks ?? null,
          },
        });
      }
    }

    // 重新计算盘点计划的统计信息
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

    // 更新盘点计划统计
    await tx.inventoryCount.update({
      where: { id: countId },
      data: {
        completedItems,
        differenceItems,
        totalDifference,
      },
    });
  });

  return {
    success: true,
    message: `成功提交 ${data.items.length} 条盘点数据`,
  };
}

/**
 * 完成盘点
 */
export async function completeCount(
  countId: string,
  _userId: string
): Promise<InventoryCount> {
  // 验证盘点计划是否存在
  const existingCount = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    include: {
      items: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!existingCount) {
    throw new Error('盘点计划不存在');
  }

  // 只有进行中状态可以完成盘点
  if (existingCount.status !== 'in_progress') {
    throw new Error('只有进行中状态的盘点计划可以完成');
  }

  // 验证所有明细是否已盘点
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

  const totalDifferenceCost = itemsResult._sum.totalCost || 0;

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
