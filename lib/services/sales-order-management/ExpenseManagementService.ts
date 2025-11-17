import { prisma as basePrisma } from '@/lib/db';

import type {
  ExpenseApproval,
  ExpenseType,
  SalesOrderManagementPrisma,
} from './types';

const prisma = basePrisma as SalesOrderManagementPrisma;

export interface ExpenseCalculationRequest {
  salesOrderId: string;
  expenseTypeCode: string;
  baseAmount?: number;
  quantity?: number;
  weight?: number;
  customRate?: number;
}

export interface ExpenseCalculationResult {
  expenseTypeId: string;
  calculatedAmount: number;
  finalAmount: number;
  requiresApproval: boolean;
  calculationDetails: {
    method: string;
    baseAmount?: number;
    rate?: number;
    quantity?: number;
    weight?: number;
    minAmount?: number;
    maxAmount?: number;
  };
}

export interface ExpenseApprovalRequest {
  salesOrderId: string;
  feeItemId: string;
  expenseTypeId: string;
  requestedAmount: number;
  requestedBy: string;
  reason?: string;
}

export class ExpenseManagementService {
  /**
   * 计算费用
   */
  public async calculateExpense(
    request: ExpenseCalculationRequest
  ): Promise<ExpenseCalculationResult> {
    try {
      const expenseType = await prisma.expenseType.findUnique({
        where: { typeCode: request.expenseTypeCode },
      });

      if (!expenseType) {
        throw new Error(`费用类型不存在: ${request.expenseTypeCode}`);
      }

      if (!expenseType.isActive) {
        throw new Error(`费用类型已停用: ${request.expenseTypeCode}`);
      }

      let calculatedAmount = 0;
      const calculationDetails: any = {
        method: expenseType.calculationMethod,
      };

      switch (expenseType.calculationMethod) {
        case 'FIXED':
          calculatedAmount = expenseType.defaultRate;
          calculationDetails.rate = expenseType.defaultRate;
          break;

        case 'PERCENTAGE':
          if (!request.baseAmount) {
            throw new Error('百分比计算需要提供基础金额');
          }
          calculatedAmount =
            request.baseAmount * (expenseType.defaultRate / 100);
          calculationDetails.baseAmount = request.baseAmount;
          calculationDetails.rate = expenseType.defaultRate;
          break;

        case 'WEIGHT_BASED':
          if (!request.weight) {
            throw new Error('重量计算需要提供重量');
          }
          calculatedAmount = request.weight * expenseType.defaultRate;
          calculationDetails.weight = request.weight;
          calculationDetails.rate = expenseType.defaultRate;
          break;

        case 'QUANTITY_BASED':
          if (!request.quantity) {
            throw new Error('数量计算需要提供数量');
          }
          calculatedAmount = request.quantity * expenseType.defaultRate;
          calculationDetails.quantity = request.quantity;
          calculationDetails.rate = expenseType.defaultRate;
          break;

        case 'MANUAL':
          if (!request.customRate) {
            throw new Error('手动计算需要提供自定义费率');
          }
          calculatedAmount = request.customRate;
          calculationDetails.rate = request.customRate;
          break;

        default:
          throw new Error(`不支持的计算方法: ${expenseType.calculationMethod}`);
      }

      // 应用最小值和最大值限制
      let finalAmount = calculatedAmount;
      if (expenseType.minAmount && finalAmount < expenseType.minAmount) {
        finalAmount = expenseType.minAmount;
        calculationDetails.minAmount = expenseType.minAmount;
      }
      if (expenseType.maxAmount && finalAmount > expenseType.maxAmount) {
        finalAmount = expenseType.maxAmount;
        calculationDetails.maxAmount = expenseType.maxAmount;
      }

      // 检查是否需要审核
      const requiresApproval =
        (expenseType.requiresApproval ?? false) &&
        expenseType.approvalThreshold &&
        finalAmount > expenseType.approvalThreshold;

      return {
        expenseTypeId: expenseType.id,
        calculatedAmount,
        finalAmount,
        requiresApproval,
        calculationDetails,
      };
    } catch (error: any) {
      throw new Error(`费用计算失败: ${error.message}`);
    }
  }

  /**
   * 提交费用审核申请
   */
  public async submitExpenseApproval(
    request: ExpenseApprovalRequest
  ): Promise<ExpenseApproval> {
    try {
      const approval = await prisma.expenseApproval.create({
        data: {
          salesOrderId: request.salesOrderId,
          feeItemId: request.feeItemId,
          expenseTypeId: request.expenseTypeId,
          requestedAmount: request.requestedAmount,
          approvalStatus: 'PENDING',
          requestedBy: request.requestedBy,
          approvalReason: request.reason,
        },
      });

      return approval as ExpenseApproval;
    } catch (error: any) {
      throw new Error(`提交审核申请失败: ${error.message}`);
    }
  }

  /**
   * 审核费用申请
   */
  public async approveExpense(
    approvalId: string,
    approvedBy: string,
    status: 'APPROVED' | 'REJECTED',
    approvedAmount?: number,
    reason?: string
  ): Promise<ExpenseApproval> {
    return prisma.$transaction(async tx => {
      const approval = await tx.expenseApproval.findUnique({
        where: { id: approvalId },
      });

      if (!approval) {
        throw new Error('审核记录不存在');
      }

      if (approval.approvalStatus !== 'PENDING') {
        throw new Error('审核记录状态不正确');
      }

      const updatedApproval = await tx.expenseApproval.update({
        where: { id: approvalId },
        data: {
          approvalStatus: status,
          approvedBy,
          approvedAmount:
            status === 'APPROVED'
              ? approvedAmount || approval.requestedAmount
              : null,
          approvalReason: status === 'APPROVED' ? reason : undefined,
          rejectionReason: status === 'REJECTED' ? reason : undefined,
          approvedAt: new Date(),
        },
      });

      // 如果审核通过，更新费用项目
      if (status === 'APPROVED') {
        await tx.salesOrderFeeItem.update({
          where: { id: approval.feeItemId },
          data: {
            feeAmount: approvedAmount || approval.requestedAmount,
          },
        });

        // 重新计算订单总金额
        await this.recalculateOrderTotal(approval.salesOrderId, tx);
      }

      return updatedApproval as ExpenseApproval;
    });
  }

  /**
   * 获取费用类型列表
   */
  public async getExpenseTypes(category?: string): Promise<ExpenseType[]> {
    const expenseTypes = await prisma.expenseType.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: { sortOrder: 'asc' },
    });

    return expenseTypes as ExpenseType[];
  }

  /**
   * 获取待审核的费用申请
   */
  public async getPendingApprovals(
    userId?: string
  ): Promise<ExpenseApproval[]> {
    const approvals = await prisma.expenseApproval.findMany({
      where: {
        approvalStatus: 'PENDING',
        ...(userId && { requestedBy: userId }),
      },
      include: {
        expenseType: true,
        salesOrder: {
          select: {
            orderNumber: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return approvals as ExpenseApproval[];
  }

  /**
   * 重新计算订单总金额
   */
  private async recalculateOrderTotal(
    salesOrderId: string,
    tx: any
  ): Promise<void> {
    const order = await tx.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: true,
        feeItems: true,
      },
    });

    if (!order) return;

    const itemsAmount = order.items.reduce(
      (sum: number, item: any) => sum + item.subtotal,
      0
    );
    const additionalFees = order.feeItems.reduce(
      (sum: number, fee: any) => sum + fee.feeAmount,
      0
    );
    const totalAmount = itemsAmount + additionalFees + order.roundingAdjustment;

    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        itemsAmount,
        additionalFees,
        totalAmount,
      },
    });
  }
}
