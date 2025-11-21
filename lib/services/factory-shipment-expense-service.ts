/**
 * 厂家发货费用分摊服务
 *
 * 功能：
 * - 按货值比例分摊费用
 * - 按归属分摊费用（客户货 vs 自有货）
 * - 按重量比例分摊费用
 * - 按数量比例分摊费用
 * - 费用分摊结果验证
 *
 * 设计原则：
 * - KISS: 算法简单直观
 * - DRY: 复用通用计算逻辑
 * - SOLID: 单一职责，每个函数只做一件事
 */

import type {
  ExpenseAllocationResult,
  ExpenseAllocationSummary,
  FactoryShipmentOrderItem,
} from '@/lib/types/factory-shipment';

// ==================== 辅助工具函数 ====================

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

/**
 * 计算订单总金额（基于进货价）
 * ✅ 修复：使用 unitCost 作为进货价，而非 unitPrice（销售价）
 * ✅ 修复：考虑单位转换（件 → 片）
 */
export function calculateTotalValue(items: FactoryShipmentOrderItem[]): number {
  return items.reduce((sum, item) => {
    const purchasePrice = item.unitCost || item.unitPrice;
    const actualQuantity = getActualQuantityInPieces(item);
    return sum + purchasePrice * actualQuantity;
  }, 0);
}

/**
 * 计算订单总重量
 * ✅ 修复：考虑单位转换（件 → 片）
 */
export function calculateTotalWeight(
  items: FactoryShipmentOrderItem[]
): number {
  return items.reduce((sum, item) => {
    const weight = item.weight || item.manualWeight || 0;
    const actualQuantity = getActualQuantityInPieces(item);
    return sum + weight * actualQuantity;
  }, 0);
}

/**
 * 计算订单总数量（片数）
 * ✅ 修复：考虑单位转换（件 → 片）
 */
export function calculateTotalQuantity(
  items: FactoryShipmentOrderItem[]
): number {
  return items.reduce((sum, item) => sum + getActualQuantityInPieces(item), 0);
}

/**
 * 四舍五入到2位小数
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 验证分摊结果
 * 确保分摊总额等于费用总额（允许0.01的误差）
 */
export function validateAllocation(
  allocations: Map<string, number>,
  totalExpenses: number
): { isValid: boolean; difference: number } {
  const allocatedTotal = Array.from(allocations.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const difference = roundToTwoDecimals(
    Math.abs(allocatedTotal - totalExpenses)
  );

  return {
    isValid: difference < 0.01,
    difference,
  };
}

/**
 * 调整分摊金额以消除四舍五入误差
 * 将误差加到最后一项上
 */
export function adjustAllocationForRoundingError(
  allocations: Map<string, number>,
  totalExpenses: number
): Map<string, number> {
  const validation = validateAllocation(allocations, totalExpenses);

  if (validation.isValid) {
    return allocations;
  }

  // 计算实际分摊总额
  const allocatedTotal = Array.from(allocations.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );

  // 计算差额
  const difference = roundToTwoDecimals(totalExpenses - allocatedTotal);

  // 将差额加到最后一项
  const entries = Array.from(allocations.entries());
  if (entries.length > 0) {
    const [lastItemId, lastAmount] = entries[entries.length - 1];
    allocations.set(lastItemId, roundToTwoDecimals(lastAmount + difference));
  }

  return allocations;
}

// ==================== 核心分摊算法 ====================

/**
 * 按货值比例分摊费用
 *
 * 公式: 明细分摊费用 = 总费用 × (明细金额 / 订单总金额)
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 费用总额
 * @returns 分摊结果 Map<itemId, allocatedAmount>
 *
 * @example
 * ```typescript
 * const items = [
 *   { id: '1', totalPrice: 10000 },
 *   { id: '2', totalPrice: 5000 },
 * ];
 * const result = allocateExpensesByValue(items, 1500);
 * // result: Map { '1' => 1000, '2' => 500 }
 * ```
 */
export function allocateExpensesByValue(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // 边界情况：空数组
  if (items.length === 0) {
    return allocations;
  }

  // 边界情况：费用为0
  if (totalExpenses === 0) {
    items.forEach(item => allocations.set(item.id, 0));
    return allocations;
  }

  // 计算订单总金额
  const totalValue = calculateTotalValue(items);

  // 边界情况：总金额为0，平均分摊
  if (totalValue === 0) {
    const averageExpense = roundToTwoDecimals(totalExpenses / items.length);
    items.forEach(item => allocations.set(item.id, averageExpense));
    return adjustAllocationForRoundingError(allocations, totalExpenses);
  }

  // 按货值比例分摊
  items.forEach(item => {
    const ratio = item.totalPrice / totalValue;
    const allocated = roundToTwoDecimals(totalExpenses * ratio);
    allocations.set(item.id, allocated);
  });

  // 调整四舍五入误差
  return adjustAllocationForRoundingError(allocations, totalExpenses);
}

/**
 * 按归属分摊费用（客户货 vs 自有货）
 *
 * 先按归属类型分组，再按货值比例分摊到各明细
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 费用总额
 * @returns 分摊结果 Map<itemId, allocatedAmount>
 *
 * @example
 * ```typescript
 * const items = [
 *   { id: '1', ownership: 'customer', totalPrice: 10000 },
 *   { id: '2', ownership: 'self', totalPrice: 5000 },
 * ];
 * const result = allocateExpensesByOwnership(items, 1500);
 * // 客户货分摊: 1000, 自有货分摊: 500
 * ```
 */
export function allocateExpensesByOwnership(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // 边界情况
  if (items.length === 0 || totalExpenses === 0) {
    items.forEach(item => allocations.set(item.id, 0));
    return allocations;
  }

  // 按归属分组
  const customerItems = items.filter(item => item.ownership === 'customer');
  const selfItems = items.filter(item => item.ownership === 'self');

  // 计算各组的总金额
  const customerValue = calculateTotalValue(customerItems);
  const selfValue = calculateTotalValue(selfItems);
  const totalValue = customerValue + selfValue;

  // 边界情况：总金额为0
  if (totalValue === 0) {
    const averageExpense = roundToTwoDecimals(totalExpenses / items.length);
    items.forEach(item => allocations.set(item.id, averageExpense));
    return adjustAllocationForRoundingError(allocations, totalExpenses);
  }

  // 计算各组应分摊的费用
  const customerExpense = roundToTwoDecimals(
    (totalExpenses * customerValue) / totalValue
  );
  const selfExpense = roundToTwoDecimals(
    (totalExpenses * selfValue) / totalValue
  );

  // 在各组内按货值比例分摊
  if (customerItems.length > 0 && customerValue > 0) {
    customerItems.forEach(item => {
      const ratio = item.totalPrice / customerValue;
      const allocated = roundToTwoDecimals(customerExpense * ratio);
      allocations.set(item.id, allocated);
    });
  }

  if (selfItems.length > 0 && selfValue > 0) {
    selfItems.forEach(item => {
      const ratio = item.totalPrice / selfValue;
      const allocated = roundToTwoDecimals(selfExpense * ratio);
      allocations.set(item.id, allocated);
    });
  }

  // 调整四舍五入误差
  return adjustAllocationForRoundingError(allocations, totalExpenses);
}

/**
 * 按重量比例分摊费用
 *
 * 公式: 明细分摊费用 = 总费用 × (明细重量 / 订单总重量)
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 费用总额
 * @returns 分摊结果 Map<itemId, allocatedAmount>
 */
export function allocateExpensesByWeight(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // 边界情况
  if (items.length === 0 || totalExpenses === 0) {
    items.forEach(item => allocations.set(item.id, 0));
    return allocations;
  }

  // 计算订单总重量
  const totalWeight = calculateTotalWeight(items);

  // 边界情况：总重量为0，回退到按货值分摊
  if (totalWeight === 0) {
    return allocateExpensesByValue(items, totalExpenses);
  }

  // 按重量比例分摊（考虑单位转换）
  items.forEach(item => {
    const weight = item.weight || item.manualWeight || 0;
    const actualQuantity = getActualQuantityInPieces(item);
    const itemWeight = weight * actualQuantity;
    const ratio = itemWeight / totalWeight;
    const allocated = roundToTwoDecimals(totalExpenses * ratio);
    allocations.set(item.id, allocated);
  });

  // 调整四舍五入误差
  return adjustAllocationForRoundingError(allocations, totalExpenses);
}

/**
 * 按数量比例分摊费用
 *
 * 公式: 明细分摊费用 = 总费用 × (明细数量 / 订单总数量)
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 费用总额
 * @returns 分摊结果 Map<itemId, allocatedAmount>
 */
export function allocateExpensesByQuantity(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  // 边界情况
  if (items.length === 0 || totalExpenses === 0) {
    items.forEach(item => allocations.set(item.id, 0));
    return allocations;
  }

  // 计算订单总数量
  const totalQuantity = calculateTotalQuantity(items);

  // 边界情况：总数量为0
  if (totalQuantity === 0) {
    const averageExpense = roundToTwoDecimals(totalExpenses / items.length);
    items.forEach(item => allocations.set(item.id, averageExpense));
    return adjustAllocationForRoundingError(allocations, totalExpenses);
  }

  // 按数量比例分摊（考虑单位转换）
  items.forEach(item => {
    const actualQuantity = getActualQuantityInPieces(item);
    const ratio = actualQuantity / totalQuantity;
    const allocated = roundToTwoDecimals(totalExpenses * ratio);
    allocations.set(item.id, allocated);
  });

  // 调整四舍五入误差
  return adjustAllocationForRoundingError(allocations, totalExpenses);
}

// ==================== 汇总和转换函数 ====================

/**
 * 将分摊结果 Map 转换为结果数组
 *
 * @param allocations - 分摊结果 Map
 * @param totalExpenses - 费用总额
 * @returns 分摊结果数组
 */
export function convertAllocationsToResults(
  allocations: Map<string, number>,
  totalExpenses: number
): ExpenseAllocationResult[] {
  const results: ExpenseAllocationResult[] = [];

  allocations.forEach((allocatedAmount, itemId) => {
    const allocationRatio =
      totalExpenses > 0
        ? roundToTwoDecimals((allocatedAmount / totalExpenses) * 100)
        : 0;

    results.push({
      itemId,
      allocatedAmount,
      allocationRatio,
    });
  });

  return results;
}

/**
 * 生成费用分摊汇总报告
 *
 * @param method - 分摊方式
 * @param allocations - 分摊结果 Map
 * @param totalExpenses - 费用总额
 * @returns 分摊汇总结果
 */
export function generateAllocationSummary(
  method: 'by_value' | 'by_weight' | 'by_quantity' | 'by_ownership',
  allocations: Map<string, number>,
  totalExpenses: number
): ExpenseAllocationSummary {
  const allocatedTotal = Array.from(allocations.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );

  const difference = roundToTwoDecimals(
    Math.abs(allocatedTotal - totalExpenses)
  );

  const results = convertAllocationsToResults(allocations, totalExpenses);

  return {
    method,
    totalExpenses,
    allocatedTotal: roundToTwoDecimals(allocatedTotal),
    difference,
    results,
  };
}

/**
 * 统一的费用分摊入口函数
 *
 * 根据指定的分摊方式，调用相应的分摊算法
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 费用总额
 * @param method - 分摊方式
 * @returns 分摊汇总结果
 */
export function allocateExpenses(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number,
  method: 'by_value' | 'by_weight' | 'by_quantity' | 'by_ownership' = 'by_value'
): ExpenseAllocationSummary {
  let allocations: Map<string, number>;

  switch (method) {
    case 'by_value':
      allocations = allocateExpensesByValue(items, totalExpenses);
      break;
    case 'by_weight':
      allocations = allocateExpensesByWeight(items, totalExpenses);
      break;
    case 'by_quantity':
      allocations = allocateExpensesByQuantity(items, totalExpenses);
      break;
    case 'by_ownership':
      allocations = allocateExpensesByOwnership(items, totalExpenses);
      break;
    default:
      allocations = allocateExpensesByValue(items, totalExpenses);
  }

  return generateAllocationSummary(method, allocations, totalExpenses);
}
