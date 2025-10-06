/**
 * 订单实时服务
 * 集成 Redis Pub/Sub 和事务功能，提供实时订单状态更新和通知
 */

import { publish } from '@/lib/redis/redis-pubsub';
import { redis } from '@/lib/redis/redis-client';
import { revalidateSalesOrders } from '@/lib/cache/revalidate';
import { prisma } from '@/lib/db';
import type { OrderStatus } from '@prisma/client';

/**
 * 订单状态变更事件
 */
export interface OrderStatusChangeEvent {
  orderId: string;
  orderNumber: string;
  customerId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
  userId?: string;
  timestamp: string;
}

/**
 * 订单支付事件
 */
export interface OrderPaymentEvent {
  orderId: string;
  orderNumber: string;
  customerId: string;
  paymentAmount: number;
  paymentMethod: string;
  paidAmount: number;
  remainingAmount: number;
  timestamp: string;
}

/**
 * 更新订单状态并发布通知
 * 使用事务确保原子性
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  metadata?: {
    reason?: string;
    userId?: string;
  }
): Promise<boolean> {
  try {
    // 1. 获取当前订单
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    const previousStatus = order.status;

    // 2. 使用 Redis 事务更新缓存
    const orderKey = `order:${orderId}`;

    await redis.transaction(async pipeline => {
      // 更新订单状态
      pipeline.hset(orderKey, 'status', newStatus);
      pipeline.hset(orderKey, 'updatedAt', new Date().toISOString());

      // 如果状态变更为已完成，记录完成时间
      if (newStatus === 'completed') {
        pipeline.hset(orderKey, 'completedAt', new Date().toISOString());
      }

      // 如果状态变更为已取消，记录取消时间
      if (newStatus === 'cancelled') {
        pipeline.hset(orderKey, 'cancelledAt', new Date().toISOString());
        if (metadata?.reason) {
          pipeline.hset(orderKey, 'cancelReason', metadata.reason);
        }
      }

      return pipeline.exec();
    });

    // 3. 更新数据库
    await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // 4. 构建状态变更事件
    const event: OrderStatusChangeEvent = {
      orderId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      previousStatus,
      newStatus,
      reason: metadata?.reason,
      userId: metadata?.userId,
      timestamp: new Date().toISOString(),
    };

    // 5. 发布 Pub/Sub 通知
    await Promise.all([
      // 订单级别通知
      publish(`order:${orderId}:status`, event),

      // 客户级别通知
      publish(`customer:${order.customerId}:orders`, event),

      // 全局订单状态变更通知
      publish('order:status:changed', event),

      // 用户通知
      publish(`user:${order.customerId}:notifications`, {
        type: 'order_status_changed',
        orderId,
        orderNumber: order.orderNumber,
        status: newStatus,
        message: `订单 ${order.orderNumber} 状态已更新为 ${getStatusLabel(newStatus)}`,
      }),
    ]);

    // 6. 失效缓存
    await revalidateSalesOrders(orderId);

    return true;
  } catch (error) {
    console.error('[Order] Failed to update order status:', error);
    return false;
  }
}

/**
 * 处理订单支付
 * 使用事务确保原子性
 */
export async function processOrderPayment(
  orderId: string,
  paymentAmount: number,
  paymentMethod: string,
  metadata?: {
    userId?: string;
    transactionId?: string;
  }
): Promise<boolean> {
  try {
    // 1. 获取订单信息
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    const paidAmount = (order.paidAmount || 0) + paymentAmount;
    const remainingAmount = order.totalAmount - paidAmount;

    // 2. 使用 Redis 事务更新缓存和统计
    await redis.transaction(async pipeline => {
      const orderKey = `order:${orderId}`;
      const statsKey = `stats:daily:${new Date().toISOString().split('T')[0]}`;
      const customerKey = `customer:${order.customerId}:stats`;

      // 更新订单支付信息
      pipeline.hset(orderKey, 'paidAmount', paidAmount);
      pipeline.hset(orderKey, 'remainingAmount', remainingAmount);
      pipeline.hset(orderKey, 'lastPaymentAt', new Date().toISOString());

      // 如果全额支付，更新状态
      if (remainingAmount <= 0) {
        pipeline.hset(orderKey, 'paymentStatus', 'paid');
        pipeline.hset(orderKey, 'paidAt', new Date().toISOString());
      } else {
        pipeline.hset(orderKey, 'paymentStatus', 'partial');
      }

      // 更新每日统计
      pipeline.hincrby(statsKey, 'totalRevenue', paymentAmount);
      pipeline.hincrby(statsKey, 'paymentCount', 1);

      // 更新支付方式统计
      pipeline.hincrby(`stats:payment:${paymentMethod}`, 'count', 1);
      pipeline.hincrby(
        `stats:payment:${paymentMethod}`,
        'amount',
        paymentAmount
      );

      // 更新客户统计
      pipeline.hincrby(customerKey, 'totalPaid', paymentAmount);
      pipeline.hset(customerKey, 'lastPaymentAt', new Date().toISOString());

      return pipeline.exec();
    });

    // 3. 更新数据库
    await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        paidAmount,
        paymentStatus: remainingAmount <= 0 ? 'paid' : 'partial',
        updatedAt: new Date(),
      },
    });

    // 4. 创建支付记录
    await prisma.payment.create({
      data: {
        orderId,
        customerId: order.customerId,
        amount: paymentAmount,
        paymentMethod,
        transactionId: metadata?.transactionId,
        userId: metadata?.userId,
        status: 'completed',
      },
    });

    // 5. 构建支付事件
    const event: OrderPaymentEvent = {
      orderId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      paymentAmount,
      paymentMethod,
      paidAmount,
      remainingAmount,
      timestamp: new Date().toISOString(),
    };

    // 6. 发布 Pub/Sub 通知
    await Promise.all([
      // 订单支付通知
      publish(`order:${orderId}:payment`, event),

      // 客户支付通知
      publish(`customer:${order.customerId}:payments`, event),

      // 全局支付通知
      publish('payment:received', event),

      // 用户通知
      publish(`user:${order.customerId}:notifications`, {
        type: 'payment_received',
        orderId,
        orderNumber: order.orderNumber,
        amount: paymentAmount,
        message: `订单 ${order.orderNumber} 收到支付 ¥${paymentAmount}`,
      }),
    ]);

    // 7. 失效缓存
    await revalidateSalesOrders(orderId);

    return true;
  } catch (error) {
    console.error('[Order] Failed to process payment:', error);
    return false;
  }
}

/**
 * 取消订单
 * 包含库存释放和通知
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  userId?: string
): Promise<boolean> {
  try {
    // 1. 获取订单和订单项
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    // 2. 释放库存（使用事务）
    for (const item of order.items) {
      await redis.transaction(async pipeline => {
        const inventoryKey = item.variantId
          ? `inventory:${item.productId}:${item.variantId}`
          : `inventory:${item.productId}`;

        // 增加可用库存
        pipeline.hincrby(inventoryKey, 'quantity', item.quantity);

        // 减少预留库存
        pipeline.hincrby(inventoryKey, 'reserved', -item.quantity);

        return pipeline.exec();
      });
    }

    // 3. 更新订单状态
    await updateOrderStatus(orderId, 'cancelled', { reason, userId });

    // 4. 发布库存释放通知
    await publish('inventory:released', {
      orderId,
      items: order.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error('[Order] Failed to cancel order:', error);
    return false;
  }
}

/**
 * 获取订单状态标签
 */
function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    processing: '处理中',
    shipped: '已发货',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  };

  return labels[status] || status;
}

/**
 * 获取实时订单信息
 * 优先从 Redis 缓存读取
 */
export async function getRealtimeOrder(orderId: string) {
  try {
    const orderKey = `order:${orderId}`;

    // 1. 尝试从 Redis 读取
    const cached = await redis.getJson(orderKey);

    if (cached) {
      return cached;
    }

    // 2. 从数据库读取
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    // 3. 写入缓存
    await redis.setJson(orderKey, order, 3600);

    return order;
  } catch (error) {
    console.error('[Order] Failed to get realtime order:', error);
    return null;
  }
}
