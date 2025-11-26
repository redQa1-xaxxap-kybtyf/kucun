/**
 * 采购订单费用服务
 *
 * P1修复：统一采购订单费用创建逻辑，实现幂等性
 */

import type { Prisma } from '@prisma/client';

import { generateExpenseIdempotencyKey } from '@/lib/services/expense-idempotency';
import { generateExpenseNumber } from '@/lib/services/expense-service';

export interface PurchaseOrderFeeItem {
  feeType: string;
  feeName: string;
  feeAmount: number;
  supplierId?: string | null;
  remarks?: string | null;
}

export interface CreatePurchaseExpensesParams {
  tx: Prisma.TransactionClient;
  orderId: string;
  orderNumber: string;
  supplierId: string;
  userId: string;
  feeItems: PurchaseOrderFeeItem[];
  expenseDate?: Date;
}

export interface CreatePurchaseExpensesResult {
  created: number;
  skipped: number;
  totalAmount: number;
}

/**
 * 费用类型映射
 */
function mapFeeTypeToExpenseType(feeType: string): string {
  switch (feeType) {
    case 'freight':
    case 'shipping':
      return 'shipping';
    case 'loading_unloading':
      return 'loading_unloading';
    case 'storage':
      return 'storage';
    case 'labor':
      return 'labor';
    case 'travel':
      return 'travel';
    case 'living':
      return 'living';
    default:
      return 'other';
  }
}

/**
 * 幂等创建采购订单费用记录
 *
 * 功能：
 * - 为每个费用项生成幂等键，防止重复创建
 * - 使用统一的费用编号生成器
 * - 正确设置 supplierId, status, paymentStatus
 *
 * @param params 创建参数
 * @returns 创建结果（创建数、跳过数、总金额）
 */
export async function createPurchaseOrderExpenses(
  params: CreatePurchaseExpensesParams
): Promise<CreatePurchaseExpensesResult> {
  const { tx, orderId, orderNumber, supplierId, userId, feeItems } = params;
  const expenseDate = params.expenseDate ?? new Date();

  let created = 0;
  let skipped = 0;
  let totalAmount = 0;

  for (const fee of feeItems) {
    // 跳过无效金额
    if (!fee.feeAmount || fee.feeAmount <= 0) {
      skipped += 1;
      continue;
    }

    // 生成幂等键：sourceType + sourceId + feeType + feeName + amount + date
    const idempotencyKey = generateExpenseIdempotencyKey({
      sourceType: 'purchase_order',
      sourceId: orderId,
      feeType: fee.feeType,
      feeName: fee.feeName,
      feeAmount: fee.feeAmount,
      expenseDate,
    });

    // 检查是否已存在（幂等性）
    const existing = await tx.expenseRecord.findUnique({
      where: { idempotencyKey },
      select: { id: true, expenseAmount: true },
    });

    if (existing) {
      // 已存在，跳过创建但计入总金额
      skipped += 1;
      totalAmount += existing.expenseAmount;
      continue;
    }

    // 如果费用项单独指定了供应商,优先使用该供应商；否则回落到订单级供应商
    const effectiveSupplierId = fee.supplierId || supplierId;

    // 创建新费用记录
    const expenseType = mapFeeTypeToExpenseType(fee.feeType);
    const expenseNumber = await generateExpenseNumber(tx);
    const amount = Math.round(fee.feeAmount * 100) / 100;

    await tx.expenseRecord.create({
      data: {
        expenseNumber,
        expenseType,
        expenseName: fee.feeName,
        expenseAmount: amount,
        expenseDate,
        relatedType: 'purchase_order',
        relatedId: orderId,
        relatedNumber: orderNumber,
        remarks: fee.remarks || null,
        userId,
        supplierId: effectiveSupplierId, // ✅ 费用挂在对应供应商名下（可为物流公司等服务商）
        status: 'draft', // ✅ P0修复：明确设置状态
        paymentStatus: 'unpaid', // ✅ P0修复：明确设置支付状态
        idempotencyKey, // ✅ P1修复：设置幂等键
      },
    });

    created += 1;
    totalAmount += amount;
  }

  return { created, skipped, totalAmount };
}

/**
 * 替换采购订单费用记录（用于编辑订单）
 *
 * 逻辑：
 * 1. 删除原有的所有费用记录
 * 2. 创建新的费用记录（带幂等键）
 *
 * @param params 创建参数
 * @returns 创建结果
 */
export async function replacePurchaseOrderExpenses(
  params: CreatePurchaseExpensesParams
): Promise<CreatePurchaseExpensesResult> {
  const { tx, orderId } = params;

  // 删除原有费用记录
  await tx.expenseRecord.deleteMany({
    where: {
      relatedType: 'purchase_order',
      relatedId: orderId,
    },
  });

  // 创建新费用记录
  return createPurchaseOrderExpenses(params);
}

/**
 * 计算费用总金额
 */
export function calculateExpenseAmount(
  feeItems: PurchaseOrderFeeItem[]
): number {
  return feeItems.reduce((sum, fee) => {
    const amount = fee.feeAmount ?? 0;
    return sum + (amount > 0 ? Math.round(amount * 100) / 100 : 0);
  }, 0);
}
