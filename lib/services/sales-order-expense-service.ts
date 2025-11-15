/**
 * 销售订单费用分摊服务
 *
 * 提供统一的费用分摊和利润计算方法
 */

/**
 * 订单明细项（用于费用分摊）
 */
export interface OrderItemForExpense {
  id: string;
  subtotal: number; // 销售金额（单价 * 数量）
  costSubtotal?: number | null; // 成本小计
  unitCost?: number | null; // 单位成本
  quantity: number; // 数量
}

/**
 * 费用分摊结果
 */
export interface ExpenseAllocationResult {
  itemId: string;
  allocatedExpense: number; // 分摊的费用
  totalCost: number; // 总成本（成本小计 + 分摊费用）
  profitAmount: number; // 利润金额（销售金额 - 总成本）
  profitMargin: number; // 利润率（利润金额 / 销售金额）
}

/**
 * 费用分摊服务类
 */
export class SalesOrderExpenseService {
  /**
   * 按销售金额比例分摊费用
   *
   * @param items - 订单明细项列表
   * @param totalExpense - 总费用金额
   * @returns 费用分摊结果列表
   *
   * @example
   * ```ts
   * const items = [
   *   { id: '1', subtotal: 1000, costSubtotal: 600, quantity: 10 },
   *   { id: '2', subtotal: 2000, costSubtotal: 1200, quantity: 20 },
   * ];
   * const results = service.allocateExpensesByValue(items, 300);
   * // results[0].allocatedExpense = 100 (1000 / 3000 * 300)
   * // results[1].allocatedExpense = 200 (2000 / 3000 * 300)
   * ```
   */
  allocateExpensesByValue(
    items: OrderItemForExpense[],
    totalExpense: number
  ): ExpenseAllocationResult[] {
    // 计算总销售金额
    const totalSalesAmount = items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    // 如果总销售金额为 0，无法分摊
    if (totalSalesAmount === 0) {
      return items.map(item => ({
        itemId: item.id,
        allocatedExpense: 0,
        totalCost: item.costSubtotal ?? 0,
        profitAmount: item.subtotal - (item.costSubtotal ?? 0),
        profitMargin: this.calculateProfitMargin(
          item.subtotal,
          item.costSubtotal ?? 0
        ),
      }));
    }

    // 按比例分摊费用
    let allocatedSum = 0;
    const results: ExpenseAllocationResult[] = [];

    items.forEach((item, index) => {
      const isLastItem = index === items.length - 1;

      // 计算分摊比例
      const ratio = item.subtotal / totalSalesAmount;

      // 计算分摊费用（最后一项使用差额，避免精度问题）
      const allocatedExpense = isLastItem
        ? totalExpense - allocatedSum
        : this.roundToTwoDecimals(totalExpense * ratio);

      allocatedSum += allocatedExpense;

      // 计算总成本
      const costSubtotal = item.costSubtotal ?? 0;
      const totalCost = costSubtotal + allocatedExpense;

      // 计算利润
      const profitAmount = item.subtotal - totalCost;
      const profitMargin = this.calculateProfitMargin(
        item.subtotal,
        totalCost
      );

      results.push({
        itemId: item.id,
        allocatedExpense: this.roundToTwoDecimals(allocatedExpense),
        totalCost: this.roundToTwoDecimals(totalCost),
        profitAmount: this.roundToTwoDecimals(profitAmount),
        profitMargin: this.roundToTwoDecimals(profitMargin),
      });
    });

    return results;
  }

  /**
   * 计算利润率
   *
   * @param salesAmount - 销售金额
   * @param totalCost - 总成本
   * @returns 利润率（百分比，保留两位小数）
   *
   * @example
   * ```ts
   * const margin = service.calculateProfitMargin(1000, 600);
   * // margin = 40.00 (表示 40%)
   * ```
   */
  calculateProfitMargin(salesAmount: number, totalCost: number): number {
    if (salesAmount === 0) {
      return 0;
    }

    const profitAmount = salesAmount - totalCost;
    const margin = (profitAmount / salesAmount) * 100;

    return this.roundToTwoDecimals(margin);
  }

  /**
   * 四舍五入到两位小数
   *
   * @param value - 原始值
   * @returns 保留两位小数的值
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * 批量更新订单明细的费用分摊和利润信息
   *
   * @param items - 订单明细项列表
   * @param totalExpense - 总费用金额
   * @returns 更新后的订单明细项列表
   *
   * @example
   * ```ts
   * const updatedItems = service.updateItemsWithExpenseAllocation(items, 300);
   * // updatedItems 中每个 item 都包含了 allocatedExpense 和 profitMargin
   * ```
   */
  updateItemsWithExpenseAllocation<T extends OrderItemForExpense>(
    items: T[],
    totalExpense: number
  ): (T & {
    allocatedExpense: number;
    profitAmount: number;
    profitMargin: number;
  })[] {
    const allocationResults = this.allocateExpensesByValue(items, totalExpense);

    return items.map((item, index) => {
      const result = allocationResults[index];

      return {
        ...item,
        allocatedExpense: result.allocatedExpense,
        profitAmount: result.profitAmount,
        profitMargin: result.profitMargin,
      };
    });
  }
}

/**
 * 导出单例实例
 */
export const salesOrderExpenseService = new SalesOrderExpenseService();

/**
 * 导出便捷方法
 */
export const allocateExpensesByValue = (
  items: OrderItemForExpense[],
  totalExpense: number
) => salesOrderExpenseService.allocateExpensesByValue(items, totalExpense);

export const calculateProfitMargin = (
  salesAmount: number,
  totalCost: number
) => salesOrderExpenseService.calculateProfitMargin(salesAmount, totalCost);

export const updateItemsWithExpenseAllocation = <
  T extends OrderItemForExpense,
>(
  items: T[],
  totalExpense: number
) => salesOrderExpenseService.updateItemsWithExpenseAllocation(items, totalExpense);

