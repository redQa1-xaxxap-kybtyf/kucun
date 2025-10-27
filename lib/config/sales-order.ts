/**
 * 销售订单模块统一配置
 * 遵循唯一真理源原则，所有枚举值和常量在此统一定义
 */

// 销售订单状态枚举
// 严格遵循实际业务流程：草稿 → 已确认 → 已发货 → 已完成（可随时取消）
export const SALES_ORDER_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type SalesOrderStatus =
  (typeof SALES_ORDER_STATUSES)[keyof typeof SALES_ORDER_STATUSES];

// 销售订单状态中文标签映射
export const SALES_ORDER_STATUS_LABELS = {
  [SALES_ORDER_STATUSES.DRAFT]: '草稿',
  [SALES_ORDER_STATUSES.CONFIRMED]: '已确认',
  [SALES_ORDER_STATUSES.SHIPPED]: '已发货',
  [SALES_ORDER_STATUSES.COMPLETED]: '已完成',
  [SALES_ORDER_STATUSES.CANCELLED]: '已取消',
} as const;

// 销售订单优先级枚举
export const SALES_ORDER_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type SalesOrderPriority =
  (typeof SALES_ORDER_PRIORITIES)[keyof typeof SALES_ORDER_PRIORITIES];

// 销售订单优先级中文标签映射
export const SALES_ORDER_PRIORITY_LABELS = {
  [SALES_ORDER_PRIORITIES.LOW]: '低',
  [SALES_ORDER_PRIORITIES.NORMAL]: '普通',
  [SALES_ORDER_PRIORITIES.HIGH]: '高',
  [SALES_ORDER_PRIORITIES.URGENT]: '紧急',
} as const;

// 销售订单排序字段枚举
export const SALES_ORDER_SORT_FIELDS = {
  ORDER_NUMBER: 'orderNumber',
  CUSTOMER_NAME: 'customerName',
  TOTAL_AMOUNT: 'totalAmount',
  STATUS: 'status',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

export type SalesOrderSortField =
  (typeof SALES_ORDER_SORT_FIELDS)[keyof typeof SALES_ORDER_SORT_FIELDS];

// 销售订单排序字段中文标签映射
export const SALES_ORDER_SORT_FIELD_LABELS = {
  [SALES_ORDER_SORT_FIELDS.ORDER_NUMBER]: '订单号',
  [SALES_ORDER_SORT_FIELDS.CUSTOMER_NAME]: '客户名称',
  [SALES_ORDER_SORT_FIELDS.TOTAL_AMOUNT]: '订单金额',
  [SALES_ORDER_SORT_FIELDS.STATUS]: '订单状态',
  [SALES_ORDER_SORT_FIELDS.CREATED_AT]: '创建时间',
  [SALES_ORDER_SORT_FIELDS.UPDATED_AT]: '更新时间',
} as const;

/**
 * 销售订单类型枚举
 */
export const SALES_ORDER_TYPES = {
  NORMAL: 'NORMAL',
  TRANSFER: 'TRANSFER',
} as const;

export type SalesOrderType =
  (typeof SALES_ORDER_TYPES)[keyof typeof SALES_ORDER_TYPES];

/**
 * 销售订单类型中文标签映射
 */
export const SALES_ORDER_TYPE_LABELS: Record<SalesOrderType, string> = {
  [SALES_ORDER_TYPES.NORMAL]: '普通销售',
  [SALES_ORDER_TYPES.TRANSFER]: '调货销售',
} as const;

/**
 * 调货履约模式枚举
 */
export const TRANSFER_MODES = {
  SUPPLIER_ONLY: 'SUPPLIER_ONLY',
  MIXED: 'MIXED',
} as const;

export type TransferFulfillmentMode =
  (typeof TRANSFER_MODES)[keyof typeof TRANSFER_MODES];

/**
 * 调货履约模式中文标签映射
 */
export const TRANSFER_MODE_LABELS: Record<TransferFulfillmentMode, string> = {
  [TRANSFER_MODES.SUPPLIER_ONLY]: '全部外部调货',
  [TRANSFER_MODES.MIXED]: '本地 + 调货混合',
} as const;

/**
 * 允许退货的销售订单状态列表
 * 业务规则：只有已发货和已完成的订单才能退货
 */
export const RETURN_ALLOWED_SALES_ORDER_STATUSES: ReadonlyArray<SalesOrderStatus> =
  [SALES_ORDER_STATUSES.SHIPPED, SALES_ORDER_STATUSES.COMPLETED] as const;

/**
 * 销售订单状态流转规则（状态机配置）
 * 定义每个状态可以流转到哪些状态
 */
export const SALES_ORDER_STATUS_TRANSITIONS: Record<
  SalesOrderStatus,
  ReadonlyArray<SalesOrderStatus>
> = {
  [SALES_ORDER_STATUSES.DRAFT]: [
    SALES_ORDER_STATUSES.CONFIRMED,
    SALES_ORDER_STATUSES.CANCELLED,
  ],
  [SALES_ORDER_STATUSES.CONFIRMED]: [
    SALES_ORDER_STATUSES.SHIPPED,
    SALES_ORDER_STATUSES.CANCELLED,
  ],
  [SALES_ORDER_STATUSES.SHIPPED]: [SALES_ORDER_STATUSES.COMPLETED],
  [SALES_ORDER_STATUSES.COMPLETED]: [], // 已完成的订单不能再变更状态
  [SALES_ORDER_STATUSES.CANCELLED]: [], // 已取消的订单不能再变更状态
} as const;
