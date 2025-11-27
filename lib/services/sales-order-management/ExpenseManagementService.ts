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
      const calculationDetails: {
        method: string;
        baseAmount?: number;
        rate?: number;
        quantity?: number;
        weight?: number;
        minAmount?: number;
        maxAmount?: number;
      } = {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      throw new Error(`费用计算失败: ${message}`);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      throw new Error(`提交审核申请失败: ${message}`);
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
   * 同时根据最新费用分摊结果，重新计算订单成本和利润
   */
  private async recalculateOrderTotal(
    salesOrderId: string,
    tx: SalesOrderManagementPrisma
  ): Promise<void> {
    const order = await tx.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: true,
        feeItems: true,
      },
    });

    if (!order) return;

    const { itemsAmount, additionalFees, totalAmount } =
      computeOrderAmounts(order);

    const { normalizedCompanyExpense, allocations } =
      computeCompanyExpenseAllocations(order);

    const { itemUpdates, normalizedCostAmount, normalizedProfitAmount } =
      computeItemCostAndProfit(order, allocations, itemsAmount);

    // 批量更新明细行
    for (const u of itemUpdates) {
      await tx.salesOrderItem.update({
        where: { id: u.id },
        data: {
          allocatedExpense: u.allocatedExpense,
          costSubtotal: u.costSubtotal,
          profitAmount: u.profitAmount ?? undefined,
          profitMargin: u.profitMargin ?? undefined,
        },
      });
    }

    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        itemsAmount,
        additionalFees,
        totalAmount,
        costAmount: normalizedCostAmount,
        profitAmount: normalizedProfitAmount,
        expenseAmount: normalizedCompanyExpense,
      },
    });
  }
}

// ===== 内部辅助函数，拆分费用重算逻辑，便于测试和减少单函数行数 =====

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function computeOrderAmounts(order: {
  items: Array<{ subtotal: number | null }>;
  feeItems: Array<{ feeAmount: number | null }>;
  roundingAdjustment: number | null;
}): {
  itemsAmount: number;
  additionalFees: number;
  totalAmount: number;
} {
  const itemsAmount = order.items.reduce(
    (sum, item) => sum + Number(item.subtotal ?? 0),
    0
  );
  const additionalFees = order.feeItems.reduce(
    (sum, fee) => sum + Number(fee.feeAmount ?? 0),
    0
  );
  const roundingAdjustment = Number(order.roundingAdjustment ?? 0);

  const totalAmount = round2(itemsAmount + additionalFees + roundingAdjustment);

  return {
    itemsAmount: round2(itemsAmount),
    additionalFees: round2(additionalFees),
    roundingAdjustment,
    totalAmount,
  };
}

function computeCompanyExpenseAllocations(order: {
  items: Array<{ id: string; subtotal: number | null }>;
  feeItems: Array<{ feeAmount: number | null; paidBy: string | null }>;
}): {
  normalizedCompanyExpense: number;
  allocations: Map<string, number>;
} {
  const companyExpenseAmount = order.feeItems.reduce((sum, fee) => {
    const paidBy = fee.paidBy ?? 'customer';
    if (paidBy !== 'company') {
      return sum;
    }
    const amount = Number(fee.feeAmount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const normalizedCompanyExpense = round2(companyExpenseAmount);

  const totalSalesValue = order.items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.subtotal ?? 0)),
    0
  );

  const allocations = new Map<string, number>();

  if (order.items.length > 0 && normalizedCompanyExpense > 0) {
    if (totalSalesValue > 0) {
      let allocated = 0;
      order.items.forEach((item, index) => {
        const subtotal = Math.max(0, Number(item.subtotal ?? 0));
        const ratio = subtotal / totalSalesValue;
        const value =
          index === order.items.length - 1
            ? round2(normalizedCompanyExpense - allocated)
            : round2(normalizedCompanyExpense * ratio);
        allocations.set(item.id, value);
        allocated += value;
      });
    } else {
      const evenShare = round2(normalizedCompanyExpense / order.items.length);
      let allocated = 0;
      order.items.forEach((item, index) => {
        const value =
          index === order.items.length - 1
            ? round2(normalizedCompanyExpense - allocated)
            : evenShare;
        allocations.set(item.id, value);
        allocated += value;
      });
    }
  }

  return { normalizedCompanyExpense, allocations, totalSalesValue };
}

type ItemUpdate = {
  id: string;
  allocatedExpense: number;
  costSubtotal: number;
  profitAmount: number | null;
  profitMargin: number | null;
};

function computeItemCostAndProfit(
  order: {
    items: Array<{
      id: string;
      subtotal: number | null;
      allocatedExpense: number | null;
      costSubtotal: number | null;
      unitCost: number | null;
      quantity: number | null;
    }>;
  },
  allocations: Map<string, number>,
  itemsAmount: number
): {
  itemUpdates: ItemUpdate[];
  normalizedCostAmount: number;
  normalizedProfitAmount: number;
} {
  const itemUpdates: ItemUpdate[] = [];
  let totalCostAmount = 0;

  for (const item of order.items) {
    const subtotal = Number(item.subtotal ?? 0);
    const previousAllocated = Number(item.allocatedExpense ?? 0);
    const previousCostSubtotal = Number(item.costSubtotal ?? 0);

    let baseCost = 0;
    if (previousCostSubtotal || previousAllocated) {
      baseCost = previousCostSubtotal - previousAllocated;
    } else if (
      item.unitCost !== null &&
      item.unitCost !== undefined &&
      item.quantity !== null &&
      item.quantity !== undefined
    ) {
      baseCost = Number(item.unitCost) * Number(item.quantity);
    }
    baseCost = round2(baseCost);

    const allocatedExpense = allocations.get(item.id) ?? 0;
    const costSubtotal = round2(baseCost + allocatedExpense);

    let profitAmount: number | null = null;
    let profitMargin: number | null = null;
    if (subtotal) {
      profitAmount = round2(subtotal - costSubtotal);
      profitMargin = round2((profitAmount / subtotal) * 100);
    }

    totalCostAmount += costSubtotal;

    itemUpdates.push({
      id: item.id,
      allocatedExpense,
      costSubtotal,
      profitAmount,
      profitMargin,
    });
  }

  const normalizedCostAmount = round2(totalCostAmount);
  const normalizedProfitAmount = round2(itemsAmount - normalizedCostAmount);

  return { itemUpdates, normalizedCostAmount, normalizedProfitAmount };
}
