/**
 * Redis 事务使用示例
 * 展示如何在关键业务场景中使用事务保证数据一致性
 */

import { logger } from '@/lib/logger';

import { redis } from './redis-client';

/**
 * 示例 1: 库存扣减（原子操作）
 * 场景：创建销售订单时，需要同时减少库存和增加预留数量
 *
 * @param productId - 产品ID
 * @param variantId - 变体ID（可选）
 * @param quantity - 扣减数量
 * @returns 是否成功
 */
export async function deductInventoryAtomic(
  productId: string,
  variantId: string | null,
  quantity: number
): Promise<boolean> {
  try {
    const inventoryKey = variantId
      ? `inventory:${productId}:${variantId}`
      : `inventory:${productId}`;

    // 使用事务确保原子性
    const results = await redis.transaction(async pipeline => {
      // 1. 获取当前库存
      pipeline.hget(inventoryKey, 'quantity');

      // 2. 减少可用库存
      pipeline.hincrby(inventoryKey, 'quantity', -quantity);

      // 3. 增加预留数量
      pipeline.hincrby(inventoryKey, 'reserved', quantity);

      // 4. 更新最后修改时间
      pipeline.hset(inventoryKey, 'updatedAt', new Date().toISOString());

      // 执行事务
      return pipeline.exec();
    });

    if (!results) {
      return false;
    }

    // 检查结果
    const [currentQtyResult, deductResult] = results;

    // 验证库存是否足够
    const currentQty = parseInt((currentQtyResult[1] as string) || '0');
    if (currentQty < quantity) {
      // 库存不足，需要回滚（实际应用中可能需要更复杂的处理）
      logger.warn('redis-transaction', '库存不足，无法扣减', undefined, {
        inventoryKey,
        currentQty,
        requested: quantity,
      });
      return false;
    }

    return deductResult[0] === null; // 成功时 error 为 null
  } catch (error) {
    logger.error('redis-transaction', '原子扣减库存失败', error, undefined, {
      productId,
      variantId,
      quantity,
    });
    return false;
  }
}

/**
 * 示例 2: 订单支付（原子操作）
 * 场景：处理订单支付时，需要同时更新订单状态、应收款和客户余额
 *
 * @param orderId - 订单ID
 * @param customerId - 客户ID
 * @param amount - 支付金额
 * @returns 是否成功
 */
export async function processPaymentAtomic(
  orderId: string,
  customerId: string,
  amount: number
): Promise<boolean> {
  try {
    const orderKey = `order:${orderId}`;
    const customerKey = `customer:${customerId}`;
    const receivableKey = `receivable:${orderId}`;

    const results = await redis.transaction(async pipeline => {
      // 1. 更新订单支付状态
      pipeline.hset(orderKey, 'paymentStatus', 'paid');
      pipeline.hset(orderKey, 'paidAt', new Date().toISOString());

      // 2. 减少应收款
      pipeline.hincrby(receivableKey, 'unpaidAmount', -amount);
      pipeline.hset(receivableKey, 'status', 'paid');

      // 3. 更新客户余额（如果有预付款）
      pipeline.hincrby(customerKey, 'balance', -amount);

      // 4. 记录支付时间
      pipeline.hset(customerKey, 'lastPaymentAt', new Date().toISOString());

      return pipeline.exec();
    });

    return (
      results !== null &&
      results.every(([err]: [Error | null, unknown]) => err === null)
    );
  } catch (error) {
    logger.error('redis-transaction', '处理订单支付失败', error, undefined, {
      orderId,
      customerId,
      amount,
    });
    return false;
  }
}

/**
 * 示例 3: 计数器增减（原子操作）
 * 场景：统计数据更新，需要同时更新多个计数器
 *
 * @param entityType - 实体类型（如 'product', 'customer'）
 * @param entityId - 实体ID
 * @param counters - 计数器更新映射
 * @returns 是否成功
 */
export async function updateCountersAtomic(
  entityType: string,
  entityId: string,
  counters: Record<string, number>
): Promise<boolean> {
  try {
    const statsKey = `stats:${entityType}:${entityId}`;

    const results = await redis.transaction(async pipeline => {
      // 批量更新计数器
      for (const [field, delta] of Object.entries(counters)) {
        pipeline.hincrby(statsKey, field, delta);
      }

      // 更新最后修改时间
      pipeline.hset(statsKey, 'updatedAt', new Date().toISOString());

      return pipeline.exec();
    });

    return (
      results !== null &&
      results.every(([err]: [Error | null, unknown]) => err === null)
    );
  } catch (error) {
    logger.error('redis-transaction', '更新计数器失败', error, undefined, {
      entityType,
      entityId,
    });
    return false;
  }
}

/**
 * 示例 4: 使用 WATCH 实现乐观锁
 * 场景：高并发场景下的库存扣减，使用乐观锁避免超卖
 *
 * @param productId - 产品ID
 * @param quantity - 扣减数量
 * @param maxRetries - 最大重试次数
 * @returns 是否成功
 */
export async function deductInventoryWithOptimisticLock(
  productId: string,
  quantity: number,
  maxRetries = 3
): Promise<boolean> {
  const inventoryKey = `inventory:${productId}`;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const client = redis.getClient();

      // 1. WATCH 监听库存键
      await client.watch(inventoryKey);

      // 2. 获取当前库存
      const currentQty = parseInt(
        (await client.hget(inventoryKey, 'quantity')) || '0'
      );

      // 3. 检查库存是否足够
      if (currentQty < quantity) {
        await client.unwatch();
        logger.warn('redis-transaction', '库存不足', undefined, {
          productId,
          currentQty,
          requested: quantity,
        });
        return false;
      }

      // 4. 开始事务
      const results = await redis.transaction(async pipeline => {
        pipeline.hincrby(inventoryKey, 'quantity', -quantity);
        pipeline.hincrby(inventoryKey, 'reserved', quantity);
        pipeline.hset(inventoryKey, 'updatedAt', new Date().toISOString());
        return pipeline.exec();
      });

      // 5. 检查事务是否成功
      if (results === null) {
        // 事务被中断（其他客户端修改了库存），重试
        retries++;
        logger.info('redis-transaction', '库存事务被中断，准备重试', {
          productId,
          retries,
          maxRetries,
        });
        continue;
      }

      // 成功
      return true;
    } catch (error) {
      logger.error(
        'redis-transaction',
        '乐观锁扣减库存失败',
        error,
        undefined,
        { productId, retries }
      );
      retries++;
    }
  }

  // 超过最大重试次数
  logger.error('redis-transaction', '乐观锁扣减库存重试次数耗尽', undefined, {
    productId,
    maxRetries,
  });
  return false;
}

/**
 * 示例 5: 批量操作（使用管道提升性能）
 * 场景：批量更新多个产品的库存
 *
 * @param updates - 库存更新列表
 * @returns 成功更新的数量
 */
export async function batchUpdateInventory(
  updates: Array<{ productId: string; variantId?: string; quantity: number }>
): Promise<number> {
  try {
    const results = await redis.transaction(async pipeline => {
      for (const update of updates) {
        const inventoryKey = update.variantId
          ? `inventory:${update.productId}:${update.variantId}`
          : `inventory:${update.productId}`;

        pipeline.hincrby(inventoryKey, 'quantity', update.quantity);
        pipeline.hset(inventoryKey, 'updatedAt', new Date().toISOString());
      }

      return pipeline.exec();
    });

    if (!results) {
      return 0;
    }

    // 统计成功的数量
    const successCount = results.filter(
      ([err]: [Error | null, unknown]) => err === null
    ).length;
    return successCount / 2; // 每个更新有2个命令
  } catch (error) {
    logger.error('redis-transaction', '批量更新库存失败', error, undefined, {
      updatesCount: updates.length,
    });
    return 0;
  }
}

/**
 * 使用建议：
 *
 * 1. **何时使用事务**：
 *    - 需要原子性操作（多个命令要么全部成功，要么全部失败）
 *    - 需要保证数据一致性（如库存扣减、支付处理）
 *    - 需要避免竞态条件
 *
 * 2. **何时使用 WATCH（乐观锁）**：
 *    - 高并发场景
 *    - 需要避免超卖、重复扣款等问题
 *    - 可以接受重试的场景
 *
 * 3. **性能考虑**：
 *    - 事务会阻塞其他命令，尽量减少事务中的命令数量
 *    - 使用管道（Pipeline）批量执行命令，减少网络往返
 *    - 避免在事务中执行耗时操作
 *
 * 4. **错误处理**：
 *    - 事务失败时需要有回滚机制
 *    - 使用 WATCH 时需要处理重试逻辑
 *    - 记录详细的错误日志，便于排查问题
 */
