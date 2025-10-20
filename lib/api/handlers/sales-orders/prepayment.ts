import type { Tx } from './types';

const fetchAvailablePrepayments = async (tx: Tx, customerId: string) => {
  const records = await tx.paymentRecord.findMany({
    where: {
      customerId,
      paymentType: 'prepayment',
      status: { in: ['confirmed', 'applied'] },
    },
    orderBy: { paymentDate: 'asc' },
  });

  return records.filter(
    record => record.paymentAmount - record.appliedAmount > 0
  );
};

const allocatePrepayments = async (
  tx: Tx,
  prepayments: Awaited<ReturnType<typeof fetchAvailablePrepayments>>,
  targetAmount: number
) => {
  let remainingAmount = targetAmount;
  const appliedRecords: Array<{ id: string; amount: number }> = [];

  for (const prepayment of prepayments) {
    if (remainingAmount <= 0) {
      break;
    }

    const availableAmount = prepayment.paymentAmount - prepayment.appliedAmount;
    const applyAmount = Math.min(availableAmount, remainingAmount);

    const updatedCount = await tx.paymentRecord.updateMany({
      where: {
        id: prepayment.id,
        appliedAmount: prepayment.appliedAmount,
        paymentAmount: { gte: prepayment.appliedAmount + applyAmount },
      },
      data: {
        appliedAmount: { increment: applyAmount },
      },
    });

    if (updatedCount.count === 0) {
      throw new Error(
        `预收款 ${prepayment.id} 冲抵冲突，请重试。可能原因：其他订单正在使用该预收款。`
      );
    }

    const newAppliedAmount = prepayment.appliedAmount + applyAmount;
    const newStatus =
      newAppliedAmount >= prepayment.paymentAmount ? 'applied' : 'confirmed';

    await tx.paymentRecord.update({
      where: { id: prepayment.id },
      data: { status: newStatus },
    });

    appliedRecords.push({ id: prepayment.id, amount: applyAmount });
    remainingAmount -= applyAmount;
  }

  return {
    totalApplied: targetAmount - remainingAmount,
    records: appliedRecords,
  };
};

export const applyPrepaymentToOrder = async (
  tx: Tx,
  customerId: string,
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

  return allocatePrepayments(tx, prepayments, targetAmount);
};
