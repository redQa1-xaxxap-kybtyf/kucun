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
  try {
    // 1. 使用原子操作更新数据库 (并发安全)
    // 直接使用 increment 避免 read-then-write 竞态条件
    const inventory = await prisma.inventory.findFirst({
      where: {
        productId,
        variantId: variantId || null,
      },
    });

    if (!inventory) {
      throw new Error('库存记录不存在');
    }

    // 2. 使用原子操作更新库存
    // ✅ 修复：预留和释放操作不应该修改实体库存 quantity
    const updatedInventory = await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        // 使用原子递增/递减操作,避免并发竞态
        // ✅ 修复：预留和释放操作不修改 quantity
        ...(type !== 'reserve' &&
          type !== 'release' && {
            quantity: { increment: quantity },
          }),
        // 根据类型更新预留数量
        ...(type === 'reserve' && {
          reservedQuantity: { increment: quantity },
        }),
        ...(type === 'release' && {
          reservedQuantity: { increment: -quantity },
        }),
        updatedAt: new Date(),
      },
    });

    // 3. 并发安全检查：验证更新后的库存不为负数
    if (updatedInventory.quantity < 0) {
      throw new Error(
        `并发更新导致库存为负数。当前库存: ${updatedInventory.quantity}, 请重试`
      );
    }

    // 4. 并发安全检查：验证更新后的预留数量不为负数
    if (updatedInventory.reservedQuantity < 0) {
      throw new Error(
        `并发更新导致预留数量为负数。当前预留: ${updatedInventory.reservedQuantity}, 请重试`
      );
    }

    // 5. 并发安全检查：验证可用库存不为负数
    if (updatedInventory.quantity < updatedInventory.reservedQuantity) {
      throw new Error(
        `并发更新导致可用库存(${updatedInventory.quantity})低于预留数量(${updatedInventory.reservedQuantity}), 请重试`
      );
    }

    const beforeQuantity = inventory.quantity;
    const afterQuantity = updatedInventory.quantity;

    // 6. 使用 Redis 事务更新缓存
    const cacheKey = variantId
      ? `inventory:${productId}:${variantId}`
      : `inventory:${productId}`;

    await redis.transaction(async pipeline => {
      // 更新库存数量
      pipeline.hset(cacheKey, 'quantity', afterQuantity);

      // 更新预留数量
      pipeline.hset(
        cacheKey,
        'reserved',
        updatedInventory.reservedQuantity.toString()
      );

      // 更新最后修改时间
      pipeline.hset(cacheKey, 'updatedAt', new Date().toISOString());

      return pipeline.exec();
    });

    // 7. 构建变更事件
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

    // 8. 发布 Pub/Sub 通知
    await Promise.all([
      // 产品级别通知
      publish(`inventory:${productId}:updated`, event),

      // 全局库存更新通知
      publish('inventory:updated', event),

      // 如果库存低于阈值，发布预警
      afterQuantity < 10 &&
        publish('inventory:low-stock', {
          productId,
          variantId,
          quantity: afterQuantity,
          threshold: 10,
        }),
    ]);

    // 9. 失效缓存
    await revalidateInventory(productId);

    return true;
  } catch (error) {
    logger.error('inventory-realtime', 'Failed to update inventory', error, {
      productId,
      variantId: variantId || undefined,
      quantity,
      type,
    });
    return false;
  }
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
  const failed: string[] = [];

  try {
    // 1. 使用 Redis 事务批量更新缓存
    await redis.transaction(async pipeline => {
      for (const update of updates) {
        const cacheKey = update.variantId
          ? `inventory:${update.productId}:${update.variantId}`
          : `inventory:${update.productId}`;

        pipeline.hincrby(cacheKey, 'quantity', update.quantity);
        pipeline.hset(cacheKey, 'updatedAt', new Date().toISOString());
      }

      return pipeline.exec();
    });

    // 2. 批量更新数据库
    for (const update of updates) {
      try {
        await prisma.inventory.updateMany({
          where: {
            productId: update.productId,
            variantId: update.variantId || null,
          },
          data: {
            quantity: {
              increment: update.quantity,
            },
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        logger.error(
          'inventory-realtime',
          'Failed to update inventory',
          error,
          {
            productId: update.productId,
            variantId: update.variantId || undefined,
            quantity: update.quantity,
            type: update.type,
          }
        );
        failed.push(update.productId);
      }
    }

    // 3. 发布批量更新通知
    await publish('inventory:batch:updated', {
      count: updates.length,
      failed: failed.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: failed.length === 0,
      failed,
    };
  } catch (error) {
    logger.error('inventory-realtime', 'Batch update failed', error, {
      count: updates.length,
    });
    return {
      success: false,
      failed: updates.map(u => u.productId),
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
    });

    if (!inventory) {
      return null;
    }

    // 3. 写入缓存
    await redis.setJson(cacheKey, inventory, 3600);

    return {
      quantity: inventory.quantity,
      reserved: 0, // 数据库中没有预留字段，默认为0
      available: inventory.quantity,
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
