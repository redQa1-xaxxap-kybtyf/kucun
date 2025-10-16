/**
 * 缓存系统初始化
 * 在应用启动时调用，设置 Pub/Sub 订阅和缓存清理任务
 */

import { logger } from '@/lib/logger';

import { PubSubChannels, subscribeChannels, type PubSubEvent } from './pubsub';
import { subscribeCacheInvalidation } from './revalidate';

// 用于 WebSocket 通知的全局事件发射器
let wsEventEmitter: ((event: PubSubEvent) => void) | null = null;

/**
 * 设置 WebSocket 事件发射器
 * 用于将 Pub/Sub 事件转发到 WebSocket 客户端
 */
export function setWsEventEmitter(emitter: (event: PubSubEvent) => void): void {
  wsEventEmitter = emitter;
}

/**
 * 初始化缓存系统
 * 在应用启动时调用一次
 */
export function initializeCacheSystem(): void {
  // 1. 订阅缓存失效通知（用于 Next.js 缓存同步）
  subscribeCacheInvalidation();

  // 2. 订阅所有业务事件
  subscribeChannels(
    [
      PubSubChannels.dataUpdate,
      PubSubChannels.inventoryChange,
      PubSubChannels.orderStatusChange,
      PubSubChannels.financeChange,
    ],
    {
      [PubSubChannels.dataUpdate]: handleDataUpdate,
      [PubSubChannels.inventoryChange]: handleInventoryChange,
      [PubSubChannels.orderStatusChange]: handleOrderStatusChange,
      [PubSubChannels.financeChange]: handleFinanceChange,
    }
  );

  logger.info('cache-init', 'Cache system initialized');
}

/**
 * 处理数据更新事件
 */
async function handleDataUpdate(event: PubSubEvent): Promise<void> {
  if (event.type !== 'data:update') {
    return;
  }

  logger.debug('cache-init', 'Data update event received', {
    type: event.type,
    raw: JSON.stringify(event),
  });

  // 转发到 WebSocket 客户端
  if (wsEventEmitter) {
    wsEventEmitter(event);
  }

  // 可以在这里添加其他处理逻辑，如记录日志、触发 webhook 等
}

/**
 * 处理库存变更事件
 */
async function handleInventoryChange(event: PubSubEvent): Promise<void> {
  if (event.type !== 'inventory:change') {
    return;
  }

  logger.debug('cache-init', 'Inventory change event received', {
    type: event.type,
    raw: JSON.stringify(event),
  });

  // 转发到 WebSocket 客户端
  if (wsEventEmitter) {
    wsEventEmitter(event);
  }

  // 可以添加库存告警检查等逻辑
}

/**
 * 处理订单状态变更事件
 */
async function handleOrderStatusChange(event: PubSubEvent): Promise<void> {
  if (event.type !== 'order:status') {
    return;
  }

  logger.debug('cache-init', 'Order status change event received', {
    type: event.type,
    raw: JSON.stringify(event),
  });

  // 转发到 WebSocket 客户端
  if (wsEventEmitter) {
    wsEventEmitter(event);
  }
}

/**
 * 处理财务数据变更事件
 */
async function handleFinanceChange(event: PubSubEvent): Promise<void> {
  if (event.type !== 'finance:change') {
    return;
  }

  logger.debug('cache-init', 'Finance change event received', {
    type: event.type,
    raw: JSON.stringify(event),
  });

  // 转发到 WebSocket 客户端
  if (wsEventEmitter) {
    wsEventEmitter(event);
  }
}
