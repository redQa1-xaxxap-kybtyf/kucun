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
    expenseAmount?: number | null; // ✅ 新增：费用金额
  }
): Promise<void> {
  // ✅ 修复：应付金额 = 物料金额 + 费用金额
  const payableAmount = order.totalAmount + (order.expenseAmount ?? 0);

  if (payableAmount <= 0) {
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

  const newPayable = await tx.payableRecord.create({
    data: {
      payableNumber,
      supplierId: order.supplierId,
      userId: order.userId,
      sourceType: 'purchase_order',
      sourceId: order.id,
      sourceNumber: order.orderNumber,
      payableAmount, // ✅ 修复：使用包含费用的总金额
      paidAmount: 0,
      remainingAmount: payableAmount, // ✅ 修复：使用包含费用的总金额
      dueDate,
      status: 'pending',
      paymentTerms: '30天',
      remarks: `系统自动生成：采购订单 ${order.orderNumber} 发货应付`,
    },
  });

  // ✅ P0修复：关联费用记录到应付款
  await tx.expenseRecord.updateMany({
    where: {
      relatedType: 'purchase_order',
      relatedId: order.id,
      payableId: null, // 仅更新未关联的费用
    },
    data: {
      payableId: newPayable.id,
    },
  });
}
