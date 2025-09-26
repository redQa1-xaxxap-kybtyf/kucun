import {
  buildCacheKey,
  getOrSetJSON,
  invalidateNamespace,
} from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
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
 * 获取产品库存汇总缓存
 */
export async function getCachedProductInventorySummary(
  productId: string
): Promise<{
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
} | null> {
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
 * 清除库存相关缓存
 */
export async function invalidateInventoryCache(
  productId?: string
): Promise<void> {
  if (productId) {
    // 清除特定产品的库存汇总缓存
    await invalidateNamespace(`inventory:summary:${productId}`);
  }
  // 清除库存列表缓存
  await invalidateNamespace('inventory:list:*');
}

/**
 * 清除所有库存缓存
 */
export async function clearAllInventoryCache(): Promise<void> {
  await invalidateNamespace('inventory:*');
}
