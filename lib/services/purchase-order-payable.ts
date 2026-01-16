import type { Prisma } from '@prisma/client';

import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
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
    expenseAmount?: number | null; // 运费等费用（可能来自费用记录汇总/兜底字段）
  }
): Promise<void> {
  // 查询该采购订单已有的应付记录（可能已经为货款创建过）
  const existingPayables = await tx.payableRecord.findMany({
    where: {
      sourceType: 'purchase_order',
      sourceId: order.id,
    },
    take: 10000,
    select: { supplierId: true },
  });

  const existingSuppliers = new Set(
    existingPayables.map(p => p.supplierId).filter(Boolean) as string[]
  );

  // 1) 按明细行拆分货款：一个供应商一条应付记录（仅统计产品 totalPrice）
  const itemGroups = await tx.purchaseOrderItem.groupBy({
    by: ['supplierId'],
    where: { purchaseOrderId: order.id },
    _sum: { totalPrice: true },
  });

  if (!itemGroups.length) {
    return;
  }

  const supplierAmounts = new Map<string, number>();
  for (const item of itemGroups) {
    const supplierId = item.supplierId;
    if (!supplierId) continue;

    const amount = Number(item._sum?.totalPrice ?? 0);
    if (amount <= 0) continue;
    const current = supplierAmounts.get(supplierId) ?? 0;
    supplierAmounts.set(supplierId, current + amount);
  }

  if (supplierAmounts.size === 0) {
    return;
  }

  // 2) 统计与采购订单关联的费用：
  // - 若费用供应商=货款供应商：合并进对应应付金额（✅ 修复：应付包含费用）
  // - 若费用供应商独立：为其单独创建应付记录（如运费物流公司）
  const expenseSupplierAmounts = new Map<string, number>();
  const expenseGroups = await tx.expenseRecord.groupBy({
    by: ['supplierId'],
    where: {
      relatedType: 'purchase_order',
      relatedId: order.id,
      supplierId: { not: null },
    },
    _sum: {
      expenseAmount: true,
    },
  });

  let expenseAmountWithSupplierTotal = 0;
  for (const expense of expenseGroups) {
    const supplierId = expense.supplierId;
    if (!supplierId) continue;

    const amount = Number(expense._sum?.expenseAmount ?? 0);
    if (amount <= 0) continue;
    expenseAmountWithSupplierTotal += amount;

    if (supplierAmounts.has(supplierId)) {
      supplierAmounts.set(
        supplierId,
        (supplierAmounts.get(supplierId) ?? 0) + amount
      );
      continue;
    }

    const current = expenseSupplierAmounts.get(supplierId) ?? 0;
    expenseSupplierAmounts.set(supplierId, current + amount);
  }

  // 2.1 兜底：存在费用但没有 supplierId（或旧数据未同步费用记录）时，把差额计入订单主供应商
  const fallbackExpenseAmount = Math.max(
    0,
    Number(order.expenseAmount ?? 0) - expenseAmountWithSupplierTotal
  );
  if (fallbackExpenseAmount > 0) {
    supplierAmounts.set(
      order.supplierId,
      (supplierAmounts.get(order.supplierId) ?? 0) + fallbackExpenseAmount
    );
  }

  // 3) 综合货款和费用供应商，按供应商创建缺失的应付记录
  const dueDateBase = new Date();

  // 3.1 先为有货款(含费用合并/兜底)的供应商创建应付
  for (const [supplierId, amount] of supplierAmounts.entries()) {
    if (!supplierId || amount <= 0) continue;

    // 已有该供应商的应付记录则跳过（幂等）
    if (existingSuppliers.has(supplierId)) continue;

    const payableNumber = await generatePayableNumber(tx);
    const dueDate = new Date(dueDateBase.getTime());
    dueDate.setDate(dueDate.getDate() + 30);

    const createdPayable = await tx.payableRecord.create({
      data: {
        payableNumber,
        supplierId,
        userId: order.userId,
        sourceType: 'purchase_order',
        sourceId: order.id,
        sourceNumber: order.orderNumber,
        payableAmount: amount,
        paidAmount: 0,
        remainingAmount: amount,
        dueDate,
        status: 'pending',
        paymentTerms: '30天',
        remarks: `系统自动生成：采购订单 ${order.orderNumber} 发货应付`,
      },
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
      },
    });

    await recordPartnerTransaction(
      {
        partnerId: supplierId,
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount,
        referenceId: createdPayable.id,
        referenceNumber: payableNumber,
        description: `采购订单 ${order.orderNumber} 自动生成应付 ${payableNumber}`,
        userId: order.userId,
        occurredAt: createdPayable.createdAt,
        dueDate: createdPayable.dueDate ?? dueDate,
        metadata: {
          sourceType: 'purchase_order',
          sourceId: order.id,
          sourceNumber: order.orderNumber,
          payableRecordId: createdPayable.id,
          triggeredBy: 'purchase_order:payable_auto',
        },
      },
      tx
    );
  }

  // 3.2 再为“仅费用供应商”创建应付记录（如运费物流公司）
  for (const [supplierId, amount] of expenseSupplierAmounts.entries()) {
    if (!supplierId || amount <= 0) continue;

    // 已有该供应商的应付记录则跳过（幂等）
    if (existingSuppliers.has(supplierId)) continue;

    const payableNumber = await generatePayableNumber(tx);
    const dueDate = new Date(dueDateBase.getTime());
    dueDate.setDate(dueDate.getDate() + 30);

    const createdPayable = await tx.payableRecord.create({
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
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
      },
    });

    await recordPartnerTransaction(
      {
        partnerId: supplierId,
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount,
        referenceId: createdPayable.id,
        referenceNumber: payableNumber,
        description: `采购订单 ${order.orderNumber} 自动生成应付 ${payableNumber}`,
        userId: order.userId,
        occurredAt: createdPayable.createdAt,
        dueDate: createdPayable.dueDate ?? dueDate,
        metadata: {
          sourceType: 'purchase_order',
          sourceId: order.id,
          sourceNumber: order.orderNumber,
          payableRecordId: createdPayable.id,
          triggeredBy: 'purchase_order:payable_auto',
        },
      },
      tx
    );
  }
}
