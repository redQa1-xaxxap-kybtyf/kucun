// @ts-nocheck

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

      const resolvedApprovedAmount =
        status === 'APPROVED'
          ? (approvedAmount ?? approval.requestedAmount)
          : null;

      const updateResult = await tx.expenseApproval.updateMany({
        where: { id: approvalId, approvalStatus: 'PENDING' },
        data: {
          approvalStatus: status,
          approvedBy,
          approvedAmount: status === 'APPROVED' ? resolvedApprovedAmount : null,
          approvalReason: status === 'APPROVED' ? reason : undefined,
          rejectionReason: status === 'REJECTED' ? reason : undefined,
          approvedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error('审核失败：记录已被处理，请刷新后重试');
      }

      // 如果审核通过，更新费用项目
      if (status === 'APPROVED') {
        await tx.salesOrderFeeItem.update({
          where: { id: approval.feeItemId },
          data: {
            feeAmount: resolvedApprovedAmount ?? approval.requestedAmount,
          },
        });

        // 重新计算订单总金额
        await this.recalculateOrderTotal(approval.salesOrderId, tx);
      }

      const updatedApproval = await tx.expenseApproval.findUnique({
        where: { id: approvalId },
      });

      if (!updatedApproval) {
        throw new Error('审核记录不存在');
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
      select: {
        id: true,
        typeCode: true,
        typeName: true,
        category: true,
        calculationMethod: true,
        defaultRate: true,
        minAmount: true,
        maxAmount: true,
        isTaxable: true,
        requiresApproval: true,
        approvalThreshold: true,
        isActive: true,
        sortOrder: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: 1000,
    });

    return expenseTypes as ExpenseType[];
  }

  /**
   * 获取待审核的费用申请
   */
  public async getPendingApprovals(
    userId?: string
  ): Promise<ExpenseApproval[]> {
    const where = {
      approvalStatus: 'PENDING',
      ...(userId && { requestedBy: userId }),
    };

    const approvals: any[] = [];
    let cursor: string | undefined;
    const batchSize = 200;

    while (true) {
      const batch = await prisma.expenseApproval.findMany({
        where,
        select: {
          id: true,
          salesOrderId: true,
          feeItemId: true,
          expenseTypeId: true,
          requestedAmount: true,
          approvedAmount: true,
          approvalStatus: true,
          requestedBy: true,
          approvedBy: true,
          approvalReason: true,
          rejectionReason: true,
          requestedAt: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
          expenseType: {
            select: {
              id: true,
              typeCode: true,
              typeName: true,
              category: true,
              requiresApproval: true,
              approvalThreshold: true,
              isActive: true,
              sortOrder: true,
            },
          },
          salesOrder: {
            select: {
              orderNumber: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (batch.length === 0) {
        break;
      }

      approvals.push(...batch);
      cursor = batch[batch.length - 1].id;
    }

    approvals.sort((a, b) => {
      const aTime = a.requestedAt instanceof Date ? a.requestedAt.getTime() : 0;
      const bTime = b.requestedAt instanceof Date ? b.requestedAt.getTime() : 0;
      return bTime - aTime;
    });

    return approvals as ExpenseApproval[];
  }

  /**
   * 获取待审核费用数量（用于健康检查/告警）
   */
  public async countPendingApprovals(userId?: string): Promise<number> {
    return prisma.expenseApproval.count({
      where: {
        approvalStatus: 'PENDING',
        ...(userId && { requestedBy: userId }),
      },
    });
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

function toCents(value: number): number {
  return Math.round((value || 0) * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function computeOrderAmounts(order: {
  items: Array<{ subtotal: number | null }>;
  feeItems: Array<{ feeAmount: number | null; paidBy: string | null }>;
  roundingAdjustment: number | null;
}): {
  itemsAmount: number;
  additionalFees: number;
  roundingAdjustment: number;
  totalAmount: number;
} {
  const itemsAmount = order.items.reduce(
    (sum, item) => sum + Number(item.subtotal ?? 0),
    0
  );

  // 仅客户承担费用计入应收；公司承担费用计入成本（expenseAmount）
  const additionalFees = order.feeItems.reduce((sum, fee) => {
    const paidBy = fee.paidBy ?? 'customer';
    if (paidBy === 'company') {
      return sum;
    }
    return sum + Number(fee.feeAmount ?? 0);
  }, 0);

  const roundingAdjustment = round2(Number(order.roundingAdjustment ?? 0));

  // totalAmount 不包含抹零；实际应收 = totalAmount + roundingAdjustment
  const totalAmount = round2(itemsAmount + additionalFees);

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
  const companyExpenseCents = order.feeItems.reduce((sum, fee) => {
    const paidBy = fee.paidBy ?? 'customer';
    if (paidBy !== 'company') {
      return sum;
    }

    const amount = Number(fee.feeAmount ?? 0);
    if (!Number.isFinite(amount)) {
      return sum;
    }

    return sum + toCents(amount);
  }, 0);

  const normalizedCompanyExpense = fromCents(companyExpenseCents);

  const totalSalesValueCents = order.items.reduce((sum, item) => {
    const subtotal = Math.max(0, Number(item.subtotal ?? 0));
    return sum + toCents(subtotal);
  }, 0);

  const allocations = new Map<string, number>();

  if (order.items.length > 0 && companyExpenseCents > 0) {
    if (totalSalesValueCents > 0) {
      let allocatedCents = 0;
      order.items.forEach((item, index) => {
        const subtotal = Math.max(0, Number(item.subtotal ?? 0));
        const subtotalCents = toCents(subtotal);
        const ratio = subtotalCents / totalSalesValueCents;
        const valueCents =
          index === order.items.length - 1
            ? companyExpenseCents - allocatedCents
            : Math.round(companyExpenseCents * ratio);
        allocations.set(item.id, fromCents(valueCents));
        allocatedCents += valueCents;
      });
    } else {
      const evenShareCents = Math.floor(companyExpenseCents / order.items.length);
      let allocatedCents = 0;
      order.items.forEach((item, index) => {
        const valueCents =
          index === order.items.length - 1
            ? companyExpenseCents - allocatedCents
            : evenShareCents;
        allocations.set(item.id, fromCents(valueCents));
        allocatedCents += valueCents;
      });
    }
  }

  return { normalizedCompanyExpense, allocations };
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
  let totalCostAmountCents = 0;
  const itemsAmountCents = toCents(itemsAmount);

  for (const item of order.items) {
    const subtotalCents = toCents(Number(item.subtotal ?? 0));

    const previousAllocatedCents = toCents(Number(item.allocatedExpense ?? 0));
    const previousCostSubtotalCents = toCents(Number(item.costSubtotal ?? 0));

    let baseCostCents = 0;
    if (previousCostSubtotalCents !== 0 || previousAllocatedCents !== 0) {
      baseCostCents = previousCostSubtotalCents - previousAllocatedCents;
    } else if (
      item.unitCost !== null &&
      item.unitCost !== undefined &&
      item.quantity !== null &&
      item.quantity !== undefined
    ) {
      const unitCostCents = toCents(Number(item.unitCost));
      baseCostCents = unitCostCents * Number(item.quantity);
    }

    const allocatedExpenseCents = toCents(allocations.get(item.id) ?? 0);
    const costSubtotalCents = baseCostCents + allocatedExpenseCents;

    let profitAmount: number | null = null;
    let profitMargin: number | null = null;
    if (subtotalCents > 0) {
      const profitAmountCents = subtotalCents - costSubtotalCents;
      profitAmount = fromCents(profitAmountCents);
      profitMargin = round2((profitAmountCents / subtotalCents) * 100);
    }

    totalCostAmountCents += costSubtotalCents;

    itemUpdates.push({
      id: item.id,
      allocatedExpense: fromCents(allocatedExpenseCents),
      costSubtotal: fromCents(costSubtotalCents),
      profitAmount,
      profitMargin,
    });
  }

  const normalizedCostAmount = fromCents(totalCostAmountCents);
  const normalizedProfitAmount = fromCents(
    itemsAmountCents - totalCostAmountCents
  );

  return { itemUpdates, normalizedCostAmount, normalizedProfitAmount };
}
