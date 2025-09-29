/**
 * 财务管理模块统一配置
 * 遵循唯一真理源原则，所有枚举值和常量在此统一定义
 * 注意：分页和信用额度配置已迁移到环境配置 (lib/env.ts)
 * 请使用 paginationConfig 和 financeConfig 替代硬编码值
 */

import { financeConfig, paginationConfig } from '@/lib/env';

// 支付方式枚举
export const PAYMENT_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  OTHER: 'other',
} as const;

// 支付状态枚举
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

// 退款类型枚举
export const REFUND_TYPES = {
  FULL_REFUND: 'full_refund',
  PARTIAL_REFUND: 'partial_refund',
  EXCHANGE_REFUND: 'exchange_refund',
} as const;

// 退款方式枚举
export const REFUND_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  ORIGINAL_PAYMENT: 'original_payment',
  OTHER: 'other',
} as const;

// 退款状态枚举
export const REFUND_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

// 账单实体类型枚举
export const ENTITY_TYPES = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
} as const;

// 账单状态枚举
export const STATEMENT_STATUSES = {
  PENDING: 'pending',
  SETTLED: 'settled',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

// 支付方式中文标签映射
export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: '现金',
  [PAYMENT_METHODS.BANK_TRANSFER]: '银行转账',
  [PAYMENT_METHODS.CHECK]: '支票',
  [PAYMENT_METHODS.OTHER]: '其他',
} as const;

// 支付状态中文标签映射
export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUSES.PENDING]: '待确认',
  [PAYMENT_STATUSES.CONFIRMED]: '已确认',
  [PAYMENT_STATUSES.CANCELLED]: '已取消',
} as const;

// 退款类型中文标签映射
export const REFUND_TYPE_LABELS = {
  [REFUND_TYPES.FULL_REFUND]: '全额退款',
  [REFUND_TYPES.PARTIAL_REFUND]: '部分退款',
  [REFUND_TYPES.EXCHANGE_REFUND]: '换货退款',
} as const;

// 退款方式中文标签映射
export const REFUND_METHOD_LABELS = {
  [REFUND_METHODS.CASH]: '现金',
  [REFUND_METHODS.BANK_TRANSFER]: '银行转账',
  [REFUND_METHODS.ORIGINAL_PAYMENT]: '原支付方式',
  [REFUND_METHODS.OTHER]: '其他',
} as const;

// 退款状态中文标签映射
export const REFUND_STATUS_LABELS = {
  [REFUND_STATUSES.PENDING]: '待处理',
  [REFUND_STATUSES.PROCESSING]: '处理中',
  [REFUND_STATUSES.COMPLETED]: '已完成',
  [REFUND_STATUSES.REJECTED]: '已拒绝',
  [REFUND_STATUSES.CANCELLED]: '已取消',
} as const;

// 账单实体类型中文标签映射
export const ENTITY_TYPE_LABELS = {
  [ENTITY_TYPES.CUSTOMER]: '客户',
  [ENTITY_TYPES.SUPPLIER]: '供应商',
} as const;

// 账单状态中文标签映射
export const STATEMENT_STATUS_LABELS = {
  [STATEMENT_STATUSES.PENDING]: '待处理',
  [STATEMENT_STATUSES.SETTLED]: '已结清',
  [STATEMENT_STATUSES.OVERDUE]: '逾期',
  [STATEMENT_STATUSES.CANCELLED]: '已取消',
} as const;

// 交易类型枚举
export const TRANSACTION_TYPES = {
  SALE: 'sale',
  PAYMENT: 'payment',
  REFUND: 'refund',
  PURCHASE: 'purchase',
  PAYMENT_OUT: 'payment_out',
  ADJUSTMENT: 'adjustment',
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

// 交易状态枚举
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUSES)[keyof typeof TRANSACTION_STATUSES];

// 交易类型中文标签映射
export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPES.SALE]: '销售',
  [TRANSACTION_TYPES.PAYMENT]: '收款',
  [TRANSACTION_TYPES.REFUND]: '退款',
  [TRANSACTION_TYPES.PURCHASE]: '采购',
  [TRANSACTION_TYPES.PAYMENT_OUT]: '付款',
  [TRANSACTION_TYPES.ADJUSTMENT]: '调整',
} as const;

// 交易状态中文标签映射
export const TRANSACTION_STATUS_LABELS = {
  [TRANSACTION_STATUSES.PENDING]: '待处理',
  [TRANSACTION_STATUSES.COMPLETED]: '已完成',
  [TRANSACTION_STATUSES.OVERDUE]: '逾期',
} as const;

// 应收账款状态枚举
export const RECEIVABLE_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

export type ReceivableStatus =
  (typeof RECEIVABLE_STATUSES)[keyof typeof RECEIVABLE_STATUSES];

// 财务配置常量
export const FINANCE_CONFIG = {
  // 默认付款期限（天）
  DEFAULT_PAYMENT_TERMS: 30,

  // 逾期天数阈值
  OVERDUE_THRESHOLD_DAYS: 30,

  // 默认信用额度 - 已迁移到环境配置
  get DEFAULT_CREDIT_LIMIT() {
    return financeConfig.creditLimit;
  },

  // 分页默认设置 - 已迁移到环境配置
  get DEFAULT_PAGE_SIZE() {
    return paginationConfig.defaultPageSize;
  },
  get MAX_PAGE_SIZE() {
    return paginationConfig.maxPageSize;
  },

  // 金额格式化精度
  AMOUNT_DECIMAL_PLACES: 2,

  // 统计数据缓存时间（秒） - 已迁移到环境配置
  get STATISTICS_CACHE_SECONDS() {
    return financeConfig.cacheTtl;
  },
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
export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHODS).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUSES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const REFUND_TYPE_OPTIONS = Object.entries(REFUND_TYPES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const REFUND_METHOD_OPTIONS = Object.entries(REFUND_METHODS).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const REFUND_STATUS_OPTIONS = Object.entries(REFUND_STATUSES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const STATEMENT_STATUS_OPTIONS = Object.entries(STATEMENT_STATUSES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const TRANSACTION_TYPE_OPTIONS = Object.entries(TRANSACTION_TYPES).map(
  ([key, value]) => ({
    label: key,
    value,
  })
);

export const TRANSACTION_STATUS_OPTIONS = Object.entries(
  TRANSACTION_STATUSES
).map(([key, value]) => ({
  label: key,
  value,
}));

export const RECEIVABLE_STATUS_OPTIONS = Object.entries(
  RECEIVABLE_STATUSES
).map(([key, value]) => ({
  label: key,
  value,
}));

// TypeScript 类型推导
export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export type RefundType = (typeof REFUND_TYPES)[keyof typeof REFUND_TYPES];

export type RefundMethod = (typeof REFUND_METHODS)[keyof typeof REFUND_METHODS];

export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export type StatementStatus = (typeof STATEMENT_STATUSES)[keyof typeof STATEMENT_STATUSES];
