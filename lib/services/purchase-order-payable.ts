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
    expenseAmount?: number | null; // 运费等费用，这里不再计入应付金额
  }
): Promise<void> {
  // 查询该采购订单已有的应付记录（可能已经为货款创建过）
  const existingPayables = await tx.payableRecord.findMany({
    where: {
      sourceType: 'purchase_order',
      sourceId: order.id,
    },
    select: { supplierId: true },
  });

  const existingSuppliers = new Set(
    existingPayables.map(p => p.supplierId).filter(Boolean) as string[]
  );

  // 1) 按明细行拆分货款：一个供应商一条应付记录（仅统计产品 totalPrice）
  const items = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId: order.id },
    select: { supplierId: true, totalPrice: true },
  });

  if (!items.length) {
    return;
  }

  const supplierAmounts = new Map<string, number>();
  for (const item of items) {
    if (!item.supplierId) continue;
    const amount = item.totalPrice ?? 0;
    if (amount <= 0) continue;
    const current = supplierAmounts.get(item.supplierId) ?? 0;
    supplierAmounts.set(item.supplierId, current + amount);
  }

  if (supplierAmounts.size === 0) {
    return;
  }

  // 2) 统计与采购订单关联且有独立供应商的费用（例如运费物流公司）
  // 仅考虑显式设置了 supplierId 的费用，且该供应商在货款明细中不存在时，
  // 为其单独创建应付记录，实现「费用供应商与货物供应商不一致时分开创建应付」
  const expenseSupplierAmounts = new Map<string, number>();
  const expenses = await tx.expenseRecord.findMany({
    where: {
      relatedType: 'purchase_order',
      relatedId: order.id,
      supplierId: { not: null },
    },
    select: {
      supplierId: true,
      expenseAmount: true,
    },
  });

  for (const expense of expenses) {
    const supplierId = expense.supplierId;
    if (!supplierId) continue;

    const amount = Number(expense.expenseAmount ?? 0);
    if (amount <= 0) continue;

    // 只为“纯费用供应商”创建应付：货款明细里没有出现过该供应商
    if (supplierAmounts.has(supplierId)) {
      continue;
    }

    const current = expenseSupplierAmounts.get(supplierId) ?? 0;
    expenseSupplierAmounts.set(supplierId, current + amount);
  }

  // 3) 综合货款和费用供应商，按供应商创建缺失的应付记录
  const dueDateBase = new Date();

  // 3.1 先为有货款的供应商创建应付（只包含货款）
  for (const [supplierId, amount] of supplierAmounts.entries()) {
    if (!supplierId || amount <= 0) continue;

    // 已有该供应商的应付记录则跳过（幂等）
    if (existingSuppliers.has(supplierId)) continue;

    const payableNumber = await generatePayableNumber(tx);
    const dueDate = new Date(dueDateBase.getTime());
    dueDate.setDate(dueDate.getDate() + 30);

    await tx.payableRecord.create({
      data: {
        payableNumber,
        supplierId,
        userId: order.userId,
        sourceType: 'purchase_order',
        sourceId: order.id,
        sourceNumber: order.orderNumber,
        payableAmount: amount, // 只包含该供应商的货款
        paidAmount: 0,
        remainingAmount: amount,
        dueDate,
        status: 'pending',
        paymentTerms: '30天',
        remarks: `系统自动生成：采购订单 ${order.orderNumber} 发货应付`,
      },
    });
  }

  // 3.2 再为“仅费用供应商”创建应付记录（如运费物流公司）
  for (const [supplierId, amount] of expenseSupplierAmounts.entries()) {
    if (!supplierId || amount <= 0) continue;

    // 已有该供应商的应付记录则跳过（幂等）
    if (existingSuppliers.has(supplierId)) continue;

    const payableNumber = await generatePayableNumber(tx);
    const dueDate = new Date(dueDateBase.getTime());
    dueDate.setDate(dueDate.getDate() + 30);

    await tx.payableRecord.create({
      data: {
        payableNumber,
        supplierId,
        userId: order.userId,
        sourceType: 'purchase_order',
        sourceId: order.id,
        sourceNumber: order.orderNumber,
        payableAmount: amount, // 仅包含该供应商的费用金额
        paidAmount: 0,
        remainingAmount: amount,
        dueDate,
        status: 'pending',
        paymentTerms: '30天',
        remarks: `系统自动生成：采购订单 ${order.orderNumber} 费用应付`,
      },
    });
  }
}
