/**
 * 费用与应付账款集成服务（阶段3）
 *
 * 职责：
 * 1. 费用审批后自动创建/更新应付款记录
 * 2. 付款核销后联动更新费用支付状态
 * 3. 支持合并/独立两种策略
 */

import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { toNumber } from '@/lib/utils/number';

/**
 * 费用到应付款参数
 */
export interface ExpenseToPayableParams {
  expenseId: string;
  expenseNumber: string;
  expenseAmount: number;
  supplierId: string | null;
  sourceType: 'sales_order' | 'factory_shipment' | 'purchase_order' | 'other';
  sourceId: string | null;
  sourceNumber: string | null;
  userId: string;
  tx?: Prisma.TransactionClient;
}

/**
 * 应付款创建/更新结果
 */
export interface PayableResult {
  payableId: string;
  payableNumber: string;
  action: 'created' | 'merged' | 'skipped';
  previousAmount?: number;
  newAmount: number;
}

/**
 * 生成应付款编号（简化版）
 */
async function generatePayableNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const today = new Date();
  const prefix = `FY${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

  const lastRecord = await tx.payableRecord.findFirst({
    where: { payableNumber: { startsWith: prefix } },
    orderBy: { payableNumber: 'desc' },
    select: { payableNumber: true },
  });

  let sequence = 1;
  if (lastRecord) {
    const match = lastRecord.payableNumber.match(/\d{4}$/);
    if (match) {
      sequence = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

/**
 * 金额四舍五入（保留2位小数）
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * 检查金额差异是否在容差范围内
 */
function isWithinTolerance(
  amount1: number,
  amount2: number,
  tolerance = 0.01
): boolean {
  return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * 合并策略：查找或创建应付款
 *
 * 逻辑：
 * - 按 supplierId + sourceType + sourceId 查找现有pending/partial应付款
 * - 若存在：检查expenseId是否已关联（防重），未关联则累加金额
 * - 若不存在：创建新应付款
 */
async function mergeStrategy(
  params: ExpenseToPayableParams,
  db: Prisma.TransactionClient
): Promise<PayableResult> {
  const {
    expenseId,
    expenseNumber,
    expenseAmount,
    supplierId,
    sourceType,
    sourceId,
    sourceNumber,
    userId,
  } = params;

  if (!supplierId) {
    throw ApiError.badRequest('合并策略要求费用必须关联供应商');
  }

  // 查找现有应付款（同供应商+同来源+pending/partial状态）
  const existingPayable = await db.payableRecord.findFirst({
    where: {
      supplierId,
      sourceType,
      sourceId,
      status: { in: ['pending', 'partial'] },
    },
    include: {
      expenseRecords: {
        select: { id: true },
      },
    },
  });

  if (existingPayable) {
    // 检查该费用是否已关联（防重）
    const alreadyLinked = existingPayable.expenseRecords.some(
      e => e.id === expenseId
    );

    if (alreadyLinked) {
      logger.info('expense-payable', '费用已关联到应付款，跳过合并', {
        expenseId,
        payableId: existingPayable.id,
      });
      return {
        payableId: existingPayable.id,
        payableNumber: existingPayable.payableNumber,
        action: 'skipped',
        previousAmount: toNumber(existingPayable.payableAmount),
        newAmount: toNumber(existingPayable.payableAmount),
      };
    }

    // 累加金额
    const previousAmount = toNumber(existingPayable.payableAmount);
    const newPayableAmount = roundCurrency(previousAmount + expenseAmount);
    const newRemainingAmount = roundCurrency(
      toNumber(existingPayable.remainingAmount) + expenseAmount
    );

    await db.payableRecord.update({
      where: { id: existingPayable.id },
      data: {
        payableAmount: newPayableAmount,
        remainingAmount: newRemainingAmount,
        updatedAt: new Date(),
      },
    });

    // 关联费用记录
    await db.expenseRecord.update({
      where: { id: expenseId },
      data: { payableId: existingPayable.id },
    });

    logger.info('expense-payable', '费用已合并到现有应付款', {
      expenseId,
      payableId: existingPayable.id,
      previousAmount,
      newAmount: newPayableAmount,
      addedAmount: expenseAmount,
    });

    return {
      payableId: existingPayable.id,
      payableNumber: existingPayable.payableNumber,
      action: 'merged',
      previousAmount,
      newAmount: newPayableAmount,
    };
  }

  // 不存在，创建新应付款
  const payableNumber = await generatePayableNumber(db);
  const description = sourceNumber
    ? `来源：${sourceType} - ${sourceNumber}；费用：${expenseNumber}`
    : `来源费用：${expenseNumber}`;

  const newPayable = await db.payableRecord.create({
    data: {
      payableNumber,
      supplierId,
      userId,
      sourceType,
      sourceId,
      sourceNumber,
      payableAmount: roundCurrency(expenseAmount),
      paidAmount: 0,
      remainingAmount: roundCurrency(expenseAmount),
      status: 'pending',
      description,
      paymentTerms: '30天',
    },
  });

  // 关联费用记录
  await db.expenseRecord.update({
    where: { id: expenseId },
    data: { payableId: newPayable.id },
  });

  logger.info('expense-payable', '创建新应付款（合并策略）', {
    expenseId,
    payableId: newPayable.id,
    payableNumber,
    amount: expenseAmount,
  });

  return {
    payableId: newPayable.id,
    payableNumber,
    action: 'created',
    newAmount: toNumber(newPayable.payableAmount),
  };
}

/**
 * 独立策略：每个费用创建独立应付款
 */
async function standaloneStrategy(
  params: ExpenseToPayableParams,
  db: Prisma.TransactionClient
): Promise<PayableResult> {
  const {
    expenseId,
    expenseNumber,
    expenseAmount,
    supplierId,
    sourceType,
    sourceNumber,
    userId,
  } = params;

  if (!supplierId) {
    throw ApiError.badRequest('独立策略要求费用必须关联供应商');
  }

  // 检查是否已创建应付款（防重）
  const existingExpense = await db.expenseRecord.findUnique({
    where: { id: expenseId },
    select: { payableId: true },
  });

  if (existingExpense?.payableId) {
    const existingPayable = await db.payableRecord.findUnique({
      where: { id: existingExpense.payableId },
      select: { id: true, payableNumber: true, payableAmount: true },
    });

    if (existingPayable) {
      logger.info('expense-payable', '费用已有关联应付款，跳过创建', {
        expenseId,
        payableId: existingPayable.id,
      });
      return {
        payableId: existingPayable.id,
        payableNumber: existingPayable.payableNumber,
        action: 'skipped',
        newAmount: toNumber(existingPayable.payableAmount),
      };
    }
  }

  // 创建独立应付款
  const payableNumber = await generatePayableNumber(db);
  const description = sourceNumber
    ? `费用单：${expenseNumber}；来源：${sourceType} - ${sourceNumber}`
    : `费用单：${expenseNumber}`;

  const newPayable = await db.payableRecord.create({
    data: {
      payableNumber,
      supplierId,
      userId,
      sourceType: 'expense', // 独立策略使用expense标识
      sourceId: expenseId,
      sourceNumber: expenseNumber,
      payableAmount: roundCurrency(expenseAmount),
      paidAmount: 0,
      remainingAmount: roundCurrency(expenseAmount),
      status: 'pending',
      description,
      paymentTerms: '30天',
    },
  });

  // 关联费用记录
  await db.expenseRecord.update({
    where: { id: expenseId },
    data: { payableId: newPayable.id },
  });

  logger.info('expense-payable', '创建独立应付款', {
    expenseId,
    payableId: newPayable.id,
    payableNumber,
    amount: expenseAmount,
  });

  return {
    payableId: newPayable.id,
    payableNumber,
    action: 'created',
    newAmount: toNumber(newPayable.payableAmount),
  };
}

/**
 * 创建或合并应付款（主入口）
 *
 * 根据配置的策略（merge/standalone）执行相应逻辑
 */
export async function createOrMergePayableFromExpense(
  params: ExpenseToPayableParams
): Promise<PayableResult> {
  if (!env.EXPENSE_TO_PAYABLE_ENABLED) {
    logger.debug('expense-payable', '功能未启用，跳过应付款创建');
    throw ApiError.badRequest('费用到应付款功能未启用');
  }

  const db = params.tx || prisma;
  const strategy = env.EXPENSE_TO_PAYABLE_STRATEGY;

  try {
    if (strategy === 'merge') {
      return await mergeStrategy(params, db);
    } else if (strategy === 'standalone') {
      return await standaloneStrategy(params, db);
    } else {
      throw ApiError.internalError(`未知的应付款创建策略: ${strategy}`);
    }
  } catch (error) {
    logger.error('expense-payable', '创建/合并应付款失败', error, {
      expenseId: params.expenseId,
      strategy,
    });
    throw error;
  }
}

/**
 * 付款核销后更新关联费用的支付状态
 *
 * 逻辑：
 * - 付款确认后，减少应付款remainingAmount
 * - 若remainingAmount=0：所有关联费用标记为paid
 * - 若remainingAmount>0：按已核销比例计算每笔费用的支付状态
 */
export async function updateExpensePaymentStatusAfterPayment(params: {
  payableRecordId: string;
  paymentAmount: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const { payableRecordId, paymentAmount, tx: providedTx } = params;
  const _db = providedTx || prisma;

  const runUpdate = async (db: Prisma.TransactionClient) => {
    // 查询应付款及关联费用
    const payable = await db.payableRecord.findUnique({
      where: { id: payableRecordId },
      include: {
        expenseRecords: {
          where: { paymentStatus: { in: ['unpaid', 'partial'] } },
          select: {
            id: true,
            expenseAmount: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!payable) {
      logger.warn('expense-payable', '应付款不存在，跳过费用状态更新', {
        payableRecordId,
      });
      return;
    }

    const paidAmount = toNumber(payable.paidAmount);
    const remainingAmount = toNumber(payable.remainingAmount);

    // 更新应付款金额
    const newPaidAmount = roundCurrency(paidAmount + paymentAmount);
    const newRemainingAmount = roundCurrency(
      Math.max(0, remainingAmount - paymentAmount)
    );

    await db.payableRecord.update({
      where: { id: payableRecordId },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: isWithinTolerance(newRemainingAmount, 0)
          ? 'paid'
          : newPaidAmount > 0
            ? 'partial'
            : 'pending',
        updatedAt: new Date(),
      },
    });

    // 更新关联费用的支付状态
    if (payable.expenseRecords.length === 0) {
      logger.info('expense-payable', '无待更新费用记录', { payableRecordId });
      return;
    }

    // 若应付款已全额支付，所有费用标记为paid
    if (isWithinTolerance(newRemainingAmount, 0)) {
      await db.expenseRecord.updateMany({
        where: {
          payableId: payableRecordId,
          paymentStatus: { in: ['unpaid', 'partial'] },
        },
        data: { paymentStatus: 'paid' },
      });

      logger.info('expense-payable', '应付款已全额支付，费用状态更新为paid', {
        payableRecordId,
        updatedCount: payable.expenseRecords.length,
      });
      return;
    }

    // 部分支付：按比例更新费用（简化逻辑：标记为partial）
    // 更精细的逻辑可以按每笔费用金额比例分配已付金额
    await db.expenseRecord.updateMany({
      where: {
        payableId: payableRecordId,
        paymentStatus: 'unpaid',
      },
      data: { paymentStatus: 'partial' },
    });

    logger.info('expense-payable', '应付款部分支付，费用状态更新为partial', {
      payableRecordId,
      remainingAmount: newRemainingAmount,
      updatedCount: payable.expenseRecords.filter(
        e => e.paymentStatus === 'unpaid'
      ).length,
    });
  };

  if (providedTx) {
    await runUpdate(providedTx);
  } else {
    await prisma.$transaction(runUpdate);
  }
}
