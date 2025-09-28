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
 */
export async function getCachedInventory(
  params: InventoryQueryParams
): Promise<PaginatedResponse<Inventory> | null> {
  const cacheKey = buildCacheKey('inventory:list', params);
  return getOrSetJSON(cacheKey, null);
}

/**
 * 设置库存列表缓存
 */
export async function setCachedInventory(
  params: InventoryQueryParams,
  data: PaginatedResponse<Inventory>
): Promise<void> {
  const cacheKey = buildCacheKey('inventory:list', params);
  await getOrSetJSON(
    cacheKey,
    () => Promise.resolve(data),
    cacheConfig.inventoryTtl
  );
}

/**
 * 库存汇总类型定义
 */
export interface InventorySummary {
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
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
 */
export async function getBatchCachedInventorySummary(
  productIds: string[]
): Promise<Map<string, InventorySummary>> {
  if (productIds.length === 0) return new Map();

  const inventoryMap = new Map<string, InventorySummary>();
  const uncachedIds: string[] = [];

  // 批量从缓存获取，避免 N+1 查询
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

    // 处理查询结果并设置缓存
    const setCachePromises = inventorySummary.map(async item => {
      const summary: InventorySummary = {
        totalQuantity: item._sum.quantity || 0,
        reservedQuantity: item._sum.reservedQuantity || 0,
        availableQuantity:
          (item._sum.quantity || 0) - (item._sum.reservedQuantity || 0),
      };

      inventoryMap.set(item.productId, summary);

      // 异步设置缓存
      const cacheKey = `inventory:summary:${item.productId}`;
      getOrSetJSON(cacheKey, async () => summary, cacheConfig.inventoryTtl);
    });

    await Promise.all(setCachePromises);

    // 为没有库存记录的产品设置默认值
    uncachedIds.forEach(productId => {
      if (!inventoryMap.has(productId)) {
        const defaultSummary: InventorySummary = {
          totalQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
        };
        inventoryMap.set(productId, defaultSummary);

        // 异步设置缓存
        const cacheKey = `inventory:summary:${productId}`;
        getOrSetJSON(
          cacheKey,
          async () => defaultSummary,
          cacheConfig.inventoryTtl
        );
      }
    });
  }

  return inventoryMap;
}

/**
 * 清除库存相关缓存
 * 修复：完善缓存失效策略，确保相关统计数据一致性
 */
export async function invalidateInventoryCache(
  productId?: string
): Promise<void> {
  if (productId) {
    // 清除特定产品的库存汇总缓存
    await invalidateNamespace(`inventory:summary:${productId}`);
  }

  // 修复：清除所有相关的缓存，确保数据一致性
  const cachePatterns = [
    'inventory:list:*', // 库存列表缓存
    'inventory:stats:*', // 库存统计缓存
    'inventory:summary:*', // 库存汇总缓存（如果没有指定productId）
    'finance:receivables:*', // 财务应收账款缓存（库存变更可能影响订单状态）
    'dashboard:stats:*', // 仪表盘统计缓存
  ];

  // 并行清除所有相关缓存
  await Promise.all(cachePatterns.map(pattern => invalidateNamespace(pattern)));
}

/**
 * 清除所有库存缓存
 */
export async function clearAllInventoryCache(): Promise<void> {
  await invalidateNamespace('inventory:*');
}
