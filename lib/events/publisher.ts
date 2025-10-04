/**
 * 事件发布系统
 * 通过 Redis Pub/Sub 实现业务事件与 WebSocket 的解耦
 */

import { redis } from '@/lib/redis/redis-client';
import type { BusinessEvent, EventChannel } from './types';
import { EventChannels } from './types';

/**
 * Redis 频道前缀
 */
const REDIS_CHANNEL_PREFIX = 'ws:';

/**
 * 发布业务事件到 Redis
 * 所有 WebSocket 服务器实例会接收并转发给客户端
 */
export async function publishEvent(
  channel: EventChannel,
  event: BusinessEvent
): Promise<void> {
  try {
    const redisChannel = `${REDIS_CHANNEL_PREFIX}${channel}`;
    const payload = JSON.stringify({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    await redis.getClient().publish(redisChannel, payload);
  } catch (error) {
    console.error('[Events] Failed to publish event:', error);
    // 不抛出错误，避免阻塞业务逻辑
  }
}

/**
 * 发送通知给特定用户
 */
export async function notifyUser(
  userId: string,
  notification: Omit<BusinessEvent & { type: 'notification' }, 'timestamp'>
): Promise<void> {
  const channel = EventChannels.userNotification(userId);
  await publishEvent(channel, {
    ...notification,
    timestamp: Date.now(),
    userId,
  } as BusinessEvent);
}

/**
 * 发布库存变更事件
 */
export async function publishInventoryChange(data: {
  action: 'adjust' | 'inbound' | 'outbound' | 'reserve' | 'release';
  productId: string;
  productName?: string;
  variantId?: string;
  oldQuantity: number;
  newQuantity: number;
  reason?: string;
  operator?: string;
  userId?: string;
}): Promise<void> {
  await publishEvent(EventChannels.inventory, {
    type: 'inventory:change',
    ...data,
    changeAmount: data.newQuantity - data.oldQuantity,
    timestamp: Date.now(),
  });
}

/**
 * 发布订单状态变更事件
 */
export async function publishOrderStatus(data: {
  orderType: 'sales' | 'return' | 'purchase';
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  customerId?: string;
  customerName?: string;
  userId?: string;
}): Promise<void> {
  await publishEvent(EventChannels.orders, {
    type: 'order:status',
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布审核请求事件
 */
export async function publishApprovalRequest(data: {
  resourceType: 'order' | 'return' | 'payment' | 'refund' | 'adjustment';
  resourceId: string;
  resourceNumber: string;
  requesterId: string;
  requesterName: string;
  userId?: string;
}): Promise<void> {
  await publishEvent(EventChannels.approvals, {
    type: 'approval:request',
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布审核结果事件
 */
export async function publishApprovalResult(data: {
  approved: boolean;
  resourceType: 'order' | 'return' | 'payment' | 'refund' | 'adjustment';
  resourceId: string;
  resourceNumber: string;
  requesterId: string;
  requesterName: string;
  approverId: string;
  approverName: string;
  reason?: string;
  comment?: string;
  userId?: string;
}): Promise<void> {
  const { approved, ...rest } = data;
  await publishEvent(EventChannels.approvals, {
    type: approved ? 'approval:approved' : 'approval:rejected',
    ...rest,
    timestamp: Date.now(),
  });

  // 同时通知请求者
  if (data.requesterId) {
    await notifyUser(data.requesterId, {
      type: 'notification',
      notificationType: approved ? 'success' : 'warning',
      title: approved ? '审核通过' : '审核拒绝',
      message: `您的${data.resourceType === 'order' ? '订单' : data.resourceType === 'return' ? '退货单' : '申请'} ${data.resourceNumber} 已被${approved ? '批准' : '拒绝'}`,
      actionUrl: `/${data.resourceType}s/${data.resourceId}`,
      actionLabel: '查看详情',
    });
  }
}

/**
 * 发布财务事件
 */
export async function publishFinanceEvent(data: {
  action: 'created' | 'confirmed' | 'cancelled' | 'overdue';
  recordType: 'payment' | 'paymentOut' | 'refund';
  recordId: string;
  recordNumber: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  userId?: string;
}): Promise<void> {
  const eventType =
    data.action === 'overdue'
      ? 'finance:overdue'
      : data.recordType === 'refund'
        ? 'finance:refund'
        : 'finance:payment';

  await publishEvent(EventChannels.finance, {
    type: eventType,
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布数据变更事件
 */
export async function publishDataChange(data: {
  resource: 'product' | 'customer' | 'supplier' | 'category' | 'user';
  action: 'created' | 'updated' | 'deleted';
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, unknown>;
  userId?: string;
}): Promise<void> {
  const channelMap = {
    product: EventChannels.products,
    customer: EventChannels.customers,
    supplier: EventChannels.suppliers,
    category: EventChannels.system,
    user: EventChannels.system,
  };

  await publishEvent(channelMap[data.resource], {
    type: 'data:change',
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * 发布系统事件
 */
export async function publishSystemEvent(data: {
  type: 'system:maintenance' | 'system:update' | 'system:alert';
  level: 'info' | 'warning' | 'critical';
  message: string;
  affectedUsers?: string[];
  scheduledTime?: number;
  estimatedDuration?: number;
}): Promise<void> {
  await publishEvent(EventChannels.system, {
    ...data,
    timestamp: Date.now(),
  });

  // 如果有特定受影响用户，同时发送个人通知
  if (data.affectedUsers && data.affectedUsers.length > 0) {
    await Promise.all(
      data.affectedUsers.map(userId =>
        notifyUser(userId, {
          type: 'notification',
          notificationType:
            data.level === 'critical'
              ? 'error'
              : data.level === 'warning'
                ? 'warning'
                : 'info',
          title:
            data.type === 'system:maintenance' ? '系统维护通知' : '系统通知',
          message: data.message,
        })
      )
    );
  }
}

/**
 * 广播消息到所有客户端
 */
export async function broadcast(data: {
  type: string;
  message: string;
  level?: 'info' | 'warning' | 'critical';
}): Promise<void> {
  await publishEvent(EventChannels.broadcast, {
    type: 'system:alert',
    level: data.level || 'info',
    message: data.message,
    timestamp: Date.now(),
  });
}
