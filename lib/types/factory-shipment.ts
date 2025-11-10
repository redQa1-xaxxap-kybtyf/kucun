// 厂家发货相关类型定义
// 遵循 TypeScript 严格模式，禁用 any 类型

// 厂家发货订单状态枚举
// 状态流程: 草稿 → 已确认 → 待发货 → 已发货 → 运输中 → 到港 → 已取消
export const FACTORY_SHIPMENT_STATUS = {
  DRAFT: 'draft', // 草稿 - 订单创建但未提交
  CONFIRMED: 'confirmed', // 已确认 - 订单已确认，准备发货
  PENDING_SHIPMENT: 'pending_shipment', // 待发货 - 等待发货
  SHIPPED: 'shipped', // 已发货 - 已从工厂发货
  IN_TRANSIT: 'in_transit', // 运输中 - 货物在运输途中
  ARRIVED: 'arrived', // 到港 - 货物已到达港口
  CANCELLED: 'cancelled', // 已取消 - 订单已取消
} as const;

export type FactoryShipmentStatus =
  (typeof FACTORY_SHIPMENT_STATUS)[keyof typeof FACTORY_SHIPMENT_STATUS];

// 发货明细归属：客户货 or 自有货（随柜补货）
export const FACTORY_SHIPMENT_ITEM_OWNERSHIP = {
  CUSTOMER: 'customer',
  SELF: 'self',
} as const;

export type FactoryShipmentItemOwnership =
  (typeof FACTORY_SHIPMENT_ITEM_OWNERSHIP)[keyof typeof FACTORY_SHIPMENT_ITEM_OWNERSHIP];

// 客户货交付状态
export type FactoryShipmentItemDeliveryStatus = 'pending' | 'delivered';

// 自有货入库状态
export type FactoryShipmentItemInboundStatus = 'pending' | 'received';

// 厂家发货订单状态标签
export const FACTORY_SHIPMENT_STATUS_LABELS: Record<
  FactoryShipmentStatus,
  string
> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: '草稿',
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: '已确认',
  [FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT]: '待发货',
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: '已发货',
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: '运输中',
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: '到港',
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: '已取消',
};

// 厂家发货订单状态变体映射（用于Badge组件）
export const FACTORY_SHIPMENT_STATUS_VARIANTS: Record<
  FactoryShipmentStatus,
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: 'outline', // 草稿 - 灰色边框
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: 'success', // 已确认 - 绿色
  [FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT]: 'secondary', // 待发货 - 灰色
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: 'info', // 已发货 - 蓝色
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: 'info', // 运输中 - 蓝色
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: 'success', // 到港 - 绿色
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: 'destructive', // 已取消 - 红色
};

// 厂家发货订单明细项
export interface FactoryShipmentOrderItem {
  id: string;
  factoryShipmentOrderId: string;
  productId?: string | null;
  supplierId: string;
  productCode: string; // 产品编码（必填）
  batchNumber?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;

  // 归属信息
  ownership: FactoryShipmentItemOwnership;
  customerDeliveryStatus?: FactoryShipmentItemDeliveryStatus;
  selfInboundStatus?: FactoryShipmentItemInboundStatus;
  ownershipRemarks?: string | null;
  deliveryConfirmedAt?: Date | string | null;
  inboundReceivedAt?: Date | string | null;

  // 手动输入产品信息（临时产品）
  isManualProduct?: boolean | null;
  manualProductName?: string | null;
  manualSpecification?: string | null;
  manualWeight?: number | null;
  manualUnit?: string | null;

  // 通用显示字段
  displayName: string; // 产品名称（必填）
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number | null;
  weight?: number | null;

  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // 成本和利润字段
  unitCost?: number | null; // 单位成本（采购价+分摊费用/数量）
  allocatedExpense?: number | null; // 分摊费用
  profitAmount?: number | null; // 利润金额（客户货）
  profitMargin?: number | null; // 利润率（%）

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

// 厂家发货订单
export interface FactoryShipmentOrder {
  id: string;
  orderNumber: string;
  containerNumber: string;
  customerId: string;
  userId: string;
  status: FactoryShipmentStatus;
  fulfillmentSummary?: {
    customerOwnedAmount: number;
    selfOwnedAmount: number;
  };
  totalAmount: number;
  receivableAmount: number;
  depositAmount: number;
  paidAmount: number;
  remarks?: string;
  shippingCompany?: string;
  lastShippingQueryAt?: Date | string | null;
  shippingQueryStatus?: string | null;
  shippingQueryError?: string | null;
  latestShippingStatus?: string | null; // 最新的实际运输状态（从 ShippingQuery 表获取）
  shipmentDate?: Date;
  estimatedArrival?: Date;
  arrivalDate?: Date;
  deliveryDate?: Date;
  completionDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  // 成本和利润字段
  costAmount?: number; // 总成本（采购价总和）
  expenseAmount?: number; // 总费用（运费、仓储费等）
  profitAmount?: number; // 总利润（客户货利润）
  customerProfit?: number; // 客户货利润
  selfCostAmount?: number; // 自有货成本

  // 关联数据
  customer: {
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
  items: FactoryShipmentOrderItem[];
}

// 创建厂家发货订单的输入数据
export interface CreateFactoryShipmentOrderData {
  containerNumber: string;
  customerId: string;
  status?: FactoryShipmentStatus;
  totalAmount?: number;
  receivableAmount?: number;
  depositAmount?: number;
  remarks?: string;
  items: CreateFactoryShipmentOrderItemData[];
}

// 创建厂家发货订单明细的输入数据
export interface CreateFactoryShipmentOrderItemData {
  productId?: string;
  supplierId: string;
  productCode: string; // 产品编码（必填）
  batchNumber?: string | null;
  quantity: number;
  unitPrice: number;
  unitCost?: number; // 进货价（可选）
  ownership: FactoryShipmentItemOwnership;
  customerDeliveryStatus?: FactoryShipmentItemDeliveryStatus;
  selfInboundStatus?: FactoryShipmentItemInboundStatus;
  ownershipRemarks?: string;

  // 手动输入产品信息（临时产品）
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;

  // 通用显示字段
  displayName: string; // 产品名称（必填）
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number;
  weight?: number | null;

  remarks?: string;
}

// 更新厂家发货订单的输入数据
export interface UpdateFactoryShipmentOrderData {
  containerNumber?: string;
  customerId?: string;
  status?: FactoryShipmentStatus;
  totalAmount?: number;
  receivableAmount?: number;
  depositAmount?: number;
  paidAmount?: number;
  remarks?: string;
  shipmentDate?: Date;
  arrivalDate?: Date;
  deliveryDate?: Date;
  completionDate?: Date;
  items?: CreateFactoryShipmentOrderItemData[];
}

// 厂家发货订单列表查询参数
export interface FactoryShipmentOrderListParams {
  page?: number;
  limit?: number;
  pageSize?: number;
  status?: FactoryShipmentStatus;
  customerId?: string;
  containerNumber?: string;
  orderNumber?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: Date | string;
  endDate?: Date | string;
}

// 厂家发货订单查询参数（用于前端）
export interface FactoryShipmentQueryParams {
  page?: number;
  limit?: number;
  containerNumber?: string;
  status?: FactoryShipmentStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

// 厂家发货订单统计数据
export interface FactoryShipmentOrderStats {
  totalOrders: number;
  totalAmount: number;
  totalReceivable: number;
  totalPaid: number;
  statusCounts: Record<FactoryShipmentStatus, number>;
}

// ==================== 费用分摊相关类型 ====================

/**
 * 费用分摊方式
 */
export type ExpenseAllocationMethod =
  | 'by_value' // 按货值比例分摊
  | 'by_weight' // 按重量比例分摊
  | 'by_quantity' // 按数量比例分摊
  | 'by_ownership'; // 按归属分摊（客户货 vs 自有货）

/**
 * 费用分摊结果（单个明细）
 */
export interface ExpenseAllocationResult {
  itemId: string; // 明细ID
  allocatedAmount: number; // 分摊金额
  allocationRatio: number; // 分摊比例（%）
}

/**
 * 费用分摊选项
 */
export interface ExpenseAllocationOptions {
  method: ExpenseAllocationMethod; // 分摊方式
  totalExpenses: number; // 费用总额
  items: FactoryShipmentOrderItem[]; // 订单明细列表
}

/**
 * 费用分摊汇总结果
 */
export interface ExpenseAllocationSummary {
  method: ExpenseAllocationMethod; // 使用的分摊方式
  totalExpenses: number; // 费用总额
  allocatedTotal: number; // 实际分摊总额
  difference: number; // 差额（应为0或接近0）
  results: ExpenseAllocationResult[]; // 各明细的分摊结果
}

// ==================== 利润计算相关类型 ====================

/**
 * 利润计算结果（单个明细）
 */
export interface ItemProfitResult {
  itemId: string; // 明细ID
  profitAmount: number; // 利润金额
  profitMargin: number; // 利润率（%）
  unitCost: number; // 单位成本（采购价 + 分摊费用/数量）
  revenue: number; // 收入（应收金额）
  cost: number; // 成本（采购价）
  allocatedExpense: number; // 分摊费用
}

/**
 * 订单利润汇总
 */
export interface OrderProfitSummary {
  customerProfit: number; // 客户货总利润
  selfCostAmount: number; // 自有货总成本
  totalRevenue: number; // 客户货总收入
  totalCost: number; // 客户货总成本（采购价）
  totalExpenses: number; // 总费用
  averageProfitMargin: number; // 平均利润率（%）
  itemResults: ItemProfitResult[]; // 各明细利润
}
