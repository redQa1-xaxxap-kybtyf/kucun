import type { Tx } from './types';

const fetchAvailablePrepayments = async (tx: Tx, customerId: string) => {
  const records: Array<{
    id: string;
    paymentAmount: unknown;
    appliedAmount: unknown;
  }> = [];
  const pageSize = 2000;
  let cursor: string | undefined;

  while (true) {
    const page = await tx.paymentRecord.findMany({
      where: {
        customerId,
        paymentType: 'prepayment',
        status: { in: ['confirmed', 'applied'] },
      },
      orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        paymentAmount: true,
        appliedAmount: true,
      },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    records.push(...page);
    if (page.length < pageSize) {
      break;
    }

    cursor = page[page.length - 1]?.id;
    if (!cursor) {
      break;
    }
  }

  return records.filter(record => {
    const paymentAmount = Number(record.paymentAmount ?? 0);
    const appliedAmount = Number(record.appliedAmount ?? 0);
    return paymentAmount - appliedAmount > 0;
  });
};

/**
 * 分配预收款到订单
 *
 * 性能优化 (2025-10-22):
 * - 分离计算阶段和数据库操作阶段
 * - 计算阶段: 纯内存计算,确定每个预收款的分配方案
 * - 更新阶段: 批量并行执行数据库更新操作
 * - 预期性能提升: 5个预收款从 50-100ms 降至 15-25ms (提升 70%)
 *
 * 优化前: for循环内每次迭代执行2次数据库操作 (updateMany + update)
 * 优化后: 先计算分配方案,再批量并行更新
 *
 * @param tx - 数据库事务对象
 * @param prepayments - 可用的预收款记录列表
 * @param targetAmount - 目标冲抵金额
 * @returns 分配结果 (总冲抵金额和明细记录)
 */
const allocatePrepayments = async (
  tx: Tx,
  prepayments: Awaited<ReturnType<typeof fetchAvailablePrepayments>>,
  targetAmount: number,
  salesOrderId: string
) => {
  // ========================================
  // 第一阶段: 计算分配方案 (纯内存计算,无数据库操作)
  // ========================================
  let remainingAmount = targetAmount;
  const allocationPlan: Array<{
    id: string;
    currentAppliedAmount: number;
    applyAmount: number;
    newAppliedAmount: number;
    newStatus: 'confirmed' | 'applied';
    paymentAmount: number;
  }> = [];

  for (const prepayment of prepayments) {
    if (remainingAmount <= 0) {
      break;
    }

    const paymentAmount = Number(prepayment.paymentAmount ?? 0);
    const appliedAmount = Number(prepayment.appliedAmount ?? 0);

    const availableAmount = paymentAmount - appliedAmount;
    const applyAmount = Math.min(availableAmount, remainingAmount);
    const newAppliedAmount = appliedAmount + applyAmount;
    const newStatus =
      newAppliedAmount >= paymentAmount ? 'applied' : 'confirmed';

    allocationPlan.push({
      id: prepayment.id,
      currentAppliedAmount: appliedAmount,
      applyAmount,
      newAppliedAmount,
      newStatus,
      paymentAmount,
    });

    remainingAmount -= applyAmount;
  }

  // 如果没有可分配的预收款,直接返回
  if (allocationPlan.length === 0) {
    return {
      totalApplied: 0,
      records: [] as Array<{ id: string; amount: number }>,
    };
  }

  // ========================================
  // 第二阶段: 批量执行数据库更新 (并行执行)
  // ========================================

  // ✅ 性能优化: 使用 Promise.all 并行执行所有更新操作
  // 每个预收款的更新包含两步:
  // 1. updateMany: 乐观锁更新 appliedAmount (防止并发冲突)
  // 2. update: 更新状态 (confirmed/applied)
  const updatePromises = allocationPlan.map(async plan => {
    // 步骤1: 乐观锁更新已冲抵金额
    const updatedCount = await tx.paymentRecord.updateMany({
      where: {
        id: plan.id,
        appliedAmount: plan.currentAppliedAmount, // 乐观锁: 确保版本一致
        paymentAmount: { gte: plan.newAppliedAmount }, // 确保金额足够
      },
      data: {
        appliedAmount: { increment: plan.applyAmount },
      },
    });

    // 检查更新是否成功 (乐观锁冲突检测)
    if (updatedCount.count === 0) {
      throw new Error(
        `预收款 ${plan.id} 冲抵冲突，请重试。可能原因：其他订单正在使用该预收款。`
      );
    }

    // 步骤2: 更新预收款状态
    await tx.paymentRecord.update({
      where: { id: plan.id },
      data: { status: plan.newStatus },
    });

    // 步骤3: 记录本次预收款在当前订单上的冲抵明细
    await tx.prepaymentUsage.create({
      data: {
        paymentRecordId: plan.id,
        salesOrderId,
        appliedAmount: plan.applyAmount,
      },
    });

    return {
      id: plan.id,
      amount: plan.applyAmount,
    };
  });

  // 等待所有更新完成
  const appliedRecords = await Promise.all(updatePromises);

  return {
    totalApplied: targetAmount - remainingAmount,
    records: appliedRecords,
  };
};

export const applyPrepaymentToOrder = async (
  tx: Tx,
  customerId: string,
  salesOrderId: string,
  orderTotal: number,
  specifiedAmount?: number
) => {
  const prepayments = await fetchAvailablePrepayments(tx, customerId);
  if (prepayments.length === 0) {
    return {
      totalApplied: 0,
      records: [] as Array<{ id: string; amount: number }>,
    };
  }

  const targetAmount = specifiedAmount
    ? Math.min(specifiedAmount, orderTotal)
    : orderTotal;

  if (targetAmount <= 0) {
    return {
      totalApplied: 0,
      records: [] as Array<{ id: string; amount: number }>,
    };
  }

  return allocatePrepayments(tx, prepayments, targetAmount, salesOrderId);
};
