import {
  buildCacheKey,
  getOrSetJSON,
  invalidateNamespace,
} from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import { redis } from '@/lib/redis/redis-client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

/**
 * 库存缓存管理
 * 提供库存数据的缓存策略和失效管理
 */

/**
 * 获取缓存的库存列表
 *
 * @deprecated 已废弃 - 库存列表不应该缓存，应该直接查询数据库
 * 库存数据变化频繁，用户期望看到实时数据，缓存会导致数据不一致
 *
 * 推荐做法：在 API 路由中直接使用 getOrSetJSON，设置极短 TTL（如5-10秒）
 * 或完全不缓存，使用数据库查询优化（索引、分页、字段选择）
 */
export async function getCachedInventory(
  params: InventoryQueryParams
): Promise<PaginatedResponse<Inventory> | null> {
  // 返回 null，强制调用方直接查询数据库
  return null;
}

/**
 * 设置库存列表缓存
 *
 * @deprecated 已废弃 - 库存列表不应该缓存
 * 该函数已停用，不会设置任何缓存
 */
export async function setCachedInventory(
  params: InventoryQueryParams,
  data: PaginatedResponse<Inventory>
): Promise<void> {
  // 空实现 - 不再缓存列表数据
  // 如果确实需要短期缓存，请在 API 路由中直接使用 getOrSetJSON
}

/**
 * 库存汇总类型定义
 */
export interface InventoryBatch {
  batchNumber: string;
  quantity: number;
}

export interface InventorySummary {
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  batches?: InventoryBatch[];
}

/**
 * 获取产品库存汇总缓存
 */
export async function getCachedProductInventorySummary(
  productId: string
): Promise<InventorySummary | null> {
  const cacheKey = `inventory:summary:${productId}`;
  return getOrSetJSON(
    cacheKey,
    async () => {
      const summary = await prisma.inventory.aggregate({
        where: { productId },
        _sum: {
          quantity: true,
          reservedQuantity: true,
        },
      });

      const totalQuantity = summary._sum.quantity || 0;
      const reservedQuantity = summary._sum.reservedQuantity || 0;

      return {
        totalQuantity,
        reservedQuantity,
        availableQuantity: totalQuantity - reservedQuantity,
      };
    },
    cacheConfig.inventoryTtl
  );
}

/**
 * 批量获取产品库存汇总缓存
 * 优化说明：
 * - Redis 可用时：批量从 Redis 获取，未命中的从数据库查询并回填缓存
 * - Redis 不可用时：checkRedisAvailability 会快速失败（30秒缓存），直接查询数据库
 */
export async function getBatchCachedInventorySummary(
  productIds: string[]
): Promise<Map<string, InventorySummary>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const inventoryMap = new Map<string, InventorySummary>();
  const uncachedIds: string[] = [];

  // 批量从缓存获取
  // 由于 checkRedisAvailability 的修复，如果 Redis 不可用，
  // 第一次调用会设置 lastRedisCheckTime，后续调用会在 30 秒内直接返回 false
  const cacheKeys = productIds.map(id => `inventory:summary:${id}`);
  const cachedResults = await Promise.all(
    cacheKeys.map(async (key, index) => {
      const productId = productIds[index];
      try {
        const cached = await redis.getJson<InventorySummary>(key);
        return { productId, cached };
      } catch {
        return { productId, cached: null };
      }
    })
  );

  // 分离已缓存和未缓存的产品ID
  cachedResults.forEach(({ productId, cached }) => {
    if (cached) {
      inventoryMap.set(productId, cached);
    } else {
      uncachedIds.push(productId);
    }
  });

  // 对于未缓存的数据，批量查询数据库
  if (uncachedIds.length > 0) {
    // 查询汇总数据
    const inventorySummary = await prisma.inventory.groupBy({
      by: ['productId'],
      where: {
        productId: { in: uncachedIds },
      },
      _sum: {
        quantity: true,
        reservedQuantity: true,
      },
    });

    // 查询批次明细
    const inventoryBatches = await prisma.inventory.findMany({
      where: {
        productId: { in: uncachedIds },
        quantity: { gt: 0 }, // 只查询有库存的批次
        batchNumber: { not: null }, // 只查询有批次号的记录
      },
      select: {
        productId: true,
        batchNumber: true,
        quantity: true,
      },
      orderBy: {
        batchNumber: 'asc',
      },
    });

    // 按产品ID和批次号分组并汇总数量（处理同一产品同一批次可能有多条记录的情况）
    const batchesByProduct = inventoryBatches.reduce(
      (acc, item) => {
        if (!item.batchNumber) return acc; // 跳过没有批次号的记录

        if (!acc[item.productId]) {
          acc[item.productId] = {};
        }

        // 如果这个批次号已经存在，累加数量；否则创建新记录
        if (acc[item.productId][item.batchNumber]) {
          acc[item.productId][item.batchNumber].quantity += item.quantity;
        } else {
          acc[item.productId][item.batchNumber] = {
            batchNumber: item.batchNumber,
            quantity: item.quantity,
          };
        }

        return acc;
      },
      {} as Record<string, Record<string, InventoryBatch>>
    );

    // 转换为数组格式
    const batchesArrayByProduct = Object.entries(batchesByProduct).reduce(
      (acc, [productId, batchesMap]) => {
        acc[productId] = Object.values(batchesMap).sort((a, b) =>
          a.batchNumber.localeCompare(b.batchNumber)
        );
        return acc;
      },
      {} as Record<string, InventoryBatch[]>
    );

    // 处理查询结果并设置缓存
    const setCachePromises = inventorySummary.map(async item => {
      const summary: InventorySummary = {
        totalQuantity: item._sum.quantity || 0,
        reservedQuantity: item._sum.reservedQuantity || 0,
        availableQuantity:
          (item._sum.quantity || 0) - (item._sum.reservedQuantity || 0),
        batches: batchesArrayByProduct[item.productId] || [],
      };

      inventoryMap.set(item.productId, summary);

      // 同步设置缓存
      const cacheKey = `inventory:summary:${item.productId}`;
      await getOrSetJSON(
        cacheKey,
        async () => summary,
        cacheConfig.inventoryTtl
      );
    });

    await Promise.all(setCachePromises);

    // 为没有库存记录的产品设置默认值
    const defaultCachePromises = uncachedIds
      .filter(productId => !inventoryMap.has(productId))
      .map(async productId => {
        const defaultSummary: InventorySummary = {
          totalQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          batches: [],
        };
        inventoryMap.set(productId, defaultSummary);

        // 同步设置缓存
        const cacheKey = `inventory:summary:${productId}`;
        await getOrSetJSON(
          cacheKey,
          async () => defaultSummary,
          cacheConfig.inventoryTtl
        );
      });

    await Promise.all(defaultCachePromises);
  }

  return inventoryMap;
}

/**
 * 清除库存相关缓存 - 精准失效策略
 *
 * 修复说明：
 * - 单个产品库存变更时，只清除该产品相关的缓存
 * - 移除了过度失效的 finance:receivables 和 dashboard:stats
 * - 列表缓存已改为直接查询（不缓存），无需失效
 * - 使用 revalidate.ts 的级联失效机制处理相关缓存
 *
 * @param productId 产品ID（可选）
 * @param options 失效选项
 */
export async function invalidateInventoryCache(
  productId?: string,
  options?: {
    /** 是否失效仪表盘缓存（默认false，由级联失效处理） */
    invalidateDashboard?: boolean;
  }
): Promise<void> {
  const { invalidateDashboard = false } = options || {};

  if (productId) {
    // 精准失效：只清除特定产品的库存汇总缓存
    await invalidateNamespace(`inventory:summary:${productId}`);
  } else {
    // 全局失效：清除所有库存汇总缓存
    await invalidateNamespace('inventory:summary:*');
  }

  // 库存列表已改为直接查询（使用极短TTL），不需要主动失效
  // 列表缓存会在60秒内自动过期，避免缓存雪崩

  // 可选：失效仪表盘缓存（仅在明确需要时）
  // 通常由 revalidate.ts 的级联失效机制自动处理
  if (invalidateDashboard) {
    await invalidateNamespace('dashboard:stats:*');
  }
}

/**
 * 清除所有库存缓存
 */
export async function clearAllInventoryCache(): Promise<void> {
  await invalidateNamespace('inventory:*');
}
