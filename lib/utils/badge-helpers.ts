/**
 * 统一的徽章工具函数
 * 严格遵循 DRY 原则，避免重复代码
 *
 * @deprecated 推荐直接使用各模块的 STATUS_VARIANTS 常量
 * 本文件保留仅用于向后兼容
 */

import { SALES_ORDER_STATUS_VARIANTS } from '@/lib/types/sales-order';
import { RETURN_ORDER_STATUS_VARIANTS } from '@/lib/types/return-order';
import { FACTORY_SHIPMENT_STATUS_VARIANTS } from '@/lib/types/factory-shipment';
import { PRODUCT_STATUS_VARIANTS } from '@/lib/types/product';
import { USER_STATUS_VARIANTS } from '@/lib/types/user';
import {
  PAYABLE_STATUS_VARIANTS,
  PAYMENT_OUT_STATUS_VARIANTS,
} from '@/lib/types/payable';
import { PAYMENT_STATUS_VARIANTS } from '@/lib/types/payment';
import { REFUND_STATUS_VARIANTS } from '@/lib/types/refund';
import { ADJUSTMENT_STATUS_VARIANTS } from '@/lib/types/inventory-operations';
import { INVENTORY_STATUS_VARIANTS } from '@/lib/types/inventory-status';

export {
  SALES_ORDER_STATUS_VARIANTS,
  RETURN_ORDER_STATUS_VARIANTS,
  FACTORY_SHIPMENT_STATUS_VARIANTS,
  PRODUCT_STATUS_VARIANTS,
  USER_STATUS_VARIANTS,
  PAYABLE_STATUS_VARIANTS,
  PAYMENT_OUT_STATUS_VARIANTS,
  PAYMENT_STATUS_VARIANTS,
  REFUND_STATUS_VARIANTS,
  ADJUSTMENT_STATUS_VARIANTS,
  INVENTORY_STATUS_VARIANTS,
};

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
export function getCommonStatusBadgeVariant(status: string): BadgeVariant {
  return (
    PRODUCT_STATUS_VARIANTS[status as keyof typeof PRODUCT_STATUS_VARIANTS] ||
    'outline'
  );
}

/**
 * 获取销售订单状态的徽章变体
 *
 * @deprecated 请直接使用 SALES_ORDER_STATUS_VARIANTS
 * @param status - 销售订单状态
 * @returns Badge 变体
 */
export function getSalesOrderStatusBadgeVariant(status: string): BadgeVariant {
  return (
    SALES_ORDER_STATUS_VARIANTS[
      status as keyof typeof SALES_ORDER_STATUS_VARIANTS
    ] || 'outline'
  );
}

/**
 * 获取退货订单状态的徽章变体
 *
 * @deprecated 请直接使用 RETURN_ORDER_STATUS_VARIANTS
 * @param status - 退货订单状态
 * @returns Badge 变体
 */
export function getReturnOrderStatusBadgeVariant(status: string): BadgeVariant {
  return (
    RETURN_ORDER_STATUS_VARIANTS[
      status as keyof typeof RETURN_ORDER_STATUS_VARIANTS
    ] || 'outline'
  );
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
  return (
    FACTORY_SHIPMENT_STATUS_VARIANTS[
      status as keyof typeof FACTORY_SHIPMENT_STATUS_VARIANTS
    ] || 'outline'
  );
}

/**
 * 获取应付账款状态的徽章变体
 *
 * @deprecated 请直接使用 PAYABLE_STATUS_VARIANTS
 * @param status - 应付账款状态
 * @returns Badge 变体
 */
export function getPayableStatusBadgeVariant(status: string): BadgeVariant {
  return (
    PAYABLE_STATUS_VARIANTS[status as keyof typeof PAYABLE_STATUS_VARIANTS] ||
    'outline'
  );
}

/**
 * 获取应收账款状态的徽章变体
 *
 * @deprecated 请直接使用 PAYABLE_STATUS_VARIANTS (应收应付状态一致)
 * @param status - 应收账款状态
 * @returns Badge 变体
 */
export function getReceivableStatusBadgeVariant(status: string): BadgeVariant {
  return (
    PAYABLE_STATUS_VARIANTS[status as keyof typeof PAYABLE_STATUS_VARIANTS] ||
    'outline'
  );
}
