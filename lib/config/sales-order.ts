/**
 * 销售订单模块统一配置
 * 遵循唯一真理源原则，所有枚举值和常量在此统一定义
 */

// 销售订单状态枚举
export const SALES_ORDER_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type SalesOrderStatus =
  (typeof SALES_ORDER_STATUSES)[keyof typeof SALES_ORDER_STATUSES];

// 销售订单状态中文标签映射
export const SALES_ORDER_STATUS_LABELS = {
  [SALES_ORDER_STATUSES.DRAFT]: '草稿',
  [SALES_ORDER_STATUSES.CONFIRMED]: '已确认',
  [SALES_ORDER_STATUSES.PROCESSING]: '处理中',
  [SALES_ORDER_STATUSES.SHIPPED]: '已发货',
  [SALES_ORDER_STATUSES.DELIVERED]: '已送达',
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
