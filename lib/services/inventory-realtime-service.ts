/**
 * 库存实时服务
 * 集成 Redis Pub/Sub 和事务功能，提供实时库存更新和通知
 */
// cspell:ignore hset hincrby hgetall

import { revalidateInventory } from '@/lib/cache/revalidate';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';
import { publish } from '@/lib/redis/redis-pubsub';

/**
 * 库存变更类型
 */
export type InventoryChangeType =
  | 'inbound' // 入库
  | 'outbound' // 出库
  | 'adjustment' // 调整
  | 'reserve' // 预留
  | 'release'; // 释放

/**
 * 库存变更事件
 */
export interface InventoryChangeEvent {
  productId: string;
  variantId?: string;
  type: InventoryChangeType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason?: string;
  userId?: string;
  orderId?: string;
  timestamp: string;
}

/**
 * 更新库存并发布通知
 * 使用事务确保原子性
 *
 * @param productId - 产品ID
 * @param variantId - 变体ID（可选）
 * @param quantity - 变更数量（正数为增加，负数为减少）
 * @param type - 变更类型
 * @param metadata - 额外元数据
 */
export async function updateInventoryWithNotification(
  productId: string,
  variantId: string | null,
  quantity: number,
  type: InventoryChangeType,
  metadata?: {
    reason?: string;
    userId?: string;
    orderId?: string;
  }
): Promise<boolean> {
  if ((type === 'reserve' || type === 'release') && quantity <= 0) {
    throw new Error('预留/释放库存时，数量必须为正数');
  }

  let beforeQuantity = 0;
  let afterQuantity = 0;
  let reservedQuantity = 0;

  try {
    const result = await prisma.$transaction(async tx => {
      const inventory = await tx.inventory.findFirst({
        where: {
          productId,
          variantId: variantId || null,
        },
        select: {
          id: true,
          quantity: true,
          reservedQuantity: true,
        },
      });

      if (!inventory) {
        throw new Error('库存记录不存在');
      }

      const quantityDelta =
        type === 'reserve' || type === 'release' ? 0 : quantity;

      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          ...(type !== 'reserve' &&
            type !== 'release' && {
              quantity: { increment: quantity },
            }),
          ...(type === 'reserve' && {
            reservedQuantity: { increment: quantity },
          }),
          ...(type === 'release' && {
            reservedQuantity: { decrement: quantity },
          }),
        },
        select: {
          quantity: true,
          reservedQuantity: true,
        },
      });

      if (updatedInventory.quantity < 0) {
        throw new Error(
          `并发更新导致库存为负数。当前库存: ${updatedInventory.quantity}, 请重试`
        );
      }

      if (updatedInventory.reservedQuantity < 0) {
        throw new Error(
          `并发更新导致预留数量为负数。当前预留: ${updatedInventory.reservedQuantity}, 请重试`
        );
      }

      if (updatedInventory.quantity < updatedInventory.reservedQuantity) {
        throw new Error(
          `并发更新导致可用库存(${updatedInventory.quantity})低于预留数量(${updatedInventory.reservedQuantity}), 请重试`
        );
      }

      return {
        beforeQuantity: updatedInventory.quantity - quantityDelta,
        afterQuantity: updatedInventory.quantity,
        reservedQuantity: updatedInventory.reservedQuantity,
      };
    });

    beforeQuantity = result.beforeQuantity;
    afterQuantity = result.afterQuantity;
    reservedQuantity = result.reservedQuantity;
  } catch (error) {
    logger.error(
      'inventory-realtime',
      'Failed to update inventory (db)',
      error,
      {
        productId,
        variantId: variantId || undefined,
        quantity,
        type,
      }
    );
    return false;
  }

  const cacheKey = variantId
    ? `inventory:${productId}:${variantId}`
    : `inventory:${productId}`;

  try {
    await redis.transaction(async pipeline => {
      pipeline.hset(cacheKey, 'quantity', afterQuantity);
      pipeline.hset(cacheKey, 'reserved', reservedQuantity.toString());
      pipeline.hset(cacheKey, 'updatedAt', new Date().toISOString());
      return pipeline.exec();
    });
  } catch (error) {
    logger.error(
      'inventory-realtime',
      'Failed to update inventory cache',
      error,
      {
        productId,
        variantId: variantId || undefined,
      }
    );
  }

  const event: InventoryChangeEvent = {
    productId,
    variantId: variantId || undefined,
    type,
    quantity,
    beforeQuantity,
    afterQuantity,
    reason: metadata?.reason,
    userId: metadata?.userId,
    orderId: metadata?.orderId,
    timestamp: new Date().toISOString(),
  };

  try {
    await Promise.all([
      publish(`inventory:${productId}:updated`, event),
      publish('inventory:updated', event),
      afterQuantity < 10 &&
        publish('inventory:low-stock', {
          productId,
          variantId,
          quantity: afterQuantity,
          threshold: 10,
        }),
    ]);
  } catch (error) {
    logger.error(
      'inventory-realtime',
      'Failed to publish inventory events',
      error,
      {
        productId,
        variantId: variantId || undefined,
      }
    );
  }

  try {
    await revalidateInventory(productId);
  } catch (error) {
    logger.error(
      'inventory-realtime',
      'Failed to revalidate inventory cache',
      error,
      {
        productId,
        variantId: variantId || undefined,
      }
    );
  }

  return true;
}

/**
 * 批量更新库存
 * 使用事务确保所有更新的原子性
 */
export async function batchUpdateInventory(
  updates: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    type: InventoryChangeType;
    reason?: string;
  }>
): Promise<{ success: boolean; failed: string[] }> {
  const failed = new Set<string>();

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    await prisma.$transaction(async tx => {
      for (const update of updates) {
        const inventory = await tx.inventory.findFirst({
          where: {
            productId: update.productId,
            variantId: update.variantId || null,
          },
          select: {
            id: true,
            quantity: true,
            reservedQuantity: true,
            updatedAt: true,
          },
        });

        if (!inventory) {
          failed.add(update.productId);
          throw new Error('库存记录不存在');
        }

        const nextQuantity = inventory.quantity + update.quantity;
        if (nextQuantity < 0) {
          failed.add(update.productId);
          throw new Error('库存不足，无法执行批量更新');
        }

        if (nextQuantity < inventory.reservedQuantity) {
          failed.add(update.productId);
          throw new Error('可用库存不足，无法执行批量更新');
        }

        const updateResult = await tx.inventory.updateMany({
          where: {
            id: inventory.id,
            updatedAt: inventory.updatedAt,
            quantity: inventory.quantity,
            reservedQuantity: inventory.reservedQuantity,
          },
          data: {
            quantity: nextQuantity,
          },
        });

        if (updateResult.count === 0) {
          failed.add(update.productId);
          throw new Error('库存并发冲突，请重试');
        }
      }
    });

    try {
      await redis.transaction(async pipeline => {
        for (const update of updates) {
          const cacheKey = update.variantId
            ? `inventory:${update.productId}:${update.variantId}`
            : `inventory:${update.productId}`;

          pipeline.hincrby(cacheKey, 'quantity', update.quantity);
          pipeline.hset(cacheKey, 'updatedAt', nowIso);
        }

        return pipeline.exec();
      });
    } catch (error) {
      logger.error(
        'inventory-realtime',
        'Failed to update batch inventory cache',
        error,
        {
          count: updates.length,
        }
      );
    }

    try {
      await publish('inventory:batch:updated', {
        count: updates.length,
        failed: failed.size,
        timestamp: nowIso,
      });
    } catch (error) {
      logger.error(
        'inventory-realtime',
        'Failed to publish batch inventory event',
        error,
        {
          count: updates.length,
        }
      );
    }

    return {
      success: true,
      failed: [],
    };
  } catch (error) {
    logger.error('inventory-realtime', 'Batch update failed', error, {
      count: updates.length,
    });
    return {
      success: false,
      failed:
        failed.size > 0 ? Array.from(failed) : updates.map(u => u.productId),
    };
  }
}

/**
 * 预留库存（用于订单创建）
 * 使用事务确保原子性
 * ✅ 修复：预留只增加 reservedQuantity，不修改 quantity
 */
export async function reserveInventory(
  productId: string,
  variantId: string | null,
  quantity: number,
  orderId: string
): Promise<boolean> {
  // ✅ 修复：传递正值，只增加 reservedQuantity
  return updateInventoryWithNotification(
    productId,
    variantId,
    quantity, // ✅ 修复：传递正值而非负值
    'reserve',
    {
      reason: '订单预留',
      orderId,
    }
  );
}

/**
 * 释放库存（用于订单取消）
 * 使用事务确保原子性
 * ✅ 修复：释放只减少 reservedQuantity，不修改 quantity
 */
export async function releaseInventory(
  productId: string,
  variantId: string | null,
  quantity: number,
  orderId: string
): Promise<boolean> {
  // ✅ 修复：传递正值，只减少 reservedQuantity
  return updateInventoryWithNotification(
    productId,
    variantId,
    quantity, // ✅ 保持正值，通过 type='release' 来减少 reservedQuantity
    'release',
    {
      reason: '订单取消',
      orderId,
    }
  );
}

/**
 * 入库
 */
export async function inboundInventory(
  productId: string,
  variantId: string | null,
  quantity: number,
  reason?: string,
  userId?: string
): Promise<boolean> {
  return updateInventoryWithNotification(
    productId,
    variantId,
    quantity,
    'inbound',
    {
      reason,
      userId,
    }
  );
}

/**
 * 出库
 */
export async function outboundInventory(
  productId: string,
  variantId: string | null,
  quantity: number,
  reason?: string,
  userId?: string
): Promise<boolean> {
  return updateInventoryWithNotification(
    productId,
    variantId,
    -quantity,
    'outbound',
    {
      reason,
      userId,
    }
  );
}

/**
 * 库存调整
 */
export async function adjustInventory(
  productId: string,
  variantId: string | null,
  quantity: number,
  reason?: string,
  userId?: string
): Promise<boolean> {
  return updateInventoryWithNotification(
    productId,
    variantId,
    quantity,
    'adjustment',
    {
      reason,
      userId,
    }
  );
}

/**
 * 获取实时库存
 * 优先从 Redis 缓存读取
 */
export async function getRealtimeInventory(
  productId: string,
  variantId?: string
): Promise<{
  quantity: number;
  reserved: number;
  available: number;
  updatedAt: string;
} | null> {
  try {
    const cacheKey = variantId
      ? `inventory:${productId}:${variantId}`
      : `inventory:${productId}`;

    // 1. 尝试从 Redis 读取
    const cached = await redis.getClient().hgetall(cacheKey);

    if (cached && Object.keys(cached).length > 0) {
      const quantity = parseInt(cached.quantity || '0');
      const reserved = parseInt(cached.reserved || '0');

      return {
        quantity,
        reserved,
        available: quantity - reserved,
        updatedAt: cached.updatedAt || new Date().toISOString(),
      };
    }

    // 2. 从数据库读取
    const inventory = await prisma.inventory.findFirst({
      where: {
        productId,
        variantId: variantId || null,
      },
      select: {
        id: true,
        quantity: true,
        reservedQuantity: true, // ✅ 修复：读取预留量
        updatedAt: true,
      },
    });

    if (!inventory) {
      // 产品不存在时返回 null（与其它模块保持一致），避免把无效 productId 默认为 0 库存
      const productExists = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });

      if (!productExists) {
        return null;
      }

      return {
        quantity: 0,
        reserved: 0,
        available: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. 写入缓存（hash），Redis 不可用时不影响主流程
    try {
      await redis
        .getClient()
        .multi()
        .hset(cacheKey, 'quantity', inventory.quantity)
        .hset(cacheKey, 'reserved', inventory.reservedQuantity.toString())
        .hset(cacheKey, 'updatedAt', inventory.updatedAt.toISOString())
        .exec();
    } catch (cacheError) {
      logger.warn(
        'inventory-realtime',
        '写入库存缓存失败(忽略)',
        { productId, variantId: variantId || undefined },
        {
          error:
            cacheError instanceof Error
              ? cacheError.message
              : String(cacheError),
        }
      );
    }

    // ✅ 修复：正确计算可用库存
    return {
      quantity: inventory.quantity,
      reserved: inventory.reservedQuantity, // ✅ 修复：使用实际预留量
      available: inventory.quantity - inventory.reservedQuantity, // ✅ 修复：正确计算可用库存
      updatedAt: inventory.updatedAt.toISOString(),
    };
  } catch (error) {
    logger.error(
      'inventory-realtime',
      'Failed to get realtime inventory',
      error,
      { productId, variantId: variantId || undefined }
    );
    return null;
  }
}
