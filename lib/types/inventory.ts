// 库存管理相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

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

// 基础库存类型（对应数据库模型）
export interface Inventory {
  id: string;
  productId: string;
  colorCode?: string;
  productionDate?: string; // ISO日期字符串
  quantity: number;
  reservedQuantity: number; // 预留数量
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  product?: Product;
}

// 入库记录类型
export interface InboundRecord {
  id: string;
  recordNumber: string;
  type: InboundType;
  productId: string;
  colorCode?: string;
  productionDate?: string;
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
  productionDate?: string;
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

// API 查询参数类型
export interface InventoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'productName' | 'quantity' | 'reservedQuantity' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  productId?: string;
  colorCode?: string;
  lowStock?: boolean;
  hasStock?: boolean;
  productionDateStart?: string;
  productionDateEnd?: string;
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

// API 响应类型
export interface InventoryListResponse {
  success: boolean;
  data: {
    inventories: Inventory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface OutboundRecordListResponse {
  success: boolean;
  data: {
    records: OutboundRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

// 库存操作输入类型
export interface InboundCreateInput {
  type: InboundType;
  productId: string;
  colorCode?: string;
  productionDate?: string;
  quantity: number;
  unitCost?: number;
  supplierId?: string;
  remarks?: string;
}

export interface OutboundCreateInput {
  type: OutboundType;
  productId: string;
  colorCode?: string;
  productionDate?: string;
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
  productionDate?: string;
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
  productionDate?: string;
  actualQuantity: number;
  systemQuantity: number;
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

// 库存预警类型
export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  colorCode?: string;
  currentQuantity: number;
  minQuantity: number;
  alertType: 'low_stock' | 'out_of_stock';
  createdAt: string;

  product?: Product;
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
export const INVENTORY_SORT_OPTIONS = [
  { value: 'updatedAt', label: '更新时间' },
  { value: 'productName', label: '产品名称' },
  { value: 'quantity', label: '库存数量' },
  { value: 'reservedQuantity', label: '预留数量' },
] as const;

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

// 库存字段标签映射
export const INVENTORY_FIELD_LABELS = {
  product: '产品',
  colorCode: '色号',
  productionDate: '生产日期',
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

// 库存状态检查函数
export const getInventoryStatus = (
  inventory: Inventory,
  minQuantity: number = 10
): {
  status: 'normal' | 'low_stock' | 'out_of_stock';
  label: string;
  color: string;
} => {
  const availableQuantity = inventory.quantity - inventory.reservedQuantity;

  if (availableQuantity <= 0) {
    return {
      status: 'out_of_stock',
      label: '缺货',
      color: 'text-red-600',
    };
  } else if (availableQuantity <= minQuantity) {
    return {
      status: 'low_stock',
      label: '库存不足',
      color: 'text-orange-600',
    };
  } else {
    return {
      status: 'normal',
      label: '库存正常',
      color: 'text-green-600',
    };
  }
};

// 计算可用库存
export const calculateAvailableQuantity = (inventory: Inventory): number => Math.max(0, inventory.quantity - inventory.reservedQuantity);

// 格式化库存数量显示
export const formatInventoryQuantity = (
  inventory: Inventory,
  unit?: string
): string => {
  const available = calculateAvailableQuantity(inventory);
  const unitStr = unit || '件';

  if (inventory.reservedQuantity > 0) {
    return `${available}${unitStr} (总${inventory.quantity}${unitStr}, 预留${inventory.reservedQuantity}${unitStr})`;
  } else {
    return `${available}${unitStr}`;
  }
};

// 生产日期格式化函数
export const formatProductionDate = (dateString?: string): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
};

// 库存记录号生成规则说明
export const INBOUND_NUMBER_FORMAT = 'IN + YYYYMMDD + 6位时间戳';
export const OUTBOUND_NUMBER_FORMAT = 'OUT + YYYYMMDD + 6位时间戳';

// 默认分页配置
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

// 库存预警阈值
export const DEFAULT_MIN_QUANTITY = 10;
export const CRITICAL_MIN_QUANTITY = 5;
