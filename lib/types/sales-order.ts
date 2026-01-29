// 销售订单管理相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Customer } from './customer';
import type { Product } from './product';
import type { SalesOrderFeeItem } from './sales-order-fee';
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

// 调货履约模式
export type TransferFulfillmentMode = 'SUPPLIER_ONLY' | 'MIXED';

// 销售订单明细类型
export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  productCode?: string;
  batchNumber?: string;
  colorCode?: string;
  productionDate?: string; // 生产日期，瓷砖行业特有
  quantity: number;
  unitPrice: number;
  subtotal: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）
  costSubtotal?: number; // 成本小计（调货销售时使用）
  profitAmount?: number; // 毛利金额（调货销售时使用）
  localQuantity?: number; // 本地仓发货数量
  transferQuantity?: number; // 调货发货数量

  // 手动输入产品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的产品
  manualProductName?: string; // 手动输入的产品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位

  // 显示字段（用于界面展示和计算）
  displayUnit?: string; // 显示单位（片/件）
  displayQuantity?: number; // 显示数量
  piecesPerUnit?: number; // 每件片数
  specification?: string; // 规格
  remarks?: string; // 备注

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
  transferMode: TransferFulfillmentMode;
  supplierId?: string;
  costAmount?: number;
  expenseAmount?: number;
  profitAmount?: number;
  itemsAmount?: number; // 产品总额
  additionalFees?: number; // 额外费用总额
  roundingAdjustment?: number; // 抹零金额
  totalAmount: number; // 总金额 = itemsAmount + additionalFees
  hasReturnOrder?: boolean;

  // 预收款字段
  usePrepayment?: boolean; // 是否使用预收款冲抵
  prepaymentAmount?: number; // 预收款冲抵金额

  remarks?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;

  // 收款相关字段（列表查询时返回）
  paidAmount?: number;
  remainingAmount?: number;

  // 关联数据（可选，根据查询需要包含）
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'address'>;
  user?: Pick<User, 'id' | 'name'>;
  supplier?: {
    id: string;
    name: string;
    phone?: string;
  };
  items?: SalesOrderItem[];
  feeItems?: SalesOrderFeeItem[]; // 费用项列表
  returnOrders?: Array<{
    id: string;
    returnNumber: string;
    status: string;
    createdAt: string;
  }>;
}

// API 查询参数类型
export interface SalesOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?:
    | 'orderNumber'
    | 'createdAt'
    | 'updatedAt'
    | 'totalAmount'
    | 'status'
    | 'shippedAt';
  sortOrder?: 'asc' | 'desc';
  status?: SalesOrderStatus;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  orderType?: SalesOrderType;
  hasReturns?: boolean;
  includeTest?: boolean;
  includeVoided?: boolean;
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
  status?: SalesOrderStatus;
  orderType?: SalesOrderType;
  transferMode?: TransferFulfillmentMode;
  supplierId?: string;
  costAmount?: number;
  roundingAdjustment?: number;
  usePrepayment?: boolean; // 是否使用预收款冲抵
  prepaymentAmount?: number; // 预收款冲抵金额
  remarks?: string;
  items: SalesOrderItemCreateInput[];
  feeItems?: SalesOrderFeeItem[];
}

// 销售订单更新输入类型
export interface SalesOrderUpdateInput {
  id: string;
  customerId?: string;
  status?: SalesOrderStatus;
  orderType?: SalesOrderType;
  transferMode?: TransferFulfillmentMode;
  supplierId?: string;
  costAmount?: number;
  roundingAdjustment?: number;
  usePrepayment?: boolean; // 是否使用预收款冲抵
  prepaymentAmount?: number; // 预收款冲抵金额
  remarks?: string;
  items?: SalesOrderItemUpdateInput[];
  feeItems?: SalesOrderFeeItem[];
}

// 销售订单明细创建输入类型
export interface SalesOrderItemCreateInput {
  productId?: string; // 可选：手动输入产品时不需要 productId
  variantId?: string; // 产品变体ID
  productCode?: string;
  batchNumber?: string;
  colorCode?: string;
  productionDate?: string;
  quantity?: number;
  unitPrice?: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）
  costSubtotal?: number; // 成本小计（调货销售时使用）
  profitAmount?: number; // 毛利金额（调货销售时使用）
  localQuantity?: number; // 本地仓发货数量（调货混合模式使用）
  transferQuantity?: number; // 调货发货数量

  // 手动输入产品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的产品
  manualProductName?: string; // 手动输入的产品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位

  // 显示字段（用于界面展示和计算）
  displayUnit?: string; // 显示单位（片/件）
  displayQuantity?: number; // 显示数量
  piecesPerUnit?: number; // 每件片数
  specification?: string; // 规格
  remarks?: string; // 备注
  subtotal?: number; // 小计金额（quantity * unitPrice）
}

// 销售订单明细更新输入类型
export interface SalesOrderItemUpdateInput {
  id?: string; // 新增明细时为空
  productId?: string; // 可选：手动输入产品时不需要 productId
  productCode?: string;
  batchNumber?: string;
  colorCode?: string;
  productionDate?: string;
  quantity: number;
  unitPrice: number;

  // 调货销售相关字段
  unitCost?: number; // 单位成本价（调货销售时使用）
  localQuantity?: number; // 本地仓发货数量（调货混合模式使用）
  transferQuantity?: number; // 调货发货数量

  // 手动输入产品信息（调货销售时使用）
  isManualProduct?: boolean; // 是否为手动输入的产品
  manualProductName?: string; // 手动输入的产品名称
  manualSpecification?: string; // 手动输入的规格
  manualWeight?: number; // 手动输入的重量
  manualUnit?: string; // 手动输入的单位

  // 显示字段（用于界面展示和计算）
  displayUnit?: string; // 显示单位（片/件）
  displayQuantity?: number; // 显示数量
  piecesPerUnit?: number; // 每件片数
  specification?: string; // 规格
  remarks?: string; // 备注

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
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
> = {
  draft: 'outline',
  confirmed: 'default',
  shipped: 'info',
  completed: 'success',
  cancelled: 'destructive',
};

// 状态流转规则
export const SALES_ORDER_STATUS_TRANSITIONS: Record<
  SalesOrderStatus,
  SalesOrderStatus[]
> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'completed', 'cancelled'],
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
  transferMode: '调货履约模式',
  roundingAdjustment: '抹零金额',
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

export const TRANSFER_MODE_LABELS: Record<TransferFulfillmentMode, string> = {
  SUPPLIER_ONLY: '全部外部调货',
  MIXED: '本地 + 调货混合',
};

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
    draft: 'text-[hsl(var(--color-text-secondary))]',
    confirmed: 'text-[hsl(var(--color-primary))]',
    shipped: 'text-[hsl(var(--color-info))]',
    completed: 'text-[hsl(var(--color-success))]',
    cancelled: 'text-[hsl(var(--color-error))]',
  };
  return colors[status];
};

// 订单状态背景色映射
export const getStatusBgColor = (status: SalesOrderStatus): string => {
  const colors: Record<SalesOrderStatus, string> = {
    draft: 'bg-[hsl(var(--color-bg-tertiary))]',
    confirmed: 'bg-[hsl(var(--color-primary-light))]',
    shipped: 'bg-[hsl(var(--color-info-light))]',
    completed: 'bg-[hsl(var(--color-success-light))]',
    cancelled: 'bg-[hsl(var(--color-error-light))]',
  };
  return colors[status];
};

// 生产日期格式化函数
export const formatProductionDate = (dateString?: string): string => {
  if (!dateString) {
    return '';
  }

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
