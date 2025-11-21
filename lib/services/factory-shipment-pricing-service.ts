/**
 * 厂家发货定价服务
 *
 * 功能：
 * - 根据进货价、运费分摊、目标利润率自动计算销售价
 * - 支持批量计算订单所有产品的建议销售价
 *
 * 设计原则：
 * - KISS: 计算逻辑简单直观
 * - DRY: 复用费用分摊服务
 * - SOLID: 单一职责，专注于定价计算
 */

import type { FactoryShipmentOrderItem } from '@/lib/types/factory-shipment';

import {
  allocateExpensesByValue,
  roundToTwoDecimals,
} from './factory-shipment-expense-service';

/**
 * 定价配置选项
 */
export interface PricingOptions {
  targetProfitMargin?: number; // 目标利润率（%），默认 20%
  minProfitMargin?: number; // 最低利润率（%），默认 10%
  roundingRule?: 'up' | 'down' | 'nearest'; // 价格取整规则，默认 'nearest'
}

/**
 * 单个产品的定价结果
 */
export interface ItemPricingResult {
  itemId: string;
  unitCost: number; // 进货单价
  allocatedExpense: number; // 分摊运费
  finalUnitCost: number; // 最终单位成本（进货价 + 分摊运费/数量）
  suggestedUnitPrice: number; // 建议销售单价
  profitMargin: number; // 利润率（%）
}

/**
 * 计算单个产品的建议销售价
 *
 * @param item - 订单明细
 * @param allocatedExpense - 分摊到该产品的运费
 * @param options - 定价配置
 * @returns 定价结果
 */
export function calculateSuggestedPrice(
  item: FactoryShipmentOrderItem,
  allocatedExpense: number,
  options: PricingOptions = {}
): ItemPricingResult {
  const {
    targetProfitMargin = 20,
    minProfitMargin = 10,
    roundingRule = 'nearest',
  } = options;

  // 进货单价
  const unitCost = item.unitCost || item.unitPrice;

  // 计算实际片数：如果单位是"件"，需要转换为片数
  let actualQuantityInPieces = item.quantity;
  if (item.unit === '件' && item.piecesPerUnit && item.piecesPerUnit > 0) {
    actualQuantityInPieces = item.quantity * item.piecesPerUnit;
  }

  // 最终单位成本 = 进货单价 + 分摊运费 / 实际片数
  const finalUnitCost =
    actualQuantityInPieces > 0
      ? roundToTwoDecimals(unitCost + allocatedExpense / actualQuantityInPieces)
      : unitCost;

  // 建议销售价 = 最终单位成本 × (1 + 目标利润率)
  let suggestedPrice = finalUnitCost * (1 + targetProfitMargin / 100);

  // 应用取整规则
  suggestedPrice = applyRoundingRule(suggestedPrice, roundingRule);

  // 确保不低于最低利润率
  const minPrice = finalUnitCost * (1 + minProfitMargin / 100);
  if (suggestedPrice < minPrice) {
    suggestedPrice = applyRoundingRule(minPrice, roundingRule);
  }

  // 计算实际利润率
  const actualProfitMargin =
    finalUnitCost > 0
      ? roundToTwoDecimals(
          ((suggestedPrice - finalUnitCost) / suggestedPrice) * 100
        )
      : 0;

  return {
    itemId: item.id,
    unitCost,
    allocatedExpense,
    finalUnitCost,
    suggestedUnitPrice: suggestedPrice,
    profitMargin: actualProfitMargin,
  };
}

/**
 * 批量计算订单所有产品的建议销售价
 *
 * @param items - 订单明细列表
 * @param totalExpenses - 总运费（从 feeItems 计算）
 * @param options - 定价配置
 * @returns 所有产品的定价结果
 */
export function calculateOrderPricing(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number,
  options: PricingOptions = {}
): ItemPricingResult[] {
  // 按进货价比例分摊运费
  const expenseAllocations = allocateExpensesByValue(items, totalExpenses);

  // 计算每个产品的建议销售价
  return items.map(item => {
    const allocatedExpense = expenseAllocations.get(item.id) || 0;
    return calculateSuggestedPrice(item, allocatedExpense, options);
  });
}

/**
 * 应用价格取整规则
 *
 * @param price - 原始价格
 * @param rule - 取整规则
 * @returns 取整后的价格
 */
function applyRoundingRule(
  price: number,
  rule: 'up' | 'down' | 'nearest'
): number {
  switch (rule) {
    case 'up':
      return Math.ceil(price * 100) / 100;
    case 'down':
      return Math.floor(price * 100) / 100;
    case 'nearest':
    default:
      return roundToTwoDecimals(price);
  }
}
