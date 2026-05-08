// 厂家发货相关类型定义
// 遵循 TypeScript 严格模式，禁用 any 类型

import { STATUS_PALETTE } from '@/lib/config/status-palette';

// 厂家发货订单状态枚举
// 状态流程: 草稿 → 已确认 → 待发货 → 已发货 → 运输中 → 已到港 → 已取消
export const FACTORY_SHIPMENT_STATUS = {
  DRAFT: 'draft', // 草稿 - 订单创建但未提交
  CONFIRMED: 'confirmed', // 已确认 - 订单已确认，准备发货
  PENDING_SHIPMENT: 'pending_shipment', // 待发货 - 等待发货
  SHIPPED: 'shipped', // 已发货 - 已从工厂发货
  IN_TRANSIT: 'in_transit', // 运输中 - 货物在运输途中
  ARRIVED: 'arrived', // 已到港 - 货物已到达港口
  CANCELLED: 'cancelled', // 已取消 - 订单已取消
} as const;

export type FactoryShipmentStatus =
  (typeof FACTORY_SHIPMENT_STATUS)[keyof typeof FACTORY_SHIPMENT_STATUS];

// 发货明细归属（历史字段，仅保留向后兼容）
// 业务上已不再区分“客户货 / 自有货”，统一视为客户货；
// 该枚举和字段仅用于兼容旧数据和避免大规模迁移。
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
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: '已到港',
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
  [FACTORY_SHIPMENT_STATUS.DRAFT]: STATUS_PALETTE.draft,
  // 已确认：刚确认进入主流程，未发货——active(蓝)，不应是 success(绿)
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: STATUS_PALETTE.active,
  [FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT]: STATUS_PALETTE.pending,
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: STATUS_PALETTE.inTransit,
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: STATUS_PALETTE.inTransit,
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: STATUS_PALETTE.done,
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: STATUS_PALETTE.failed,
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

  // 归属信息（仅保留字段，当前业务统一视为客户货）
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
  feeItems?: FactoryShipmentOrderFeeItem[]; // 费用项
}

// 厂家发货订单费用项
export interface FactoryShipmentOrderFeeItem {
  id: string;
  factoryShipmentOrderId: string;
  feeType: FactoryShipmentFeeType;
  feeName: string;
  feeAmount: number;
  paidBy: 'customer' | 'company';
  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 费用类型
export type FactoryShipmentFeeType =
  | 'freight'
  | 'processing'
  | 'packaging'
  | 'loading_unloading'
  | 'storage'
  | 'customs'
  | 'other';

// 费用类型标签
export const FACTORY_SHIPMENT_FEE_TYPE_LABELS: Record<
  FactoryShipmentFeeType,
  string
> = {
  freight: '运费',
  processing: '加工费',
  packaging: '包装费',
  loading_unloading: '装卸费',
  storage: '仓储费',
  customs: '报关费',
  other: '其他费用',
};

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
  search?: string; // 通用搜索字段，同时匹配 containerNumber 和 orderNumber
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
  search?: string; // 通用搜索字段，同时匹配 containerNumber 和 orderNumber
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
  customerProfit: number; // 总利润（所有明细统一视为客户货）
  selfCostAmount: number; // 已废弃：保留字段用于兼容，固定为0
  totalRevenue: number; // 总收入
  totalCost: number; // 总成本（采购价）
  totalExpenses: number; // 总费用
  averageProfitMargin: number; // 平均利润率（%）
  itemResults: ItemProfitResult[]; // 各明细利润
}
