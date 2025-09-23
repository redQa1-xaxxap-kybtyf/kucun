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
  colorCode?: string;
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
  colorCode?: string;
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
  colorCode?: string;
  quantity: number;
  unitCost?: number;
  supplierId?: string;
  remarks?: string;
}

export interface OutboundCreateInput {
  type: OutboundType;
  productId: string;
  colorCode?: string;
  quantity: number;
  unitCost?: number;
  customerId?: string;
  salesOrderId?: string;
  remarks?: string;
}

// 库存调整输入类型
export interface InventoryAdjustInput {
  productId: string;
  colorCode?: string;
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
  colorCode?: string;
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
