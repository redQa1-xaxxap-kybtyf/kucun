/**
 * 退货订单状态更新处理器
 * 包含幂等性保护和状态流转验证
 * 遵循全局约定规范和唯一真理原则
 */

import { mergeRemarks } from '@/app/actions/return-orders.utils';
import { prisma } from '@/lib/db';
import { completeReturnOrderWorkflow } from '@/lib/services/return-order-orchestrator';

/**
 * 状态流转规则
 */
export const validStatusTransitions: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  // ✅ 允许从 submitted 直接完成（适配“提交后直接确认并生成应退货款”的业务场景）
  submitted: ['approved', 'rejected', 'cancelled', 'completed'],
  // 也允许从已审核直接完成
  approved: ['processing', 'cancelled', 'completed'],
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
  affectedProductIds: string[];
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
  _processType: string,
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
      const currentOrder = await tx.returnOrder.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          remarks: true,
        },
      });

      if (!currentOrder) {
        throw new Error('退货订单不存在');
      }

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
        updateData.remarks = mergeRemarks(currentOrder?.remarks ?? null, data.remarks);
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

      // 状态必须在事务内再次校验，避免并发旧请求重复执行完成副作用。
      const updateResult = await tx.returnOrder.updateMany({
        where: { id: orderId, status: currentStatus },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new Error('退货订单状态已变更，请刷新后重试');
      }

      const order = await tx.returnOrder.findUnique({
        where: { id: orderId },
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

      if (!order) {
        throw new Error('退货订单不存在');
      }

      let affectedProductIds: string[] = [];
      let refundCreated = false;

      if (newStatus === 'completed') {
        const completionResult = await completeReturnOrderWorkflow(tx, {
          completedAt: updateData.completedAt ?? updateData.updatedAt,
          orderId,
          refundAmount: data.refundAmount,
          userId,
        });
        affectedProductIds = completionResult.affectedProductIds;
        refundCreated = completionResult.refundCreated;
      }

      return {
        order: {
          id: order.id,
          returnNumber: order.returnNumber,
          status: order.status,
          remarks: order.remarks ?? undefined,
        },
        affectedProductIds,
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
