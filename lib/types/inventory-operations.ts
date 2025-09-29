/**
 * 库存操作相关类型定义
 * 包含入库、出库、调整等操作的类型定义
 */

import type { Product } from './product';
import type { User } from './user';

// 入库类型枚举
export type InboundType =
  | 'normal_inbound'
  | 'return_inbound'
  | 'adjust_inbound';

// 出库类型枚举
export type OutboundType =
  | 'normal_outbound'
  | 'sales_outbound'
  | 'adjust_outbound';

// 入库记录类型
export interface InboundRecord {
  id: string;
  recordNumber: string;
  type: InboundType;
  productId: string;
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  supplierId?: string;
  userId: string;
  remarks?: string;
  createdAt: string;

  // 关联数据（可选）
  product?: Product;
  user?: User;
}

// 出库记录类型
export interface OutboundRecord {
  id: string;
  recordNumber: string;
  type: OutboundType;
  productId: string;
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  customerId?: string;
  salesOrderId?: string;
  userId: string;
  remarks?: string;
  createdAt: string;

  // 关联数据（可选）
  product?: Product;
  user?: User;
}

// 库存操作输入类型
export interface InboundCreateInput {
  type: InboundType;
  productId: string;
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  supplierId?: string;
  remarks?: string;
}

export interface OutboundCreateInput {
  type: OutboundType;
  productId: string;
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  customerId?: string;
  salesOrderId?: string;
  remarks?: string;
}

// 库存调整输入类型
export interface InventoryAdjustInput {
  productId: string;
  batchNumber?: string;
  adjustQuantity: number; // 正数为增加，负数为减少
  reason: string;
  remarks?: string;
}

// 库存盘点输入类型
export interface InventoryCountInput {
  items: InventoryCountItem[];
  remarks?: string;
}

export interface InventoryCountItem {
  productId: string;
  batchNumber?: string;
  actualQuantity: number;
  systemQuantity: number;
}

// 显示标签映射
export const INBOUND_TYPE_LABELS: Record<InboundType, string> = {
  normal_inbound: '正常入库',
  return_inbound: '退货入库',
  adjust_inbound: '调整入库',
};

export const OUTBOUND_TYPE_LABELS: Record<OutboundType, string> = {
  normal_outbound: '正常出库',
  sales_outbound: '销售出库',
  adjust_outbound: '调整出库',
};

export const INBOUND_TYPE_VARIANTS: Record<
  InboundType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  normal_inbound: 'default',
  return_inbound: 'secondary',
  adjust_inbound: 'outline',
};

export const OUTBOUND_TYPE_VARIANTS: Record<
  OutboundType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  normal_outbound: 'default',
  sales_outbound: 'secondary',
  adjust_outbound: 'outline',
};

// 排序选项
export const INBOUND_SORT_OPTIONS = [
  { value: 'createdAt', label: '入库时间' },
  { value: 'recordNumber', label: '入库单号' },
  { value: 'quantity', label: '入库数量' },
  { value: 'totalCost', label: '入库金额' },
] as const;

export const OUTBOUND_SORT_OPTIONS = [
  { value: 'createdAt', label: '出库时间' },
  { value: 'recordNumber', label: '出库单号' },
  { value: 'quantity', label: '出库数量' },
  { value: 'totalCost', label: '出库金额' },
] as const;

// 库存记录号生成规则说明
export const INBOUND_NUMBER_FORMAT = 'IN + YYYYMMDD + 6位时间戳';
export const OUTBOUND_NUMBER_FORMAT = 'OUT + YYYYMMDD + 6位时间戳';

/**
 * 计算总成本
 * @param quantity 数量
 * @param unitCost 单位成本
 * @returns 总成本（保留2位小数）
 */
export const calculateTotalCost = (
  quantity: number,
  unitCost: number
): number => Math.round(quantity * unitCost * 100) / 100;

// 库存调整原因枚举
export type AdjustmentReason =
  | 'inventory_gain'
  | 'inventory_loss'
  | 'damage_loss'
  | 'surplus_gain'
  | 'transfer'
  | 'other';

// 库存调整状态枚举
export type AdjustmentStatus = 'draft' | 'pending' | 'approved' | 'rejected';

// 库存调整记录类型
export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  productId: string;
  variantId?: string;
  batchNumber?: string;
  beforeQuantity: number;
  adjustQuantity: number;
  afterQuantity: number;
  reason: AdjustmentReason;
  notes?: string;
  status: AdjustmentStatus;
  operatorId: string;
  approverId?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;

  // 关联数据（可选）
  product?: Product;
  variant?: import('./product').ProductVariant;
  operator?: User;
  approver?: User;
}

// 库存调整记录查询参数
export interface AdjustmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'adjustmentNumber' | 'adjustQuantity' | 'reason';
  sortOrder?: 'asc' | 'desc';
  productId?: string;
  variantId?: string;
  batchNumber?: string;
  reason?: AdjustmentReason;
  status?: AdjustmentStatus;
  operatorId?: string;
  startDate?: string;
  endDate?: string;
}

// 库存调整记录列表响应
export interface AdjustmentListResponse {
  success: boolean;
  data: {
    adjustments: InventoryAdjustment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

// 库存调整记录详情响应
export interface AdjustmentDetailResponse {
  success: boolean;
  data: InventoryAdjustment;
  message?: string;
}

// 调整原因标签映射
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  inventory_gain: '盘盈',
  inventory_loss: '盘亏',
  damage_loss: '报损',
  surplus_gain: '报溢',
  transfer: '调拨',
  other: '其他',
};

// 调整状态标签映射
export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已审批',
  rejected: '已拒绝',
};

// 调整状态颜色映射
export const ADJUSTMENT_STATUS_VARIANTS: Record<
  AdjustmentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

// 调整记录排序选项
export const ADJUSTMENT_SORT_OPTIONS = [
  { value: 'createdAt', label: '调整时间' },
  { value: 'adjustmentNumber', label: '调整单号' },
  { value: 'adjustQuantity', label: '调整数量' },
  { value: 'reason', label: '调整原因' },
] as const;

// 调整记录号生成规则说明
export const ADJUSTMENT_NUMBER_FORMAT = 'TZ + YYYYMMDD + 6位序号';
