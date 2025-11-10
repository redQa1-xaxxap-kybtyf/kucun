// 采购订单相关类型定义
// 遵循 TypeScript 严格模式，禁用 any 类型

// 采购订单状态枚举
// 状态流程: 草稿 → 已下单 → 已发货 → 运输中 → 已到货 → 已完成 → 已取消
export const PURCHASE_ORDER_STATUS = {
  DRAFT: 'draft', // 草稿 - 订单创建但未提交
  ORDERED: 'ordered', // 已下单 - 订单已确认，等待发货
  SHIPPED: 'shipped', // 已发货 - 已从供应商发货
  IN_TRANSIT: 'in_transit', // 运输中 - 货物在运输途中
  ARRIVED: 'arrived', // 已到货 - 货物已到达
  COMPLETED: 'completed', // 已完成 - 已入库完成
  CANCELLED: 'cancelled', // 已取消 - 订单已取消
} as const;

export type PurchaseOrderStatus =
  (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

// 采购订单明细入库状态
export type PurchaseOrderItemInboundStatus = 'pending' | 'received';

export type PurchaseOrderFulfillmentStatus = 'none' | 'partial' | 'complete';

export interface PurchaseOrderExecutionSummary {
  orderedQuantity: number;
  receivedQuantity: number;
  executionRate: number;
  fulfillmentStatus: PurchaseOrderFulfillmentStatus;
}

// 采购订单状态标签
export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> =
  {
    [PURCHASE_ORDER_STATUS.DRAFT]: '草稿',
    [PURCHASE_ORDER_STATUS.ORDERED]: '已下单',
    [PURCHASE_ORDER_STATUS.SHIPPED]: '已发货',
    [PURCHASE_ORDER_STATUS.IN_TRANSIT]: '运输中',
    [PURCHASE_ORDER_STATUS.ARRIVED]: '已到货',
    [PURCHASE_ORDER_STATUS.COMPLETED]: '已完成',
    [PURCHASE_ORDER_STATUS.CANCELLED]: '已取消',
  };

// 采购订单状态变体映射（用于Badge组件）
export const PURCHASE_ORDER_STATUS_VARIANTS: Record<
  PurchaseOrderStatus,
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: 'outline', // 草稿 - 灰色边框
  [PURCHASE_ORDER_STATUS.ORDERED]: 'secondary', // 已下单 - 灰色
  [PURCHASE_ORDER_STATUS.SHIPPED]: 'info', // 已发货 - 蓝色
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: 'info', // 运输中 - 蓝色
  [PURCHASE_ORDER_STATUS.ARRIVED]: 'warning', // 已到货 - 黄色（待入库）
  [PURCHASE_ORDER_STATUS.COMPLETED]: 'success', // 已完成 - 绿色
  [PURCHASE_ORDER_STATUS.CANCELLED]: 'destructive', // 已取消 - 红色
};

// 采购订单明细项
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId?: string | null;
  supplierId: string;
  productCode: string; // 产品编码（必填）
  quantity: number;
  unitPrice: number;
  totalPrice: number;

  // 入库状态
  inboundStatus?: PurchaseOrderItemInboundStatus;
  inboundReceivedAt?: Date | string | null;

  // 手动输入产品信息（临时产品）
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;
  receivedQuantity?: number;
  executionRate?: number;

  // 通用显示字段
  displayName: string; // 产品名称（必填）
  specification?: string;
  unit: string;
  weight?: number;
  piecesPerUnit?: number | null;

  remarks?: string;
  createdAt: Date;
  updatedAt: Date;

  // 成本字段
  unitCost?: number; // 单位成本（采购价+分摊费用/数量）
  allocatedExpense?: number; // 分摊费用
  unitCostWithExpense?: number | null; // 含运费单位成本

  // 关联数据
  product?: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
    weight?: number;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
}

// 采购订单
export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  containerNumber?: string | null;
  supplierId: string;
  userId: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  expenseAmount?: number;
  costAmount?: number;
  remarks?: string;
  shippingCompany?: string;
  orderDate?: Date;
  shipmentDate?: Date;
  estimatedArrival?: Date;
  arrivalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  executionSummary?: PurchaseOrderExecutionSummary;

  // 关联数据
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  items: PurchaseOrderItem[];
  expenses?: ExpenseRecord[];
  expenses?: ExpenseRecord[];
}

// 费用记录类型（简化版，用于采购订单详情）
export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  expenseType: string;
  expenseName: string;
  expenseAmount: number;
  remarks?: string;
  relatedType: string;
  relatedId: string;
  relatedNumber?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 创建采购订单的输入数据
export interface CreatePurchaseOrderData {
  containerNumber?: string;
  supplierId: string;
  status?: PurchaseOrderStatus;
  totalAmount?: number;
  remarks?: string;
  items: CreatePurchaseOrderItemData[];
}

// 创建采购订单明细的输入数据
export interface CreatePurchaseOrderItemData {
  productId?: string;
  supplierId: string;
  productCode: string; // 产品编码（必填）
  quantity: number;
  unitPrice: number;
  inboundStatus?: PurchaseOrderItemInboundStatus;

  // 手动输入产品信息（临时产品）
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;

  // 通用显示字段
  displayName: string; // 产品名称（必填）
  specification?: string;
  unit: string;
  weight?: number;
  piecesPerUnit?: number;

  remarks?: string;
}

// 更新采购订单的输入数据
export interface UpdatePurchaseOrderData {
  containerNumber?: string;
  supplierId?: string;
  status?: PurchaseOrderStatus;
  totalAmount?: number;
  expenseAmount?: number;
  costAmount?: number;
  remarks?: string;
  shippingCompany?: string;
  orderDate?: Date;
  shipmentDate?: Date;
  estimatedArrival?: Date;
  arrivalDate?: Date;
  items?: CreatePurchaseOrderItemData[];
}

// 采购订单列表查询参数
export interface PurchaseOrderListParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  containerNumber?: string;
  orderNumber?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: Date | string;
  endDate?: Date | string;
  fulfillment?: PurchaseOrderFulfillmentStatus;
}

// 采购订单查询参数（用于前端）
export interface PurchaseOrderQueryParams {
  page?: number;
  limit?: number;
  containerNumber?: string;
  status?: PurchaseOrderStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

// 采购订单统计数据
export interface PurchaseOrderStats {
  totalOrders: number;
  totalAmount: number;
  totalCost: number;
  totalExpenses: number;
  statusCounts: Record<PurchaseOrderStatus, number>;
}

// ==================== 费用分摊相关类型 ====================

/**
 * 费用分摊方式（采购订单只支持按金额和按重量）
 */
export type PurchaseExpenseAllocationMethod =
  | 'by_value' // 按货值比例分摊
  | 'by_weight' // 按重量比例分摊
  | 'by_quantity'; // 按数量比例分摊

/**
 * 费用分摊结果（单个明细）
 */
export interface PurchaseExpenseAllocationResult {
  itemId: string; // 明细ID
  allocatedAmount: number; // 分摊金额
  allocationRatio: number; // 分摊比例（%）
}

/**
 * 费用分摊选项
 */
export interface PurchaseExpenseAllocationOptions {
  method: PurchaseExpenseAllocationMethod; // 分摊方式
  totalExpenses: number; // 费用总额
  items: PurchaseOrderItem[]; // 订单明细列表
}

/**
 * 费用分摊汇总结果
 */
export interface PurchaseExpenseAllocationSummary {
  method: PurchaseExpenseAllocationMethod; // 使用的分摊方式
  totalExpenses: number; // 费用总额
  allocatedTotal: number; // 实际分摊总额
  difference: number; // 差额（应为0或接近0）
  results: PurchaseExpenseAllocationResult[]; // 各明细的分摊结果
}

// ==================== 成本计算相关类型 ====================

/**
 * 成本计算结果（单个明细）
 */
export interface ItemCostResult {
  itemId: string; // 明细ID
  unitCost: number; // 单位成本（采购价 + 分摊费用/数量）
  totalCost: number; // 总成本（单位成本 * 数量）
  purchasePrice: number; // 采购价
  allocatedExpense: number; // 分摊费用
}

/**
 * 订单成本汇总
 */
export interface OrderCostSummary {
  totalPurchaseAmount: number; // 采购总额
  totalExpenses: number; // 总费用
  totalCost: number; // 总成本（采购总额 + 总费用）
  itemResults: ItemCostResult[]; // 各明细成本
}
import type { ExpenseRecord } from './expense';
