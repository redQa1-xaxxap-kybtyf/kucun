/**
 * Redis Pub/Sub 事件系统
 * 用于跨进程通知和实时数据同步
 *
 * 功能：
 * 1. 缓存失效通知
 * 2. 实时数据更新通知
 * 3. 跨进程事件广播
 */

import { redis } from '@/lib/redis/redis-client';
import { RedisCachePrefix } from './tags';

/**
 * Pub/Sub 频道定义
 */
export const PubSubChannels = {
  /** 缓存失效通知 */
  cacheInvalidation: `${RedisCachePrefix.channel}cache:invalidate`,

  /** 实时数据更新 */
  dataUpdate: `${RedisCachePrefix.channel}data:update`,

  /** 库存变更通知 */
  inventoryChange: `${RedisCachePrefix.channel}inventory:change`,

  /** 订单状态变更 */
  orderStatusChange: `${RedisCachePrefix.channel}order:status`,

  /** 财务数据变更 */
  financeChange: `${RedisCachePrefix.channel}finance:change`,
} as const;

/**
 * 事件类型定义
 */
export interface CacheInvalidationEvent {
  type: 'cache:invalidate';
  tag: string;
  timestamp: number;
  source?: string;
}

export interface DataUpdateEvent {
  type: 'data:update';
  resource: string;
  id: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
}

export interface InventoryChangeEvent {
  type: 'inventory:change';
  productId: string;
  variantId?: string;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
  timestamp: number;
}

export interface OrderStatusChangeEvent {
  type: 'order:status';
  orderId: string;
  orderType: 'sales' | 'return';
  oldStatus: string;
  newStatus: string;
  timestamp: number;
}

export interface FinanceChangeEvent {
  type: 'finance:change';
  recordType: 'receivable' | 'payable' | 'refund' | 'payment';
  recordId: string;
  action: 'create' | 'update' | 'delete';
  amount?: number;
  timestamp: number;
}

export type PubSubEvent =
  | CacheInvalidationEvent
  | DataUpdateEvent
  | InventoryChangeEvent
  | OrderStatusChangeEvent
  | FinanceChangeEvent;

/**
 * 发布事件到 Redis Pub/Sub
 */
export async function publishEvent(
  channel: string,
  event: PubSubEvent
): Promise<void> {
  try {
    await redis.getClient().publish(channel, JSON.stringify(event));
  } catch (error) {
    console.error(`[PubSub] Failed to publish event to ${channel}:`, error);
  }
}

/**
 * 订阅 Redis Pub/Sub 频道
 */
export function subscribeChannel(
  channel: string,
  handler: (event: PubSubEvent) => void | Promise<void>
): () => void {
  const subscriber = redis.getClient().duplicate();

  subscriber.subscribe(channel, err => {
    if (err) {
      console.error(`[PubSub] Failed to subscribe to ${channel}:`, err);
      return;
    }
    console.log(`[PubSub] Subscribed to channel: ${channel}`);
  });

  subscriber.on('message', async (ch, message) => {
    if (ch !== channel) {
      return;
    }

    try {
      const event = JSON.parse(message) as PubSubEvent;
      await handler(event);
    } catch (error) {
      console.error(
        `[PubSub] Failed to process message from ${channel}:`,
        error
      );
    }
  });

  // 返回取消订阅函数
  return () => {
    subscriber.unsubscribe(channel);
    subscriber.quit();
  };
}

/**
 * 订阅多个频道
 */
export function subscribeChannels(
  channels: string[],
  handlers: Record<string, (event: PubSubEvent) => void | Promise<void>>
): () => void {
  const subscriber = redis.getClient().duplicate();

  subscriber.subscribe(...channels, err => {
    if (err) {
      console.error('[PubSub] Failed to subscribe to channels:', err);
      return;
    }
    console.log('[PubSub] Subscribed to channels:', channels);
  });

  subscriber.on('message', async (channel, message) => {
    const handler = handlers[channel];
    if (!handler) {
      return;
    }

    try {
      const event = JSON.parse(message) as PubSubEvent;
      await handler(event);
    } catch (error) {
      console.error(
        `[PubSub] Failed to process message from ${channel}:`,
        error
      );
    }
  });

  // 返回取消订阅函数
  return () => {
    subscriber.unsubscribe(...channels);
    subscriber.quit();
  };
}

// ==================== 便捷发布函数 ====================

/**
 * 发布缓存失效事件
 */
export async function publishCacheInvalidation(
  tag: string,
  source?: string
): Promise<void> {
  await publishEvent(PubSubChannels.cacheInvalidation, {
    type: 'cache:invalidate',
    tag,
    timestamp: Date.now(),
    source,
  });
}

/**
 * 发布数据更新事件
 */
export async function publishDataUpdate(
  resource: string,
  id: string,
  action: 'create' | 'update' | 'delete'
): Promise<void> {
  await publishEvent(PubSubChannels.dataUpdate, {
    type: 'data:update',
    resource,
    id,
    action,
    timestamp: Date.now(),
  });
}

/**
 * 发布库存变更事件
 */
export async function publishInventoryChange(
  data: Omit<InventoryChangeEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishEvent(PubSubChannels.inventoryChange, {
    type: 'inventory:change',
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布订单状态变更事件
 */
export async function publishOrderStatusChange(
  data: Omit<OrderStatusChangeEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishEvent(PubSubChannels.orderStatusChange, {
    type: 'order:status',
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布财务数据变更事件
 */
export async function publishFinanceChange(
  data: Omit<FinanceChangeEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishEvent(PubSubChannels.financeChange, {
    type: 'finance:change',
    ...data,
    timestamp: Date.now(),
  });
}
