/**
 * 库存查询和响应相关类型定义
 * 包含API查询参数、响应格式和分页信息
 */

import type { Inventory } from './inventory-core';
import type {
  InboundRecord,
  InboundType,
  OutboundRecord,
  OutboundType,
} from './inventory-operations';

// API 查询参数类型
export interface InventoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'productName' | 'quantity' | 'reservedQuantity' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  productId?: string;
  variantId?: string; // 产品变体ID筛选
  batchNumber?: string; // 批次号筛选
  location?: string; // 存储位置筛选
  categoryId?: string; // 产品分类筛选
  lowStock?: boolean;
  hasStock?: boolean;
  groupByVariant?: boolean; // 是否按变体分组显示
  includeVariants?: boolean; // 是否包含变体信息
}

export interface InboundRecordQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'recordNumber' | 'quantity' | 'totalCost';
  sortOrder?: 'asc' | 'desc';
  type?: InboundType;
  productId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface OutboundRecordQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'recordNumber' | 'quantity' | 'totalCost';
  sortOrder?: 'asc' | 'desc';
  type?: OutboundType;
  productId?: string;
  customerId?: string;
  salesOrderId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// 分页信息类型
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API 响应类型
export interface InventoryListResponse {
  success: boolean;
  data: {
    inventories: Inventory[];
    pagination: PaginationInfo;
  };
  message?: string;
}

export interface InventoryDetailResponse {
  success: boolean;
  data: Inventory;
  message?: string;
}

export interface InboundRecordListResponse {
  success: boolean;
  data: {
    records: InboundRecord[];
    pagination: PaginationInfo;
  };
  message?: string;
}

export interface OutboundRecordListResponse {
  success: boolean;
  data: {
    records: OutboundRecord[];
    pagination: PaginationInfo;
  };
  message?: string;
}

// 库存统计类型
export interface InventoryStats {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryStats: {
    category: string;
    quantity: number;
    value: number;
  }[];
}

// 库存预警类型 - 统一使用dashboard类型定义
export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  batchNumber?: string;
  colorCode?: string;
  currentStock: number;
  safetyStock: number;
  alertLevel: 'warning' | 'danger' | 'critical';
  alertType: 'low_stock' | 'out_of_stock' | 'overstock' | 'expired';
  lastUpdated: string;
  daysUntilStockout?: number;
  suggestedAction: string;
  createdAt?: string; // 向后兼容

  // 扩展字段用于组件显示
  inventory?: {
    id: string;
    productId: string;
    quantity: number;
    reservedQuantity: number;
    product?: {
      id: string;
      name: string;
      code: string;
      unit?: string;
      safetyStock?: number;
    };
  };
}

// 排序选项
export const INVENTORY_SORT_OPTIONS = [
  { value: 'updatedAt', label: '更新时间' },
  { value: 'quantity', label: '库存数量' },
  { value: 'reservedQuantity', label: '预留数量' },
] as const;

// 库存字段标签映射
export const INVENTORY_FIELD_LABELS = {
  product: '产品',
  batchNumber: '批次号',
  quantity: '库存数量',
  reservedQuantity: '预留数量',
  availableQuantity: '可用数量',
  unitCost: '单位成本',
  totalCost: '总成本',
  supplier: '供应商',
  customer: '客户',
  recordNumber: '单据号',
  type: '操作类型',
  remarks: '备注',
  createdAt: '操作时间',
  updatedAt: '更新时间',
} as const;

// 默认分页配置
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

// 库存预警阈值 - 使用统一的阈值配置
import { INVENTORY_THRESHOLDS } from './inventory-status';
export { INVENTORY_THRESHOLDS };
export const DEFAULT_MIN_QUANTITY = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY;
export const CRITICAL_MIN_QUANTITY = INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY;

// 库存警报类型标签
export const INVENTORY_ALERT_TYPE_LABELS: Record<string, string> = {
  low_stock: '库存不足',
  out_of_stock: '缺货',
  overstock: '库存过多',
  expired: '过期商品',
  damaged: '损坏商品',
} as const;

// 库存警报类型变体
export const INVENTORY_ALERT_TYPE_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  low_stock: 'outline',
  out_of_stock: 'destructive',
  overstock: 'secondary',
  expired: 'destructive',
  damaged: 'destructive',
} as const;
