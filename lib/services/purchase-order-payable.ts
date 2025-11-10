import type { Prisma } from '@prisma/client';

import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { generatePayableNumber } from '@/lib/utils/payment-number-generator';

const PAYABLE_TRIGGER_STATUSES: Set<PurchaseOrderStatus> = new Set([
  PURCHASE_ORDER_STATUS.ORDERED,
  PURCHASE_ORDER_STATUS.SHIPPED,
  PURCHASE_ORDER_STATUS.IN_TRANSIT,
  PURCHASE_ORDER_STATUS.ARRIVED,
  PURCHASE_ORDER_STATUS.COMPLETED,
]);

export function shouldCreatePayable(
  status?: PurchaseOrderStatus | null
): boolean {
  if (!status) {
    return false;
  }
  return PAYABLE_TRIGGER_STATUSES.has(status);
}

export async function ensurePurchaseOrderPayable(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    supplierId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
  }
): Promise<void> {
  if (order.totalAmount <= 0) {
    return;
  }

  const existing = await tx.payableRecord.findFirst({
    where: {
      sourceType: 'purchase_order',
      sourceId: order.id,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const payableNumber = await generatePayableNumber(tx);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  await tx.payableRecord.create({
    data: {
      payableNumber,
      supplierId: order.supplierId,
      userId: order.userId,
      sourceType: 'purchase_order',
      sourceId: order.id,
      sourceNumber: order.orderNumber,
      payableAmount: order.totalAmount,
      paidAmount: 0,
      remainingAmount: order.totalAmount,
      dueDate,
      status: 'pending',
      paymentTerms: '30天',
      remarks: `系统自动生成：采购订单 ${order.orderNumber} 发货应付`,
    },
  });
}
