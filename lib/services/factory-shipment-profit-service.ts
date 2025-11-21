/**
 * 厂家发货利润计算服务
 *
 * 功能：
 * - 计算客户货利润（应收金额 - 采购成本 - 分摊费用）
 * - 计算利润率（利润 / 应收金额 × 100%）
 * - 计算订单总利润
 * - 计算自有货成本
 *
 * 设计原则：
 * - KISS: 计算逻辑简单直观
 * - DRY: 复用 Phase 2 的费用分摊服务
 * - SOLID: 单一职责，专注于利润计算
 */

import type {
  FactoryShipmentOrderItem,
  ItemProfitResult,
  OrderProfitSummary,
} from '@/lib/types/factory-shipment';

import { roundToTwoDecimals } from './factory-shipment-expense-service';

/**
 * 获取实际片数（考虑单位转换）
 * 如果单位是"件"且有每件片数，则转换为片数；否则直接返回数量
 */
function getActualQuantityInPieces(item: FactoryShipmentOrderItem): number {
  if (item.unit === '件' && item.piecesPerUnit && item.piecesPerUnit > 0) {
    return item.quantity * item.piecesPerUnit;
  }
  return item.quantity;
}

// ==================== 辅助工具函数 ====================

/**
 * 按客户货采购金额比例分配应收金额
 *
 * @param items - 订单明细列表
 * @param totalReceivable - 订单总应收金额
 * @returns Map<itemId, receivableAmount>
 */
export function allocateReceivableAmount(
  items: FactoryShipmentOrderItem[],
  totalReceivable: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // 只处理客户货
  const customerItems = items.filter(item => item.ownership === 'customer');

  if (customerItems.length === 0) {
    return allocations;
  }

  // 计算客户货总采购金额
  const totalCustomerCost = customerItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  // 边界情况：客户货总成本为0，平均分配
  if (totalCustomerCost === 0) {
    const averageReceivable = roundToTwoDecimals(
      totalReceivable / customerItems.length
    );
    customerItems.forEach(item => {
      allocations.set(item.id, averageReceivable);
    });

    // 调整最后一项以消除误差
    if (customerItems.length > 0) {
      const allocated = averageReceivable * customerItems.length;
      const difference = roundToTwoDecimals(totalReceivable - allocated);
      const lastItem = customerItems[customerItems.length - 1];
      allocations.set(
        lastItem.id,
        roundToTwoDecimals(averageReceivable + difference)
      );
    }

    return allocations;
  }

  // 按采购金额比例分配应收金额
  customerItems.forEach(item => {
    const ratio = item.totalPrice / totalCustomerCost;
    const receivable = roundToTwoDecimals(totalReceivable * ratio);
    allocations.set(item.id, receivable);
  });

  // 调整最后一项以消除四舍五入误差
  const allocatedTotal = Array.from(allocations.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const difference = roundToTwoDecimals(totalReceivable - allocatedTotal);

  if (Math.abs(difference) >= 0.01 && customerItems.length > 0) {
    const lastItem = customerItems[customerItems.length - 1];
    const lastAmount = allocations.get(lastItem.id) || 0;
    allocations.set(lastItem.id, roundToTwoDecimals(lastAmount + difference));
  }

  return allocations;
}

// ==================== 核心利润计算算法 ====================

/**
 * 计算单个客户货明细的利润
 *
 * 公式:
 * - 利润金额 = 应收金额 - 采购成本 - 分摊费用
 * - 利润率 = (利润金额 / 应收金额) × 100%
 * - 单位成本 = 采购单价 + 分摊费用 / 数量
 *
 * @param item - 发货明细
 * @param receivableAmount - 该明细的应收金额
 * @param allocatedExpense - 分摊到该明细的费用
 * @returns 利润计算结果
 */
export function calculateItemProfit(
  item: FactoryShipmentOrderItem,
  receivableAmount: number,
  allocatedExpense: number
): ItemProfitResult {
  // ✅ 修复：使用 unitCost 作为进货单价，unitPrice 作为销售单价
  // ✅ 修复：考虑单位转换（件 → 片）
  const actualQuantity = getActualQuantityInPieces(item);

  // 采购成本 = 进货单价 × 实际片数
  const purchaseCost = (item.unitCost || item.unitPrice) * actualQuantity;
  const revenue = receivableAmount; // 应收金额
  const expense = allocatedExpense; // 分摊费用

  // 利润 = 收入 - 采购成本 - 分摊费用
  const profitAmount = roundToTwoDecimals(revenue - purchaseCost - expense);

  // 利润率 = (利润 / 收入) × 100%
  const profitMargin =
    revenue > 0 ? roundToTwoDecimals((profitAmount / revenue) * 100) : 0;

  // 最终单位成本 = 进货单价 + 分摊费用 / 实际片数
  const finalUnitCost =
    actualQuantity > 0
      ? roundToTwoDecimals(
          (item.unitCost || item.unitPrice) + expense / actualQuantity
        )
      : item.unitCost || item.unitPrice;

  return {
    itemId: item.id,
    profitAmount,
    profitMargin,
    unitCost: finalUnitCost,
    revenue,
    cost: purchaseCost,
    allocatedExpense: expense,
  };
}

/**
 * 计算自有货的单位成本
 *
 * 公式: 单位成本 = 进货单价 + 分摊费用 / 数量
 *
 * @param item - 发货明细
 * @param allocatedExpense - 分摊到该明细的费用
 * @returns 单位成本
 */
export function calculateSelfItemCost(
  item: FactoryShipmentOrderItem,
  allocatedExpense: number
): number {
  // ✅ 修复：使用 unitCost 作为进货单价
  // ✅ 修复：考虑单位转换（件 → 片）
  const purchasePrice = item.unitCost || item.unitPrice;
  const actualQuantity = getActualQuantityInPieces(item);
  return actualQuantity > 0
    ? roundToTwoDecimals(purchasePrice + allocatedExpense / actualQuantity)
    : purchasePrice;
}

/**
 * 计算订单总利润（仅客户货）
 *
 * @param items - 订单明细列表
 * @param totalReceivable - 订单总应收金额
 * @param expenseAllocations - 费用分摊结果 Map<itemId, allocatedExpense>
 * @returns 订单利润汇总
 */
export function calculateOrderProfit(
  items: FactoryShipmentOrderItem[],
  totalReceivable: number,
  expenseAllocations: Map<string, number>
): OrderProfitSummary {
  // 分配应收金额到各客户货明细
  const receivableAllocations = allocateReceivableAmount(
    items,
    totalReceivable
  );

  const itemResults: ItemProfitResult[] = [];
  let customerProfit = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let selfCostAmount = 0;

  // 计算各明细的利润
  items.forEach(item => {
    const allocatedExpense = expenseAllocations.get(item.id) || 0;

    if (item.ownership === 'customer') {
      // 客户货：计算利润
      const receivable = receivableAllocations.get(item.id) || 0;
      const profitResult = calculateItemProfit(
        item,
        receivable,
        allocatedExpense
      );

      itemResults.push(profitResult);
      customerProfit += profitResult.profitAmount;
      totalRevenue += profitResult.revenue;
      totalCost += profitResult.cost;
    } else {
      // 自有货：只计算成本
      // ✅ 修复：使用 unitCost 作为进货单价
      // ✅ 修复：考虑单位转换（件 → 片）
      const actualQuantity = getActualQuantityInPieces(item);
      const purchaseCost = (item.unitCost || item.unitPrice) * actualQuantity;
      const itemCost = purchaseCost + allocatedExpense;
      selfCostAmount += itemCost;
    }
  });

  // 计算总费用
  const totalExpenses = Array.from(expenseAllocations.values()).reduce(
    (sum, expense) => sum + expense,
    0
  );

  // 计算平均利润率
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  return {
    customerProfit: roundToTwoDecimals(customerProfit),
    selfCostAmount: roundToTwoDecimals(selfCostAmount),
    totalRevenue: roundToTwoDecimals(totalRevenue),
    totalCost: roundToTwoDecimals(totalCost),
    totalExpenses: roundToTwoDecimals(totalExpenses),
    averageProfitMargin,
    itemResults,
  };
}

/**
 * 从利润汇总中提取明细更新数据
 *
 * @param profitSummary - 利润汇总结果
 * @param items - 订单明细列表
 * @param expenseAllocations - 费用分摊结果
 * @returns 明细更新数据数组
 */
export function extractItemUpdates(
  profitSummary: OrderProfitSummary,
  items: FactoryShipmentOrderItem[],
  expenseAllocations: Map<string, number>
): Array<{
  itemId: string;
  unitCost: number;
  allocatedExpense: number;
  profitAmount: number;
  profitMargin: number;
}> {
  const updates: Array<{
    itemId: string;
    unitCost: number;
    allocatedExpense: number;
    profitAmount: number;
    profitMargin: number;
  }> = [];

  items.forEach(item => {
    const allocatedExpense = expenseAllocations.get(item.id) || 0;

    if (item.ownership === 'customer') {
      // 客户货：从利润结果中获取数据
      const profitResult = profitSummary.itemResults.find(
        r => r.itemId === item.id
      );

      if (profitResult) {
        updates.push({
          itemId: item.id,
          unitCost: profitResult.unitCost,
          allocatedExpense: profitResult.allocatedExpense,
          profitAmount: profitResult.profitAmount,
          profitMargin: profitResult.profitMargin,
        });
      }
    } else {
      // 自有货：只更新成本相关字段
      const unitCost = calculateSelfItemCost(item, allocatedExpense);

      updates.push({
        itemId: item.id,
        unitCost,
        allocatedExpense,
        profitAmount: 0,
        profitMargin: 0,
      });
    }
  });

  return updates;
}

// ==================== 费用数据获取 ====================

/**
 * 获取发货单关联的所有费用
 *
 * @param factoryShipmentOrderId - 发货单ID
 * @returns 费用总额和明细
 */
export async function getFactoryShipmentExpenses(
  factoryShipmentOrderId: string
): Promise<{
  totalExpenses: number;
  expenses: Array<{
    id: string;
    type: string;
    amount: number;
    description?: string;
  }>;
}> {
  const { prisma } = await import('@/lib/db');

  // 查询关联到该发货单的所有费用
  const expenseRecords = await prisma.expenseRecord.findMany({
    where: {
      relatedType: 'factory_shipment',
      relatedId: factoryShipmentOrderId,
    },
    select: {
      id: true,
      expenseType: true,
      expenseAmount: true,
      expenseName: true,
      remarks: true,
    },
  });

  // 计算费用总额
  const totalExpenses = expenseRecords.reduce(
    (sum, record) => sum + record.expenseAmount,
    0
  );

  // 转换为返回格式
  const expenses = expenseRecords.map(record => ({
    id: record.id,
    type: record.expenseType,
    amount: record.expenseAmount,
    description: record.expenseName || record.remarks || undefined,
  }));

  return {
    totalExpenses: roundToTwoDecimals(totalExpenses),
    expenses,
  };
}
