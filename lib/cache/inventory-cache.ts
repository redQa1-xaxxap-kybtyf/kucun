import {
  getOrSetJSON,
  getRandomTTL,
  invalidateNamespace,
} from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

import { revalidateInventory } from './revalidate';

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
  _params: InventoryQueryParams
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
  _params: InventoryQueryParams,
  _data: PaginatedResponse<Inventory>
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
  reservedQuantity?: number;
  availableQuantity?: number;
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
  const namespace = redis.getConfig().namespace;

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

    // 查询批次明细（按产品+批次聚合，避免拉全量库存记录）
    const inventoryBatches = await prisma.inventory.groupBy({
      by: ['productId', 'batchNumber'],
      where: {
        productId: { in: uncachedIds },
        quantity: { gt: 0 }, // 只查询有库存的批次
        batchNumber: { not: null }, // 只查询有批次号的记录
      },
      _sum: {
        quantity: true,
        reservedQuantity: true,
      },
    });

    const batchesArrayByProduct = inventoryBatches.reduce(
      (acc, item) => {
        if (!item.batchNumber) return acc;

        const quantity = item._sum.quantity || 0;
        const reservedQuantity = item._sum.reservedQuantity || 0;
        const availableQuantity = Math.max(quantity - reservedQuantity, 0);
        if (!acc[item.productId]) {
          acc[item.productId] = [];
        }

        acc[item.productId].push({
          batchNumber: item.batchNumber,
          quantity,
          reservedQuantity,
          availableQuantity,
        });

        return acc;
      },
      {} as Record<string, InventoryBatch[]>
    );

    for (const batches of Object.values(batchesArrayByProduct)) {
      batches.sort((a, b) => a.batchNumber.localeCompare(b.batchNumber));
    }

    // 处理查询结果并设置缓存
    const summaryByProductId = new Map<
      string,
      { totalQuantity: number; reservedQuantity: number }
    >();
    for (const item of inventorySummary) {
      summaryByProductId.set(item.productId, {
        totalQuantity: item._sum.quantity || 0,
        reservedQuantity: item._sum.reservedQuantity || 0,
      });
    }

    const toCache: Array<{ productId: string; summary: InventorySummary }> = [];

    for (const productId of uncachedIds) {
      const totals = summaryByProductId.get(productId);
      const totalQuantity = totals?.totalQuantity ?? 0;
      const reservedQuantity = totals?.reservedQuantity ?? 0;

      const summary: InventorySummary = {
        totalQuantity,
        reservedQuantity,
        availableQuantity: totalQuantity - reservedQuantity,
        batches: batchesArrayByProduct[productId] || [],
      };

      inventoryMap.set(productId, summary);
      toCache.push({ productId, summary });
    }

    const keysToWatch = toCache.map(
      ({ productId }) => `${namespace}:inventory:summary:${productId}`
    );

    const writeCacheAtomically = async (): Promise<void> => {
      const MAX_RETRIES = 5;
      let execAbortedCount = 0;
      let conflictRetryCount = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const client = redis.getClient();
        try {
          await client.watch(...keysToWatch);
          const pipeline = client.multi();

          for (const { productId, summary } of toCache) {
            const key = `${namespace}:inventory:summary:${productId}`;
            const ttl = getRandomTTL(cacheConfig.inventoryTtl);
            pipeline.set(key, JSON.stringify(summary), 'EX', ttl);
          }

          const execResult = await pipeline.exec();
          if (execResult) {
            if (execAbortedCount > 0) {
              logger.info(
                'inventory-cache',
                '库存汇总缓存写入并发冲突已解决',
                undefined,
                {
                  conflictRetryCount,
                  execAbortedCount,
                }
              );
            }
            return;
          }

          execAbortedCount += 1;
          conflictRetryCount += 1;
          logger.warn(
            'inventory-cache',
            '库存汇总缓存写入发生并发冲突，准备重试',
            undefined,
            {
              conflictRetryCount,
              execAbortedCount,
            }
          );
        } catch (error) {
          logger.error('inventory-cache', '库存汇总缓存写入失败', error);
          return;
        } finally {
          try {
            await client.unwatch();
          } catch {
            // 忽略 unwatch 失败，避免影响业务返回
          }
        }

        if (attempt < MAX_RETRIES) {
          const delay = 20 + Math.floor(Math.random() * 61); // 20-80ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      logger.warn(
        'inventory-cache',
        '库存汇总缓存写入多次冲突，已放弃缓存回填',
        undefined,
        {
          conflictRetryCount,
          execAbortedCount,
        }
      );
    };

    if (toCache.length > 0) {
      await writeCacheAtomically();
    }
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
  await revalidateInventory(productId);

  // 可选：失效仪表盘缓存（仅在明确需要时）
  // 默认已刷新 dashboard:stats；这里保留更宽范围的强制清理入口
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
