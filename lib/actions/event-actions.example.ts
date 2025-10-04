/**
 * Server Actions 示例
 * 展示如何在 Next.js Server Actions 中触发实时事件
 */

'use server';

import { revalidatePath } from 'next/cache';

import {
  publishInventoryChange,
  publishOrderStatus,
  publishApprovalRequest,
  publishFinanceEvent,
  notifyUser,
  broadcast,
} from '@/lib/events';

/**
 * 示例：调整库存并发送实时通知
 */
export async function adjustInventoryAction(data: {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  userId: string;
  userName: string;
}) {
  // 业务逻辑：调整库存
  // const result = await adjustInventory(...);

  // 发布库存变更事件（自动推送到所有订阅的客户端）
  await publishInventoryChange({
    action: 'adjust',
    productId: data.productId,
    productName: data.productName,
    oldQuantity: 100, // 示例值
    newQuantity: 100 + data.quantity,
    reason: data.reason,
    operator: data.userName,
    userId: data.userId,
  });

  // 刷新相关页面缓存
  revalidatePath('/inventory');

  return { success: true };
}

/**
 * 示例：更新订单状态
 */
export async function updateOrderStatusAction(data: {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  customerId: string;
  customerName: string;
  userId: string;
}) {
  // 业务逻辑：更新订单状态
  // const order = await updateOrderStatus(...);

  // 发布订单状态变更事件
  await publishOrderStatus({
    orderType: 'sales',
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    oldStatus: 'pending', // 示例值
    newStatus: data.newStatus,
    customerId: data.customerId,
    customerName: data.customerName,
    userId: data.userId,
  });

  // 通知客户
  await notifyUser(data.customerId, {
    type: 'notification',
    notificationType: 'info',
    title: '订单状态更新',
    message: `您的订单 ${data.orderNumber} 状态已更新为：${data.newStatus}`,
    actionUrl: `/orders/${data.orderId}`,
    actionLabel: '查看订单',
  });

  revalidatePath('/orders');

  return { success: true };
}

/**
 * 示例：提交审核请求
 */
export async function submitApprovalAction(data: {
  resourceType: 'order' | 'return' | 'payment' | 'refund';
  resourceId: string;
  resourceNumber: string;
  requesterId: string;
  requesterName: string;
  approverIds: string[];
}) {
  // 业务逻辑：创建审核记录
  // const approval = await createApprovalRequest(...);

  // 发布审核请求事件
  await publishApprovalRequest({
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    resourceNumber: data.resourceNumber,
    requesterId: data.requesterId,
    requesterName: data.requesterName,
  });

  // 通知所有审核人
  await Promise.all(
    data.approverIds.map((approverId) =>
      notifyUser(approverId, {
        type: 'notification',
        notificationType: 'warning',
        title: '待审核',
        message: `${data.requesterName} 提交了 ${data.resourceNumber} 需要您审核`,
        actionUrl: `/approvals/${data.resourceId}`,
        actionLabel: '立即审核',
      })
    )
  );

  revalidatePath('/approvals');

  return { success: true };
}

/**
 * 示例：确认收款
 */
export async function confirmPaymentAction(data: {
  paymentId: string;
  paymentNumber: string;
  amount: number;
  customerId: string;
  customerName: string;
  userId: string;
}) {
  // 业务逻辑：确认收款
  // const payment = await confirmPayment(...);

  // 发布财务事件
  await publishFinanceEvent({
    action: 'confirmed',
    recordType: 'payment',
    recordId: data.paymentId,
    recordNumber: data.paymentNumber,
    amount: data.amount,
    customerId: data.customerId,
    customerName: data.customerName,
    userId: data.userId,
  });

  // 通知客户
  await notifyUser(data.customerId, {
    type: 'notification',
    notificationType: 'success',
    title: '收款确认',
    message: `您的付款 ${data.paymentNumber} (¥${data.amount}) 已确认收款`,
    actionUrl: `/finance/payments/${data.paymentId}`,
    actionLabel: '查看详情',
  });

  revalidatePath('/finance');

  return { success: true };
}

/**
 * 示例：系统维护通知
 */
export async function notifyMaintenanceAction(data: {
  message: string;
  scheduledTime: number;
  estimatedDuration: number;
  level: 'info' | 'warning' | 'critical';
}) {
  // 广播给所有在线用户
  await broadcast({
    type: 'system:maintenance',
    message: data.message,
    level: data.level,
  });

  return { success: true };
}
