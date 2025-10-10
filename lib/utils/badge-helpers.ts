/**
 * 统一的徽章工具函数
 * 严格遵循 DRY 原则，避免重复代码
 */

import type { BadgeProps } from '@/components/ui/badge';

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
 * @param status - 状态值
 * @returns Badge 变体
 */
export function getCommonStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'active':
      return 'default';
    case 'inactive':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * 获取销售订单状态的徽章变体
 *
 * @param status - 销售订单状态
 * @returns Badge 变体
 */
export function getSalesOrderStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'outline';
    case 'pending':
      return 'outline';
    case 'confirmed':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'shipped':
      return 'secondary';
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * 获取退货订单状态的徽章变体
 *
 * @param status - 退货订单状态
 * @returns Badge 变体
 */
export function getReturnOrderStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'submitted':
      return 'default';
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * 获取厂家发货状态的徽章变体
 *
 * @param status - 厂家发货状态
 * @returns Badge 变体
 */
export function getFactoryShipmentStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'outline';
    case 'confirmed':
      return 'default';
    case 'shipped':
      return 'secondary';
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * 获取应付账款状态的徽章变体
 *
 * @param status - 应付账款状态
 * @returns Badge 变体
 */
export function getPayableStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'outline';
    case 'partial':
      return 'secondary';
    case 'paid':
      return 'default';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * 获取应收账款状态的徽章变体
 *
 * @param status - 应收账款状态
 * @returns Badge 变体
 */
export function getReceivableStatusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'outline';
    case 'partial':
      return 'secondary';
    case 'paid':
      return 'default';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
}
