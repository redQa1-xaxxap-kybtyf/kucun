/**
 * 库存变体和批次映射工具
 * 用于将销售订单中的色号(colorCode)和生产日期(productionDate)
 * 映射到库存表的variantId和batchNumber字段
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { toNumberOrNull } from '@/lib/utils/number';

/**
 * 库存查询条件构建器
 */
export interface InventoryQueryBuilder {
  productId: string;
  variantId?: string | null;
  batchNumber?: string | null;
  minQuantity?: number;
}

/**
 * 将色号映射到产品变体ID
 * @param productId 产品ID
 * @param colorCode 色号
 * @returns 变体ID，如果没有找到则返回null
 */
export async function mapColorCodeToVariantId(
  productId: string,
  colorCode?: string | null
): Promise<string | null> {
  if (!colorCode) {
    return null;
  }

  // 查找匹配的产品变体
  const variant = await prisma.productVariant.findFirst({
    where: {
      productId,
      colorCode,
    },
    select: {
      id: true,
    },
  });

  return variant?.id || null;
}

/**
 * 将生产日期映射到批次号
 * @param productionDate 生产日期 (YYYY-MM-DD格式)
 * @returns 批次号，使用生产日期作为批次号
 */
export function mapProductionDateToBatchNumber(
  productionDate?: string | null
): string | null {
  if (!productionDate) {
    return null;
  }

  // 将生产日期转换为批次号格式
  // 例如: "2024-01-15" -> "BATCH-20240115"
  const dateStr = productionDate.replace(/-/g, '');
  return `BATCH-${dateStr}`;
}

/**
 * 构建库存查询条件（包含变体和批次映射）
 * @param productId 产品ID
 * @param colorCode 色号（可选）
 * @param productionDate 生产日期（可选）
 * @param minQuantity 最小数量要求（可选）
 * @returns Prisma查询条件
 */
export async function buildInventoryWhereCondition(
  productId: string,
  colorCode?: string | null,
  productionDate?: string | null,
  minQuantity?: number,
  explicitBatchNumber?: string | null
): Promise<Prisma.InventoryWhereInput> {
  const where: Prisma.InventoryWhereInput = {
    productId,
  };

  // 映射色号到变体ID
  if (colorCode) {
    const variantId = await mapColorCodeToVariantId(productId, colorCode);
    if (variantId) {
      where.variantId = variantId;
    }
  }

  // 批次优先级：
  // 1) 显式指定的批次号（例如销售订单明细上的 batchNumber）
  // 2) 根据生产日期推导的批次号
  if (explicitBatchNumber && explicitBatchNumber.trim().length > 0) {
    where.batchNumber = explicitBatchNumber.trim();
  } else if (productionDate) {
    const batchNumber = mapProductionDateToBatchNumber(productionDate);
    if (batchNumber) {
      where.batchNumber = batchNumber;
    }
  }

  // 添加数量条件
  if (minQuantity !== undefined && minQuantity > 0) {
    where.quantity = { gte: minQuantity };
  }

  return where;
}

/**
 * 查找可用库存（考虑变体和批次）
 * @param productId 产品ID
 * @param colorCode 色号
 * @param productionDate 生产日期
 * @param requiredQuantity 需要的数量
 * @returns 库存记录，如果没有找到则返回null
 */
export async function findAvailableInventory(
  productId: string,
  requiredQuantity: number,
  options: {
    colorCode?: string | null;
    productionDate?: string | null;
    batchNumber?: string | null;
    tx?: Prisma.TransactionClient;
  } = {}
): Promise<{
  id: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number;
  reservedQuantity: number;
  updatedAt: Date;
  unitCost: number | null;
  location: string | null;
} | null> {
  const { colorCode, productionDate, batchNumber, tx } = options;
  const db = tx || prisma;

  const where = await buildInventoryWhereCondition(
    productId,
    colorCode,
    productionDate,
    requiredQuantity,
    batchNumber
  );

  // 查找第一条满足条件的库存记录（FIFO策略）
  const inventory = await db.inventory.findFirst({
    where,
    orderBy: {
      updatedAt: 'asc', // 先进先出
    },
    select: {
      id: true,
      productId: true,
      variantId: true,
      batchNumber: true,
      quantity: true,
      reservedQuantity: true,
      updatedAt: true,
      unitCost: true,
      location: true,
    },
  });

  if (!inventory) {
    return null;
  }

  return {
    ...inventory,
    unitCost: toNumberOrNull(inventory.unitCost),
  };
}

/**
 * 批量查找可用库存
 * @param items 订单明细项列表
 * @param tx 事务客户端（可选）
 * @returns 库存记录映射 (productId -> inventory)
 */
export async function findAvailableInventoryBatch(
  items: Array<{
    productId: string;
    quantity: number;
    colorCode?: string | null;
    productionDate?: string | null;
  }>,
  tx?: Prisma.TransactionClient
): Promise<
  Map<string, NonNullable<Awaited<ReturnType<typeof findAvailableInventory>>>>
> {
  const inventoryMap = new Map();

  for (const item of items) {
    const inventory = await findAvailableInventory(
      item.productId,
      item.quantity,
      {
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        tx,
      }
    );

    if (inventory) {
      // 使用复合键: productId-colorCode-productionDate
      const key = `${item.productId}-${item.colorCode || 'null'}-${item.productionDate || 'null'}`;
      inventoryMap.set(key, inventory);
    }
  }

  return inventoryMap;
}

/**
 * 验证库存是否足够（考虑预留量）
 * @param inventory 库存记录
 * @param requiredQuantity 需要的数量
 * @returns 是否足够
 */
export function hasEnoughInventory(
  inventory: {
    quantity: number;
    reservedQuantity: number;
  },
  requiredQuantity: number
): boolean {
  const availableQuantity = inventory.quantity - inventory.reservedQuantity;
  return availableQuantity >= requiredQuantity;
}

/**
 * 计算可用库存数量
 * @param inventory 库存记录
 * @returns 可用数量
 */
export function getAvailableQuantity(inventory: {
  quantity: number;
  reservedQuantity: number;
}): number {
  return Math.max(0, inventory.quantity - inventory.reservedQuantity);
}

/**
 * 类型守卫：检查是否为有效的库存记录
 */
export function isValidInventory(
  inventory: unknown
): inventory is NonNullable<
  Awaited<ReturnType<typeof findAvailableInventory>>
> {
  return (
    inventory !== null &&
    typeof inventory === 'object' &&
    'id' in inventory &&
    'quantity' in inventory &&
    'reservedQuantity' in inventory
  );
}
