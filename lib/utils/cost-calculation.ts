/**
 * 成本计算工具函数
 * 实现加权平均成本计算逻辑
 *
 * 遵循原则：
 * - KISS: 保持计算逻辑简单直观
 * - DRY: 避免重复的成本计算代码
 * - 单一职责: 每个函数只负责一种计算
 */

import { formatCostPrice, roundCostPrice } from '@/lib/utils/cost-price';

/**
 * 计算加权平均成本
 *
 * 公式: 新单位成本 = (原库存金额 + 入库金额) / (原库存数量 + 入库数量)
 *
 * @param currentQuantity 当前库存数量
 * @param currentUnitCost 当前单位成本
 * @param inboundQuantity 入库数量
 * @param inboundUnitCost 入库单位成本
 * @returns 新的加权平均单位成本（保留3位小数）
 *
 * @example
 * // 原库存: 100片 × ￥10/片 = ￥1000
 * // 入库: 50片 × ￥12/片 = ￥600
 * // 新成本: (1000 + 600) / (100 + 50) = ￥10.67/片
 * calculateWeightedAverageCost(100, 10, 50, 12) // 10.667
 */
export function calculateWeightedAverageCost(
  currentQuantity: number,
  currentUnitCost: number,
  inboundQuantity: number,
  inboundUnitCost: number
): number {
  // 计算总数量
  const totalQuantity = currentQuantity + inboundQuantity;

  // 如果总数量为0，返回0（避免除以0）
  if (totalQuantity === 0) {
    return 0;
  }

  // 计算原库存总成本
  const currentTotalCost = currentQuantity * currentUnitCost;

  // 计算入库总成本
  const inboundTotalCost = inboundQuantity * inboundUnitCost;

  // 计算总成本
  const totalCost = currentTotalCost + inboundTotalCost;

  // 计算加权平均单位成本
  const weightedAverageCost = totalCost / totalQuantity;

  // 单位成本统一保留3位小数
  return roundCostPrice(weightedAverageCost);
}

/**
 * 计算总成本
 *
 * @param quantity 数量
 * @param unitCost 单位成本
 * @returns 总成本（保留2位小数）
 *
 * @example
 * calculateTotalCost(100, 10.5) // 1050.00
 */
export function calculateTotalCost(quantity: number, unitCost: number): number {
  const totalCost = quantity * unitCost;

  // 保留2位小数
  return Math.round(totalCost * 100) / 100;
}

/**
 * 格式化成本为货币字符串
 *
 * @param cost 成本金额
 * @param showSymbol 是否显示货币符号（默认true）
 * @returns 格式化后的货币字符串
 *
 * @example
 * formatCost(1234.56) // "￥1,234.560"
 * formatCost(1234.56, false) // "1,234.560"
 */
export function formatCost(cost: number, showSymbol = true): string {
  return formatCostPrice(cost, { withSymbol: showSymbol });
}

/**
 * 验证成本值是否有效
 *
 * @param cost 成本值
 * @returns 是否有效
 */
export function isValidCost(cost: number | null | undefined): cost is number {
  return (
    cost !== null &&
    cost !== undefined &&
    typeof cost === 'number' &&
    !Number.isNaN(cost) &&
    Number.isFinite(cost) &&
    cost >= 0
  );
}
