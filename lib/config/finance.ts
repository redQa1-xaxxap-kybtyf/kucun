/**
 * 财务管理模块统一配置
 * 遵循唯一真理源原则，所有枚举值和常量在此统一定义
 */

// 支付方式枚举
export const PAYMENT_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  OTHER: 'other',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

// 支付状态枚举
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

// 退款类型枚举
export const REFUND_TYPES = {
  FULL_REFUND: 'full_refund',
  PARTIAL_REFUND: 'partial_refund',
  EXCHANGE_REFUND: 'exchange_refund',
} as const;

export type RefundType = typeof REFUND_TYPES[keyof typeof REFUND_TYPES];

// 退款方式枚举
export const REFUND_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  ORIGINAL_PAYMENT: 'original_payment',
  OTHER: 'other',
} as const;

export type RefundMethod = typeof REFUND_METHODS[keyof typeof REFUND_METHODS];

// 退款状态枚举
export const REFUND_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export type RefundStatus = typeof REFUND_STATUSES[keyof typeof REFUND_STATUSES];

// 账单实体类型枚举
export const ENTITY_TYPES = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// 账单状态枚举
export const STATEMENT_STATUSES = {
  ACTIVE: 'active',
  SETTLED: 'settled',
  OVERDUE: 'overdue',
  SUSPENDED: 'suspended',
} as const;

export type StatementStatus = typeof STATEMENT_STATUSES[keyof typeof STATEMENT_STATUSES];

// 交易类型枚举
export const TRANSACTION_TYPES = {
  SALE: 'sale',
  PAYMENT: 'payment',
  REFUND: 'refund',
  PURCHASE: 'purchase',
  PAYMENT_OUT: 'payment_out',
  ADJUSTMENT: 'adjustment',
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// 交易状态枚举
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUSES[keyof typeof TRANSACTION_STATUSES];

// 应收账款状态枚举
export const RECEIVABLE_STATUSES = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

export type ReceivableStatus = typeof RECEIVABLE_STATUSES[keyof typeof RECEIVABLE_STATUSES];

// 财务配置常量
export const FINANCE_CONFIG = {
  // 默认付款期限（天）
  DEFAULT_PAYMENT_TERMS: 30,
  
  // 逾期天数阈值
  OVERDUE_THRESHOLD_DAYS: 30,
  
  // 默认信用额度
  DEFAULT_CREDIT_LIMIT: 100000,
  
  // 分页默认设置
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // 金额格式化精度
  AMOUNT_DECIMAL_PLACES: 2,
  
  // 统计数据缓存时间（分钟）
  STATISTICS_CACHE_MINUTES: 15,
} as const;

// 财务模块权限配置
export const FINANCE_PERMISSIONS = {
  // 收款记录权限
  PAYMENT_VIEW: 'finance:payment:view',
  PAYMENT_CREATE: 'finance:payment:create',
  PAYMENT_UPDATE: 'finance:payment:update',
  PAYMENT_DELETE: 'finance:payment:delete',
  
  // 退款记录权限
  REFUND_VIEW: 'finance:refund:view',
  REFUND_CREATE: 'finance:refund:create',
  REFUND_UPDATE: 'finance:refund:update',
  REFUND_DELETE: 'finance:refund:delete',
  
  // 往来账单权限
  STATEMENT_VIEW: 'finance:statement:view',
  STATEMENT_CREATE: 'finance:statement:create',
  STATEMENT_UPDATE: 'finance:statement:update',
  STATEMENT_DELETE: 'finance:statement:delete',
  
  // 财务统计权限
  STATISTICS_VIEW: 'finance:statistics:view',
  EXPORT_DATA: 'finance:export:data',
} as const;

// 导出所有枚举值的数组形式，便于表单选项使用
export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHODS).map(([key, value]) => ({
  label: key,
  value,
}));

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUSES).map(([key, value]) => ({
  label: key,
  value,
}));

export const REFUND_TYPE_OPTIONS = Object.entries(REFUND_TYPES).map(([key, value]) => ({
  label: key,
  value,
}));

export const REFUND_METHOD_OPTIONS = Object.entries(REFUND_METHODS).map(([key, value]) => ({
  label: key,
  value,
}));

export const REFUND_STATUS_OPTIONS = Object.entries(REFUND_STATUSES).map(([key, value]) => ({
  label: key,
  value,
}));

export const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPES).map(([key, value]) => ({
  label: key,
  value,
}));

export const STATEMENT_STATUS_OPTIONS = Object.entries(STATEMENT_STATUSES).map(([key, value]) => ({
  label: key,
  value,
}));

export const TRANSACTION_TYPE_OPTIONS = Object.entries(TRANSACTION_TYPES).map(([key, value]) => ({
  label: key,
  value,
}));

export const TRANSACTION_STATUS_OPTIONS = Object.entries(TRANSACTION_STATUSES).map(([key, value]) => ({
  label: key,
  value,
}));

export const RECEIVABLE_STATUS_OPTIONS = Object.entries(RECEIVABLE_STATUSES).map(([key, value]) => ({
  label: key,
  value,
}));
