// 销售订单管理相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Customer } from './customer';
import type { Product } from './product';
import type { User } from './user';

// 销售订单状态枚举
export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'shipped'
  | 'completed'
  | 'cancelled';

// 销售订单类型枚举
export type SalesOrderType = 'NORMAL' | 'TRANSFER';

// 销售订单明细类型
export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  colorCode?: string;
  productionDate?: string; // 生产日期，瓷砖行业特有
  quantity: number;
  unitPrice: number;
  subtotal: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）
  costSubtotal?: number; // 成本小计（调货销售时使用）
  profitAmount?: number; // 毛利金额（调货销售时使用）

  // 手动输入商品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的商品
  manualProductName?: string; // 手动输入的商品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位

  // 关联数据（可选，根据查询需要包含）
  product?: Product;
}

// 基础销售订单类型（对应数据库模型）
export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  status: SalesOrderStatus;
  orderType: SalesOrderType;
  supplierId?: string;
  costAmount?: number;
  profitAmount?: number;
  totalAmount: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  customer?: Customer;
  user?: User;
  supplier?: {
    id: string;
    name: string;
    phone?: string;
  };
  items?: SalesOrderItem[];
}

// API 查询参数类型
export interface SalesOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'orderNumber' | 'createdAt' | 'updatedAt' | 'totalAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
  status?: SalesOrderStatus;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// API 响应类型
export interface SalesOrderListResponse {
  success: boolean;
  data: {
    salesOrders: SalesOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface SalesOrderDetailResponse {
  success: boolean;
  data: SalesOrder;
  message?: string;
}

// 销售订单创建输入类型
export interface SalesOrderCreateInput {
  customerId: string;
  orderType?: SalesOrderType;
  supplierId?: string;
  costAmount?: number;
  remarks?: string;
  items: SalesOrderItemCreateInput[];
}

// 销售订单更新输入类型
export interface SalesOrderUpdateInput {
  id: string;
  customerId?: string;
  status?: SalesOrderStatus;
  orderType?: SalesOrderType;
  supplierId?: string;
  costAmount?: number;
  remarks?: string;
  items?: SalesOrderItemUpdateInput[];
}

// 销售订单明细创建输入类型
export interface SalesOrderItemCreateInput {
  productId: string;
  colorCode?: string;
  productionDate?: string;
  quantity: number;
  unitPrice: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）

  // 手动输入商品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的商品
  manualProductName?: string; // 手动输入的商品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位
}

// 销售订单明细更新输入类型
export interface SalesOrderItemUpdateInput {
  id?: string; // 新增明细时为空
  productId: string;
  colorCode?: string;
  productionDate?: string;
  quantity: number;
  unitPrice: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）

  // 手动输入商品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的商品
  manualProductName?: string; // 手动输入的商品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位

  _action?: 'create' | 'update' | 'delete'; // 操作类型
}

// 销售订单统计类型
export interface SalesOrderStats {
  totalOrders: number;
  totalAmount: number;
  statusCounts: Record<SalesOrderStatus, number>;
  monthlyStats: {
    month: string;
    orderCount: number;
    totalAmount: number;
  }[];
}

// 显示标签映射
export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

export const SALES_ORDER_STATUS_VARIANTS: Record<
  SalesOrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  confirmed: 'default',
  shipped: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

// 状态流转规则
export const SALES_ORDER_STATUS_TRANSITIONS: Record<
  SalesOrderStatus,
  SalesOrderStatus[]
> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['completed', 'cancelled'],
  completed: [], // 已完成不能转换到其他状态
  cancelled: [], // 已取消不能转换到其他状态
};

// 排序选项
export const SALES_ORDER_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'orderNumber', label: '订单号' },
  { value: 'totalAmount', label: '订单金额' },
  { value: 'status', label: '订单状态' },
] as const;

// 销售订单字段标签映射
export const SALES_ORDER_FIELD_LABELS = {
  orderNumber: '订单号',
  customer: '客户',
  user: '销售员',
  status: '订单状态',
  totalAmount: '订单金额',
  remarks: '备注信息',
  items: '订单明细',
  quantity: '数量',
  unitPrice: '单价',
  subtotal: '小计',
  colorCode: '色号',
  productionDate: '生产日期',
  createdAt: '创建时间',
  updatedAt: '更新时间',
} as const;

// 瓷砖行业特有的色号选项（示例）
export const COMMON_COLOR_CODES = [
  { value: 'W001', label: 'W001 - 纯白' },
  { value: 'G001', label: 'G001 - 浅灰' },
  { value: 'G002', label: 'G002 - 深灰' },
  { value: 'B001', label: 'B001 - 米白' },
  { value: 'B002', label: 'B002 - 象牙白' },
  { value: 'Y001', label: 'Y001 - 淡黄' },
  { value: 'R001', label: 'R001 - 砖红' },
  { value: 'BR001', label: 'BR001 - 棕色' },
  { value: 'BL001', label: 'BL001 - 黑色' },
  { value: 'MIX001', label: 'MIX001 - 混色' },
] as const;

// 订单明细计算辅助函数
export const calculateOrderItemSubtotal = (
  quantity: number,
  unitPrice: number
): number => Math.round(quantity * unitPrice * 100) / 100; // 保留两位小数

export const calculateOrderTotal = (items: SalesOrderItem[]): number =>
  Math.round(items.reduce((total, item) => total + item.subtotal, 0) * 100) /
  100;

// 订单状态检查函数
export const canTransitionToStatus = (
  currentStatus: SalesOrderStatus,
  targetStatus: SalesOrderStatus
): boolean =>
  SALES_ORDER_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);

// 订单状态颜色映射
export const getStatusColor = (status: SalesOrderStatus): string => {
  const colors: Record<SalesOrderStatus, string> = {
    draft: 'text-gray-600',
    confirmed: 'text-blue-600',
    shipped: 'text-orange-600',
    completed: 'text-green-600',
    cancelled: 'text-red-600',
  };
  return colors[status];
};

// 订单状态背景色映射
export const getStatusBgColor = (status: SalesOrderStatus): string => {
  const colors: Record<SalesOrderStatus, string> = {
    draft: 'bg-gray-100',
    confirmed: 'bg-blue-100',
    shipped: 'bg-orange-100',
    completed: 'bg-green-100',
    cancelled: 'bg-red-100',
  };
  return colors[status];
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

// 订单号生成规则说明 - 已迁移到环境配置
// 请使用 salesOrderConfig.orderPrefix 和 salesOrderConfig.numberLength
// export const ORDER_NUMBER_FORMAT = 'SO + YYYYMMDD + 6位时间戳'; // 已废弃

// 注意：分页配置已迁移到环境配置 (lib/env.ts)
// 请使用 paginationConfig.defaultPageSize 和 paginationConfig.maxPageSize
// 分页选项可以根据 paginationConfig.maxPageSize 动态生成
