/**
 * 统一的徽章工具函数
 * 严格遵循 DRY 原则，避免重复代码
 *
 * @deprecated 推荐直接使用各模块的 STATUS_VARIANTS 常量
 * 本文件保留仅用于向后兼容
 */

import type { BadgeProps } from '@/components/ui/badge';

// 直接导出各模块的 STATUS_VARIANTS
export { SALES_ORDER_STATUS_VARIANTS } from '@/lib/types/sales-order';
export { RETURN_ORDER_STATUS_VARIANTS } from '@/lib/types/return-order';
export { FACTORY_SHIPMENT_STATUS_VARIANTS } from '@/lib/types/factory-shipment';
export { PRODUCT_STATUS_VARIANTS } from '@/lib/types/product';
export { USER_STATUS_VARIANTS } from '@/lib/types/user';
export { PAYABLE_STATUS_VARIANTS, PAYMENT_OUT_STATUS_VARIANTS } from '@/lib/types/payable';
export { PAYMENT_STATUS_VARIANTS } from '@/lib/types/payment';
export { REFUND_STATUS_VARIANTS } from '@/lib/types/refund';
export { ADJUSTMENT_STATUS_VARIANTS } from '@/lib/types/inventory-operations';
export { INVENTORY_STATUS_VARIANTS } from '@/lib/types/inventory-status';

/**
 * Badge 变体类型
 */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'purple';

/**
 * 通用状态类型
 */
export type CommonStatus = 'active' | 'inactive';

/**
 * 获取通用状态（active/inactive）的徽章变体
 *
 * @deprecated 请直接使用 PRODUCT_STATUS_VARIANTS 或 USER_STATUS_VARIANTS
 * @param status - 状态值
 * @returns Badge 变体
 */
export function getCommonStatusBadgeVariant(
  status: string
): BadgeVariant {
  const { PRODUCT_STATUS_VARIANTS } = require('@/lib/types/product');
  return PRODUCT_STATUS_VARIANTS[status] || 'outline';
}

/**
 * 获取销售订单状态的徽章变体
 *
 * @deprecated 请直接使用 SALES_ORDER_STATUS_VARIANTS
 * @param status - 销售订单状态
 * @returns Badge 变体
 */
export function getSalesOrderStatusBadgeVariant(
  status: string
): BadgeVariant {
  const { SALES_ORDER_STATUS_VARIANTS } = require('@/lib/types/sales-order');
  return SALES_ORDER_STATUS_VARIANTS[status as keyof typeof SALES_ORDER_STATUS_VARIANTS] || 'outline';
}

/**
 * 获取退货订单状态的徽章变体
 *
 * @deprecated 请直接使用 RETURN_ORDER_STATUS_VARIANTS
 * @param status - 退货订单状态
 * @returns Badge 变体
 */
export function getReturnOrderStatusBadgeVariant(
  status: string
): BadgeVariant {
  const { RETURN_ORDER_STATUS_VARIANTS } = require('@/lib/types/return-order');
  return RETURN_ORDER_STATUS_VARIANTS[status as keyof typeof RETURN_ORDER_STATUS_VARIANTS] || 'outline';
}

/**
 * 获取厂家发货状态的徽章变体
 *
 * @deprecated 请直接使用 FACTORY_SHIPMENT_STATUS_VARIANTS
 * @param status - 厂家发货状态
 * @returns Badge 变体
 */
export function getFactoryShipmentStatusBadgeVariant(
  status: string
): BadgeVariant {
  // 导入类型定义中的映射
  const {
    FACTORY_SHIPMENT_STATUS_VARIANTS,
    FACTORY_SHIPMENT_STATUS,
  } = require('@/lib/types/factory-shipment');

  // 使用类型定义中的标准映射
  return (
    FACTORY_SHIPMENT_STATUS_VARIANTS[status as keyof typeof FACTORY_SHIPMENT_STATUS] ||
    'outline'
  );
}

/**
 * 获取应付账款状态的徽章变体
 *
 * @deprecated 请直接使用 PAYABLE_STATUS_VARIANTS
 * @param status - 应付账款状态
 * @returns Badge 变体
 */
export function getPayableStatusBadgeVariant(
  status: string
): BadgeVariant {
  const { PAYABLE_STATUS_VARIANTS } = require('@/lib/types/payable');
  return PAYABLE_STATUS_VARIANTS[status as keyof typeof PAYABLE_STATUS_VARIANTS] || 'outline';
}

/**
 * 获取应收账款状态的徽章变体
 *
 * @deprecated 请直接使用 PAYABLE_STATUS_VARIANTS (应收应付状态一致)
 * @param status - 应收账款状态
 * @returns Badge 变体
 */
export function getReceivableStatusBadgeVariant(
  status: string
): BadgeVariant {
  const { PAYABLE_STATUS_VARIANTS } = require('@/lib/types/payable');
  return PAYABLE_STATUS_VARIANTS[status as keyof typeof PAYABLE_STATUS_VARIANTS] || 'outline';
}
