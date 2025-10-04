/**
 * 销售订单工具函数
 * 从 lib/schemas/sales-order.ts 迁移而来
 */

import type { SalesOrderItemFormData } from '@/lib/validations/sales-order';

/**
 * 销售订单项数据类型（用于计算函数）
 * 使用验证规则中的类型定义，确保类型一致性
 */
export type SalesOrderItemData = SalesOrderItemFormData;

/**
 * 计算订单项小计
 */
export function calculateItemSubtotal(
  quantity: number,
  unitPrice: number
): number {
  return quantity * unitPrice;
}

/**
 * 计算订单总额
 */
export function calculateOrderTotal(items: SalesOrderItemData[]): number {
  return items.reduce((total, item) => {
    const unitPrice = item.unitPrice || 0;
    return total + calculateItemSubtotal(item.quantity, unitPrice);
  }, 0);
}
