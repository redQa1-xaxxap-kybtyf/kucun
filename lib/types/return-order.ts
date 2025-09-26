// 退货管理类型定义
// 严格遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Customer } from './customer';
import type { Product } from './product';
import type { SalesOrder } from './sales-order';
import type { User } from './user';

// 退货状态枚举
export type ReturnOrderStatus =
  | 'draft' // 草稿
  | 'submitted' // 已提交
  | 'approved' // 已审核
  | 'rejected' // 已拒绝
  | 'processing' // 处理中
  | 'completed' // 已完成
  | 'cancelled'; // 已取消

// 退货类型枚举
export type ReturnOrderType =
  | 'quality_issue' // 质量问题
  | 'wrong_product' // 产品错误
  | 'customer_change' // 客户变更
  | 'damage_in_transit' // 运输损坏
  | 'other'; // 其他原因

// 退货处理方式枚举
export type ReturnProcessType =
  | 'refund' // 退款
  | 'exchange' // 换货
  | 'repair' // 维修
  | 'credit'; // 积分补偿

// 退货订单接口
export interface ReturnOrder {
  id: string;
  returnNumber: string;
  salesOrderId: string;
  customerId: string;
  userId: string;
  type: ReturnOrderType;
  processType: ReturnProcessType;
  status: ReturnOrderStatus;
  reason: string;
  totalAmount: number;
  refundAmount: number;
  remarks?: string;
  submittedAt?: string;
  approvedAt?: string;
  processedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;

  // 关联对象
  salesOrder?: SalesOrder;
  customer?: Customer;
  user?: User;
  items?: ReturnOrderItem[];
}

// 退货订单明细接口
export interface ReturnOrderItem {
  id: string;
  returnOrderId: string;
  salesOrderItemId: string;
  productId: string;
  colorCode?: string;
  productionDate?: string;
  returnQuantity: number;
  originalQuantity: number;
  unitPrice: number;
  subtotal: number;
  reason?: string;
  condition: 'good' | 'damaged' | 'defective';

  // 关联对象
  product?: Product;
  salesOrderItem?: {
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  };
}

// 退货统计接口
export interface ReturnOrderStats {
  totalReturns: number;
  totalRefundAmount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  completedCount: number;
  monthlyReturns: number;
  monthlyRefundAmount: number;
}

// 退货查询参数接口
export interface ReturnOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReturnOrderStatus;
  type?: ReturnOrderType;
  processType?: ReturnProcessType;
  customerId?: string;
  salesOrderId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// API响应接口
export interface ReturnOrderResponse {
  success: boolean;
  data: ReturnOrder;
  message?: string;
}

export interface ReturnOrderListResponse {
  success: boolean;
  data: {
    returnOrders: ReturnOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface ReturnOrderStatsResponse {
  success: boolean;
  data: ReturnOrderStats;
  message?: string;
}

// 退货状态标签映射
export const RETURN_ORDER_STATUS_LABELS: Record<ReturnOrderStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已审核',
  rejected: '已拒绝',
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消',
};

// 退货类型标签映射
export const RETURN_ORDER_TYPE_LABELS: Record<ReturnOrderType, string> = {
  quality_issue: '质量问题',
  wrong_product: '产品错误',
  customer_change: '客户变更',
  damage_in_transit: '运输损坏',
  other: '其他原因',
};

// 退货处理方式标签映射
export const RETURN_PROCESS_TYPE_LABELS: Record<ReturnProcessType, string> = {
  refund: '退款',
  exchange: '换货',
  repair: '维修',
  credit: '积分补偿',
};

// 退货状态变体映射（用于Badge组件）
export const RETURN_ORDER_STATUS_VARIANTS: Record<
  ReturnOrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  processing: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

// 退货排序选项
export const RETURN_ORDER_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'returnNumber', label: '退货单号' },
  { value: 'totalAmount', label: '退货金额' },
  { value: 'status', label: '状态' },
  { value: 'submittedAt', label: '提交时间' },
  { value: 'completedAt', label: '完成时间' },
];

// 注意：分页常量已迁移到环境配置 (lib/env.ts)
// 请使用 paginationConfig.defaultPageSize 和 paginationConfig.maxPageSize

// 业务逻辑辅助函数

/**
 * 获取退货状态信息
 */
export function getReturnOrderStatus(returnOrder: ReturnOrder) {
  const status = returnOrder.status;
  return {
    label: RETURN_ORDER_STATUS_LABELS[status],
    variant: RETURN_ORDER_STATUS_VARIANTS[status],
    value: status,
  };
}

/**
 * 检查退货状态流转是否有效
 */
export function isValidReturnStatusTransition(
  from: ReturnOrderStatus,
  to: ReturnOrderStatus
): boolean {
  const validTransitions: Record<ReturnOrderStatus, ReturnOrderStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected', 'cancelled'],
    approved: ['processing', 'cancelled'],
    rejected: ['cancelled'],
    processing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * 格式化退货金额
 */
export function formatReturnAmount(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * 格式化退货日期
 */
export function formatReturnDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 计算退货明细总金额
 */
export function calculateReturnItemsTotal(items: ReturnOrderItem[]): number {
  return items.reduce((total, item) => total + item.subtotal, 0);
}

/**
 * 检查是否可以编辑退货订单
 */
export function canEditReturnOrder(returnOrder: ReturnOrder): boolean {
  return returnOrder.status === 'draft';
}

/**
 * 检查是否可以提交退货订单
 */
export function canSubmitReturnOrder(returnOrder: ReturnOrder): boolean {
  return returnOrder.status === 'draft' && (returnOrder.items?.length ?? 0) > 0;
}

/**
 * 检查是否可以审核退货订单
 */
export function canApproveReturnOrder(returnOrder: ReturnOrder): boolean {
  return returnOrder.status === 'submitted';
}

/**
 * 检查是否可以处理退货订单
 */
export function canProcessReturnOrder(returnOrder: ReturnOrder): boolean {
  return returnOrder.status === 'approved';
}

/**
 * 检查是否可以完成退货订单
 */
export function canCompleteReturnOrder(returnOrder: ReturnOrder): boolean {
  return returnOrder.status === 'processing';
}

/**
 * 检查是否可以取消退货订单
 */
export function canCancelReturnOrder(returnOrder: ReturnOrder): boolean {
  return ['draft', 'submitted', 'approved', 'processing'].includes(
    returnOrder.status
  );
}
