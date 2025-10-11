/**
 * 退货订单状态更新处理器
 * 包含幂等性保护和状态流转验证
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';

/**
 * 状态流转规则
 */
export const validStatusTransitions: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  rejected: [], // 已拒绝的订单不能再变更状态
  processing: ['completed', 'cancelled'],
  completed: [], // 已完成的订单不能再变更状态
  cancelled: [], // 已取消的订单不能再变更状态
};

/**
 * 验证状态流转是否合法
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; message: string } {
  const allowedStatuses = validStatusTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      message: `订单状态不能从 ${currentStatus} 变更为 ${newStatus}`,
    };
  }

  return {
    valid: true,
    message: '状态流转合法',
  };
}

/**
 * 订单状态更新结果
 */
export interface ReturnOrderStatusUpdateResult {
  order: {
    id: string;
    returnNumber: string;
    status: string;
    remarks?: string | null;
  };
  refundCreated: boolean;
}

/**
 * 更新退货订单状态
 * 包含状态流转验证和自动化业务逻辑
 */
export async function updateReturnOrderStatus(
  orderId: string,
  newStatus: string,
  currentStatus: string,
  processType: string,
  data: {
    remarks?: string;
    refundAmount?: number;
    processedAt?: string;
  },
  userId: string
): Promise<ReturnOrderStatusUpdateResult> {
  // 验证状态流转
  const validation = validateStatusTransition(currentStatus, newStatus);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  // 执行状态更新
  return await prisma.$transaction(
    async tx => {
      // 准备更新数据
      const updateData: {
        status: string;
        updatedAt: Date;
        remarks?: string;
        refundAmount?: number;
        submittedAt?: Date;
        approvedAt?: Date;
        processedAt?: Date;
        completedAt?: Date;
      } = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (data.remarks !== undefined) {
        updateData.remarks = data.remarks;
      }

      if (data.refundAmount !== undefined) {
        updateData.refundAmount = data.refundAmount;
      }

      // 根据状态设置时间戳
      switch (newStatus) {
        case 'submitted':
          updateData.submittedAt = new Date();
          break;
        case 'approved':
          updateData.approvedAt = new Date();
          break;
        case 'processing':
          updateData.processedAt = data.processedAt
            ? new Date(data.processedAt)
            : new Date();
          break;
        case 'completed':
          updateData.completedAt = new Date();
          break;
      }

      // 更新订单状态
      let order = await tx.returnOrder.update({
        where: { id: orderId },
        data: updateData,
        select: {
          id: true,
          returnNumber: true,
          status: true,
          remarks: true,
          refundAmount: true,
          totalAmount: true,
          salesOrderId: true,
          customerId: true,
          processType: true,
        },
      });

      let refundCreated = false;

      // 如果状态变更为completed且处理方式为refund,自动创建或纠正退款记录金额
      if (newStatus === 'completed' && processType === 'refund') {
        let computedRefundAmount =
          data.refundAmount ??
          (typeof order.refundAmount === 'number'
            ? order.refundAmount
            : Number(order.refundAmount ?? 0));

        if (!Number.isFinite(computedRefundAmount) || computedRefundAmount <= 0) {
          const aggregated = await tx.returnOrderItem.aggregate({
            where: { returnOrderId: orderId },
            _sum: { subtotal: true },
          });
          const aggregatedAmount = Number(aggregated._sum.subtotal ?? 0);
          if (aggregatedAmount > 0) {
            computedRefundAmount = aggregatedAmount;
          } else if (typeof order.totalAmount === 'number' && order.totalAmount > 0) {
            computedRefundAmount = order.totalAmount;
          }
        }

        // 同步回退货订单上的退款金额，确保后续查询一致
        if (
          computedRefundAmount > 0 &&
          (typeof order.refundAmount !== 'number' ||
            Math.abs(order.refundAmount - computedRefundAmount) > 0.0001)
        ) {
          await tx.returnOrder.update({
            where: { id: orderId },
            data: { refundAmount: computedRefundAmount },
          });
          order = {
            ...order,
            refundAmount: computedRefundAmount,
          };
        }

        if (computedRefundAmount > 0) {
          // 检查是否已经存在退款记录
          const existingRefund = await tx.refundRecord.findFirst({
            where: {
              returnOrderId: orderId,
            },
          });

          if (existingRefund) {
            const processedAmount = existingRefund.processedAmount ?? 0;
            const remainingAmount = Math.max(
              Number((computedRefundAmount - processedAmount).toFixed(6)),
              0
            );
            const resolvedStatus =
              existingRefund.status === 'rejected' ||
              existingRefund.status === 'cancelled'
                ? existingRefund.status
                : processedAmount >= computedRefundAmount
                  ? 'completed'
                  : processedAmount > 0
                    ? 'processing'
                    : 'pending';

            await tx.refundRecord.update({
              where: { id: existingRefund.id },
              data: {
                refundAmount: computedRefundAmount,
                remainingAmount,
                status: resolvedStatus,
              },
            });
          } else {
            // 生成退款单号
            const { generateRefundNumber } = await import(
              '@/lib/services/simple-order-number-generator'
            );
            const refundNumber = await generateRefundNumber();

            await tx.refundRecord.create({
              data: {
                refundNumber,
                returnOrderId: orderId,
                returnOrderNumber: order.returnNumber,
                salesOrderId: order.salesOrderId,
                customerId: order.customerId,
                userId,
                refundType: 'full_refund',
                refundMethod: 'original_payment',
                refundAmount: computedRefundAmount,
                processedAmount: 0,
                remainingAmount: computedRefundAmount,
                status: 'pending',
                refundDate: new Date(),
                reason: `退货订单 ${order.returnNumber} 自动生成退款`,
                remarks: `系统自动创建,关联退货订单：${order.returnNumber}`,
              },
            });

            refundCreated = true;
          }
        }
      }

      return {
        order: {
          id: order.id,
          returnNumber: order.returnNumber,
          status: order.status,
          remarks: order.remarks,
        },
        refundCreated,
      };
    },
    { timeout: 15000 }
  );
}

/**
 * 获取订单当前状态
 */
export async function getReturnOrderCurrentStatus(
  orderId: string
): Promise<{ status: string; processType: string } | null> {
  const order = await prisma.returnOrder.findUnique({
    where: { id: orderId },
    select: { status: true, processType: true },
  });

  return order
    ? { status: order.status, processType: order.processType }
    : null;
}
