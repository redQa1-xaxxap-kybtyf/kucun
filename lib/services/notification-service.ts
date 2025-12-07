/**
 * 通知服务
 * 统一管理所有 Pub/Sub 通知和用户通知
 */

import { logger } from '@/lib/logger';
import { psubscribe, publish, subscribe } from '@/lib/redis/redis-pubsub';

/**
 * 通知类型
 */
export type NotificationType =
  | 'order_created'
  | 'order_status_changed'
  | 'payment_received'
  | 'inventory_low_stock'
  | 'inventory_updated'
  | 'system_message'
  | 'user_message';

/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * 通知接口
 */
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read?: boolean;
}

/**
 * 发送用户通知
 */
export async function sendUserNotification(
  userId: string,
  notification: Omit<Notification, 'id' | 'timestamp'>
): Promise<void> {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  await publish(`user:${userId}:notifications`, fullNotification);
}

/**
 * 发送系统广播消息
 */
export async function broadcastSystemMessage(
  message: string,
  priority: NotificationPriority = 'normal',
  data?: Record<string, unknown>
): Promise<void> {
  const notification: Notification = {
    id: `sys_${Date.now()}`,
    type: 'system_message',
    priority,
    title: '系统通知',
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  await publish('system:broadcast', notification);
}

/**
 * 发送订单创建通知
 */
export async function notifyOrderCreated(
  userId: string,
  orderId: string,
  orderNumber: string,
  totalAmount: number
): Promise<void> {
  await sendUserNotification(userId, {
    type: 'order_created',
    priority: 'normal',
    title: '订单创建成功',
    message: `订单 ${orderNumber} 创建成功，总金额 ￥${totalAmount}`,
    data: {
      orderId,
      orderNumber,
      totalAmount,
    },
  });
}

/**
 * 发送订单状态变更通知
 */
export async function notifyOrderStatusChanged(
  userId: string,
  orderId: string,
  orderNumber: string,
  status: string,
  statusLabel: string
): Promise<void> {
  await sendUserNotification(userId, {
    type: 'order_status_changed',
    priority: 'normal',
    title: '订单状态更新',
    message: `订单 ${orderNumber} 状态已更新为 ${statusLabel}`,
    data: {
      orderId,
      orderNumber,
      status,
    },
  });
}

/**
 * 发送支付成功通知
 */
export async function notifyPaymentReceived(
  userId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  paymentMethod: string
): Promise<void> {
  await sendUserNotification(userId, {
    type: 'payment_received',
    priority: 'high',
    title: '支付成功',
    message: `订单 ${orderNumber} 收到支付 ￥${amount}（${paymentMethod}）`,
    data: {
      orderId,
      orderNumber,
      amount,
      paymentMethod,
    },
  });
}

/**
 * 发送库存预警通知
 */
export async function notifyLowStock(
  productId: string,
  productName: string,
  currentQuantity: number,
  threshold: number
): Promise<void> {
  // 发送给管理员（假设管理员ID为 'admin'）
  await sendUserNotification('admin', {
    type: 'inventory_low_stock',
    priority: 'urgent',
    title: '库存预警',
    message: `产品 ${productName} 库存不足，当前库存 ${currentQuantity}，低于阈值 ${threshold}`,
    data: {
      productId,
      productName,
      currentQuantity,
      threshold,
    },
  });

  // 同时发布全局预警
  await publish('inventory:low-stock:alert', {
    productId,
    productName,
    currentQuantity,
    threshold,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 订阅用户通知
 * 用于 WebSocket 连接
 */
export async function subscribeUserNotifications(
  userId: string,
  callback: (notification: Notification) => void
): Promise<void> {
  await subscribe(`user:${userId}:notifications`, (message: string) => {
    try {
      const notification = JSON.parse(message) as Notification;
      callback(notification);
    } catch (error) {
      logger.error('notifications', '解析用户通知失败', error, {
        userId,
        message,
      });
    }
  });
}

/**
 * 订阅系统广播
 * 用于 WebSocket 连接
 */
export async function subscribeSystemBroadcast(
  callback: (notification: Notification) => void
): Promise<void> {
  await subscribe('system:broadcast', (message: string) => {
    try {
      const notification = JSON.parse(message) as Notification;
      callback(notification);
    } catch (error) {
      logger.error('notifications', '解析系统广播失败', error, {
        message,
      });
    }
  });
}

/**
 * 订阅订单更新
 * 使用模式订阅，监听所有订单状态变更
 */
export async function subscribeOrderUpdates(
  callback: (orderId: string, event: unknown) => void
): Promise<void> {
  await psubscribe('order:*:status', (message: string, channel: string) => {
    try {
      const orderId = channel.split(':')[1];
      const event = JSON.parse(message);
      callback(orderId, event);
    } catch (error) {
      logger.error('notifications', '解析订单更新失败', error, {
        channel,
        message,
      });
    }
  });
}

/**
 * 订阅库存更新
 * 使用模式订阅，监听所有库存变更
 */
export async function subscribeInventoryUpdates(
  callback: (productId: string, event: unknown) => void
): Promise<void> {
  await psubscribe(
    'inventory:*:updated',
    (message: string, channel: string) => {
      try {
        const productId = channel.split(':')[1];
        const event = JSON.parse(message);
        callback(productId, event);
      } catch (error) {
        logger.error('notifications', '解析库存更新失败', error, {
          channel,
          message,
        });
      }
    }
  );
}

/**
 * 订阅支付通知
 */
export async function subscribePaymentNotifications(
  callback: (event: unknown) => void
): Promise<void> {
  await subscribe('payment:received', (message: string) => {
    try {
      const event = JSON.parse(message);
      callback(event);
    } catch (error) {
      logger.error('notifications', '解析付款通知失败', error, {
        message,
      });
    }
  });
}

/**
 * 订阅库存预警
 */
export async function subscribeLowStockAlerts(
  callback: (alert: unknown) => void
): Promise<void> {
  await subscribe('inventory:low-stock:alert', (message: string) => {
    try {
      const alert = JSON.parse(message);
      callback(alert);
    } catch (error) {
      logger.error('notifications', '解析低库存警报失败', error, {
        message,
      });
    }
  });
}

/**
 * 通知频道常量
 */
export const NotificationChannels = {
  // 用户通知
  userNotifications: (userId: string) => `user:${userId}:notifications`,

  // 系统广播
  systemBroadcast: 'system:broadcast',

  // 订单通知
  orderStatus: (orderId: string) => `order:${orderId}:status`,
  orderPayment: (orderId: string) => `order:${orderId}:payment`,
  orderCreated: 'order:created',
  orderStatusChanged: 'order:status:changed',

  // 库存通知
  inventoryUpdated: (productId: string) => `inventory:${productId}:updated`,
  inventoryLowStock: 'inventory:low-stock',
  inventoryLowStockAlert: 'inventory:low-stock:alert',
  inventoryBatchUpdated: 'inventory:batch:updated',

  // 支付通知
  paymentReceived: 'payment:received',

  // 客户通知
  customerOrders: (customerId: string) => `customer:${customerId}:orders`,
  customerPayments: (customerId: string) => `customer:${customerId}:payments`,
} as const;

/**
 * 使用示例：
 *
 * ```typescript
 * // 发送用户通知
 * await sendUserNotification('user-123', {
 *   type: 'order_created',
 *   priority: 'normal',
 *   title: '订单创建成功',
 *   message: '您的订单已创建',
 * });
 *
 * // 订阅用户通知
 * await subscribeUserNotifications('user-123', (notification) => {
 *   // 处理收到的通知
 *   handleNotification(notification);
 * });
 *
 * // 发送系统广播
 * await broadcastSystemMessage('系统将于今晚 22:00 进行维护', 'high');
 *
 * // 订阅订单更新
 * await subscribeOrderUpdates((orderId, event) => {
 *   // 处理订单状态更新
 *   handleOrderUpdate(orderId, event);
 * });
 * ```
 */
