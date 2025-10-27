import type { PrismaClient } from '@prisma/client';

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export function generateReturnNumber(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);
  return `${prefix}${year}${month}${day}${timestamp}`;
}

export function calcTotalAmount(items: Array<{ subtotal: number }>): number {
  return items.reduce((sum, i) => sum + i.subtotal, 0);
}

export function validateReturnQuantities(
  items: Array<{ salesOrderItemId: string; returnQuantity: number }>,
  salesOrderItems: Array<{ id: string; quantity: number }>
): string | null {
  for (const item of items) {
    const salesItem = salesOrderItems.find(si => si.id === item.salesOrderItemId);
    if (!salesItem) return '销售订单明细不存在';
    if (item.returnQuantity > salesItem.quantity) return '退货数量不能超过原始数量';
  }
  return null;
}

export async function createReturnOrderTx(
  tx: Tx,
  data: {
    salesOrderId: string;
    customerId: string;
    userId: string;
    type: string;
    processType: 'refund' | 'exchange';
    reason: string;
    remarks?: string;
    items: Array<{
      salesOrderItemId: string;
      productId: string;
      returnQuantity: number;
      originalQuantity: number;
      unitPrice: number;
      subtotal: number;
      reason?: string;
      condition: 'good' | 'damaged' | 'defective';
    }>;
  },
  returnNumber: string,
  totalAmount: number
) {
  return tx.returnOrder.create({
    data: {
      returnNumber,
      salesOrderId: data.salesOrderId,
      customerId: data.customerId,
      userId: data.userId,
      type: data.type,
      processType: data.processType,
      status: 'draft',
      reason: data.reason,
      remarks: data.remarks,
      totalAmount,
      refundAmount: 0,
      items: {
        create: data.items.map(item => ({
          salesOrderItemId: item.salesOrderItemId,
          productId: item.productId,
          returnQuantity: item.returnQuantity,
          originalQuantity: item.originalQuantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          reason: item.reason,
          condition: item.condition,
        })),
      },
    },
  });
}

const validTransitions: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  rejected: ['cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(current: string, next: string): boolean {
  return Boolean(validTransitions[current]?.includes(next));
}

export async function applyCompletionEffects(tx: Tx, returnOrder: {
  items: Array<{ productId: string; returnQuantity: number; damagedQuantity: number | null | undefined }>;
}) {
  for (const item of returnOrder.items) {
    if ((item.damagedQuantity ?? 0) === 0) {
      await tx.inventory.updateMany({
        where: { productId: item.productId },
        data: { quantity: { increment: item.returnQuantity } },
      });
    }
  }
}

export function mergeRemarks(original: string | null, append?: string, prefix?: string) {
  if (!append) return original ?? '';
  const label = prefix ? `${prefix}: ` : '';
  return `${original || ''}${original ? '\n' : ''}${label}${append}`;
}

export async function batchUpdateReturnOrderStatusTx(
  tx: Tx,
  ids: string[],
  action: 'cancel' | 'approve' | 'reject'
) {
  const affectedSalesOrderIds = new Set<string>();
  const orders = await tx.returnOrder.findMany({
    where: { id: { in: ids } },
    select: { id: true, salesOrderId: true },
  });
  orders.forEach(o => o.salesOrderId && affectedSalesOrderIds.add(o.salesOrderId));

  if (action === 'cancel') {
    await tx.returnOrder.updateMany({
      where: { id: { in: ids }, status: { notIn: ['completed', 'cancelled'] } },
      data: { status: 'cancelled' },
    });
  } else if (action === 'approve') {
    await tx.returnOrder.updateMany({ where: { id: { in: ids }, status: 'submitted' }, data: { status: 'approved' } });
  } else if (action === 'reject') {
    await tx.returnOrder.updateMany({ where: { id: { in: ids }, status: 'submitted' }, data: { status: 'rejected' } });
  } else {
    throw new Error('无效的操作类型');
  }

  return affectedSalesOrderIds;
}

export async function batchDeleteReturnOrdersTx(tx: Tx, ids: string[]) {
  const orders = await tx.returnOrder.findMany({ where: { id: { in: ids } } });
  for (const order of orders) {
    if (order.status !== 'draft' && order.status !== 'cancelled') {
      throw new Error(`退货订单 "${order.returnNumber}" 不是草稿或已取消状态，无法批量删除`);
    }
  }
  await tx.returnOrderItem.deleteMany({ where: { returnOrderId: { in: ids } } });
  await tx.returnOrder.deleteMany({ where: { id: { in: ids } } });
}
