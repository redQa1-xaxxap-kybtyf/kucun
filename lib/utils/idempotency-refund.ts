/**
 * 退款处理幂等性控制
 * 防止并发处理导致重复退款
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { toNumber } from '@/lib/utils/number';

/**
 * 退款处理幂等性键生成
 * @param refundId 退款记录ID
 * @param operatorId 操作员ID
 * @param timestamp 时间戳（可选，用于区分不同的处理批次）
 * @returns 幂等性键
 */
export function generateRefundProcessIdempotencyKey(
  refundId: string,
  operatorId: string,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  return `refund-process-${refundId}-${operatorId}-${ts}`;
}

/**
 * 退款处理锁
 */
export class RefundProcessLock {
  private refundId: string;
  private operatorId: string;
  private lockKey: string;
  private acquired: boolean = false;

  constructor(refundId: string, operatorId: string) {
    this.refundId = refundId;
    this.operatorId = operatorId;
    this.lockKey = `refund-lock:${refundId}`;
  }

  /**
   * 尝试获取锁（使用数据库实现）
   * @returns 是否成功获取锁
   */
  async acquire(): Promise<boolean> {
    try {
      // 使用退款记录的版本号实现乐观锁
      const refund = await prisma.refundRecord.findUnique({
        where: { id: this.refundId },
        select: { id: true, status: true, processedAmount: true },
      });

      if (!refund) {
        throw new Error('退款记录不存在');
      }

      // 检查状态是否允许处理
      if (refund.status === 'completed' || refund.status === 'rejected') {
        return false;
      }

      this.acquired = true;
      return true;
    } catch (error) {
      logger.error('idempotency:refund', '获取退款处理锁失败', error, {
        refundId: this.refundId,
        operatorId: this.operatorId,
        lockKey: this.lockKey,
      });
      return false;
    }
  }

  /**
   * 释放锁
   */
  async release(): Promise<void> {
    this.acquired = false;
  }

  /**
   * 检查是否已获取锁
   */
  isAcquired(): boolean {
    return this.acquired;
  }
}

/**
 * 退款处理结果
 */
export interface RefundProcessResult {
  success: boolean;
  refundId: string;
  processedAmount: number;
  remainingAmount: number;
  status: string;
  message?: string;
}

/**
 * 使用幂等性锁处理退款
 * @param refundId 退款ID
 * @param processAmount 处理金额
 * @param status 目标状态 ('completed' | 'rejected')
 * @param operatorId 操作员ID
 * @param tx 事务客户端
 * @returns 处理结果
 */
export async function processRefundWithLock(
  refundId: string,
  processAmount: number,
  status: 'completed' | 'rejected',
  operatorId: string,
  tx: Prisma.TransactionClient,
  options?: { closeRemaining?: boolean }
): Promise<RefundProcessResult> {
  // 创建锁
  const lock = new RefundProcessLock(refundId, operatorId);

  try {
    // 尝试获取锁
    if (!(await lock.acquire())) {
      return {
        success: false,
        refundId,
        processedAmount: 0,
        remainingAmount: 0,
        status: 'locked',
        message: '退款正在处理中或已完成，请勿重复操作',
      };
    }

    // 获取当前退款记录（使用事务内查询）
    const refund = await tx.refundRecord.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        status: true,
        returnOrderId: true,
      },
    });

    if (!refund) {
      throw new Error('退款记录不存在');
    }

    const refundAmount = toNumber(refund.refundAmount);
    const processedAmount = toNumber(refund.processedAmount);
    const remainingAmount = toNumber(refund.remainingAmount);

    // 验证状态
    if (refund.status === 'completed') {
      return {
        success: false,
        refundId,
        processedAmount,
        remainingAmount: 0,
        status: 'completed',
        message: '退款已完成，无需重复处理',
      };
    }

    if (refund.status === 'rejected') {
      return {
        success: false,
        refundId,
        processedAmount: 0,
        remainingAmount: refundAmount,
        status: 'rejected',
        message: '退款已拒绝',
      };
    }

    const shouldCloseRemaining =
      options?.closeRemaining === true && status === 'completed';

    // ✅ 修复：拒绝操作时不累加处理金额，保持原有金额不变
    let processedAmountToPersist: number;
    let remainingAmountToPersist: number;
    let finalStatus: string;

    if (status === 'rejected') {
      // ✅ 拒绝操作：不修改金额，只更新状态
      processedAmountToPersist = processedAmount;
      remainingAmountToPersist = remainingAmount;
      finalStatus = 'rejected';
    } else {
      // 批准操作：计算新的处理金额
      const newProcessedAmount = processedAmount + processAmount;
      const newRemainingAmount = refundAmount - newProcessedAmount;

      // 验证金额（除非抹平剩余金额）
      if (!shouldCloseRemaining && newProcessedAmount > refundAmount) {
        throw new Error(
          `处理金额超出剩余金额。剩余: ￥${remainingAmount.toFixed(2)}, 尝试处理: ￥${processAmount.toFixed(2)}`
        );
      }

      // 确定最终状态
      if (shouldCloseRemaining) {
        // ✅ 修复：抹平操作必须有实际处理金额
        if (processAmount <= 0) {
          throw new Error('抹平剩余金额时，处理金额必须大于0');
        }
        finalStatus = 'completed';
        processedAmountToPersist = refundAmount;
        remainingAmountToPersist = 0;
      } else if (newRemainingAmount <= 0) {
        finalStatus = 'completed';
        processedAmountToPersist = newProcessedAmount;
        remainingAmountToPersist = 0;
      } else {
        finalStatus = 'processing';
        processedAmountToPersist = newProcessedAmount;
        remainingAmountToPersist = Math.max(0, newRemainingAmount);
      }
    }

    // 使用乐观锁更新（检查processedAmount未变化）
    const updated = await tx.refundRecord.updateMany({
      where: {
        id: refundId,
        processedAmount: refund.processedAmount, // 乐观锁条件
      },
      data: {
        processedAmount: processedAmountToPersist,
        remainingAmount: remainingAmountToPersist,
        status: finalStatus,
      },
    });

    if (updated.count === 0) {
      // 乐观锁冲突，数据已被其他事务修改
      return {
        success: false,
        refundId,
        processedAmount,
        remainingAmount,
        status: 'conflict',
        message: '退款记录已被其他操作修改，请重试',
      };
    }

    // 释放锁
    await lock.release();

    return {
      success: true,
      refundId,
      processedAmount: processedAmountToPersist,
      remainingAmount: remainingAmountToPersist,
      status: finalStatus,
      message: `退款${finalStatus === 'completed' ? '完成' : finalStatus === 'rejected' ? '已拒绝' : '处理中'}`,
    };
  } catch (error) {
    // 释放锁
    await lock.release();

    throw error;
  }
}

/**
 * 验证退款是否可以处理
 * @param refundId 退款ID
 * @param tx 事务客户端（可选）
 * @returns 验证结果
 */
export async function validateRefundProcessable(
  refundId: string,
  tx?: Prisma.TransactionClient
): Promise<{
  valid: boolean;
  reason?: string;
  refund?: {
    id: string;
    status: string;
    refundAmount: number;
    processedAmount: number;
    remainingAmount: number;
  };
}> {
  const db = tx || prisma;

  const refund = await db.refundRecord.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      status: true,
      refundAmount: true,
      processedAmount: true,
      remainingAmount: true,
    },
  });

  if (!refund) {
    return {
      valid: false,
      reason: '退款记录不存在',
    };
  }

  const normalizedRefund = {
    id: refund.id,
    status: refund.status,
    refundAmount: toNumber(refund.refundAmount),
    processedAmount: toNumber(refund.processedAmount),
    remainingAmount: toNumber(refund.remainingAmount),
  };

  if (refund.status === 'completed') {
    return {
      valid: false,
      reason: '退款已完成',
      refund: normalizedRefund,
    };
  }

  if (refund.status === 'rejected') {
    return {
      valid: false,
      reason: '退款已拒绝',
      refund: normalizedRefund,
    };
  }

  if (normalizedRefund.remainingAmount <= 0) {
    return {
      valid: false,
      reason: '无剩余金额可处理',
      refund: normalizedRefund,
    };
  }

  return {
    valid: true,
    refund: normalizedRefund,
  };
}
