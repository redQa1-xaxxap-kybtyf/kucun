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
// 注意：与 lib/validations/payment.ts 保持同步
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  APPLIED: 'applied',
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
  ALIPAY: 'alipay',
  WECHAT: 'wechat',
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
  ACTIVE: 'active',
  SETTLED: 'settled',
  SUSPENDED: 'suspended',
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
  [PAYMENT_STATUSES.APPLIED]: '已冲抵',
  [PAYMENT_STATUSES.CONFIRMED]: '已确认',
  [PAYMENT_STATUSES.CANCELLED]: '已取消',
} as const;

// 支付状态变体映射（用于 Badge 组件）
export const PAYMENT_STATUS_VARIANTS = {
  [PAYMENT_STATUSES.PENDING]: 'warning',
  [PAYMENT_STATUSES.APPLIED]: 'info',
  [PAYMENT_STATUSES.CONFIRMED]: 'success',
  [PAYMENT_STATUSES.CANCELLED]: 'destructive',
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
  [REFUND_METHODS.ALIPAY]: '支付宝',
  [REFUND_METHODS.WECHAT]: '微信支付',
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

// 退款状态变体映射（用于 Badge 组件）
// 注意：与 lib/types/refund.ts 中的 REFUND_STATUS_VARIANTS 保持同步
export const REFUND_STATUS_VARIANTS = {
  [REFUND_STATUSES.PENDING]: 'warning',
  [REFUND_STATUSES.PROCESSING]: 'info',
  [REFUND_STATUSES.COMPLETED]: 'success',
  [REFUND_STATUSES.REJECTED]: 'destructive',
  [REFUND_STATUSES.CANCELLED]: 'outline',
} as const;

// 账单实体类型中文标签映射
export const ENTITY_TYPE_LABELS = {
  [ENTITY_TYPES.CUSTOMER]: '客户',
  [ENTITY_TYPES.SUPPLIER]: '供应商',
} as const;

// 账单状态中文标签映射
export const STATEMENT_STATUS_LABELS = {
  [STATEMENT_STATUSES.ACTIVE]: '正常',
  [STATEMENT_STATUSES.SETTLED]: '已结清',
  [STATEMENT_STATUSES.SUSPENDED]: '已暂停',
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
} as const;

// 应收账款状态枚举
export const RECEIVABLE_STATUSES = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export type ReceivableStatus =
  (typeof RECEIVABLE_STATUSES)[keyof typeof RECEIVABLE_STATUSES];

// 应收账款状态中文标签映射
export const RECEIVABLE_STATUS_LABELS = {
  [RECEIVABLE_STATUSES.UNPAID]: '未收款',
  [RECEIVABLE_STATUSES.PARTIAL]: '部分收款',
  [RECEIVABLE_STATUSES.PAID]: '已收款',
} as const;


// 财务配置常量
export const FINANCE_CONFIG = {
  // 默认付款期限（天）
  DEFAULT_PAYMENT_TERMS: 30,

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
export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS).map(
  (value) => ({
    label: PAYMENT_METHOD_LABELS[value],
    value,
  })
);

export const PAYMENT_STATUS_OPTIONS = Object.values(PAYMENT_STATUSES).map(
  (value) => ({
    label: PAYMENT_STATUS_LABELS[value],
    value,
  })
);

export const REFUND_TYPE_OPTIONS = Object.values(REFUND_TYPES).map(
  (value) => ({
    label: REFUND_TYPE_LABELS[value],
    value,
  })
);

export const REFUND_METHOD_OPTIONS = Object.values(REFUND_METHODS).map(
  (value) => ({
    label: REFUND_METHOD_LABELS[value],
    value,
  })
);

export const REFUND_STATUS_OPTIONS = Object.values(REFUND_STATUSES).map(
  (value) => ({
    label: REFUND_STATUS_LABELS[value],
    value,
  })
);

export const ENTITY_TYPE_OPTIONS = Object.values(ENTITY_TYPES).map(
  (value) => ({
    label: ENTITY_TYPE_LABELS[value],
    value,
  })
);

export const STATEMENT_STATUS_OPTIONS = Object.values(STATEMENT_STATUSES).map(
  (value) => ({
    label: STATEMENT_STATUS_LABELS[value],
    value,
  })
);

export const TRANSACTION_TYPE_OPTIONS = Object.values(TRANSACTION_TYPES).map(
  (value) => ({
    label: TRANSACTION_TYPE_LABELS[value],
    value,
  })
);

export const TRANSACTION_STATUS_OPTIONS = Object.values(
  TRANSACTION_STATUSES
).map((value) => ({
  label: TRANSACTION_STATUS_LABELS[value],
  value,
}));

export const RECEIVABLE_STATUS_OPTIONS = Object.values(
  RECEIVABLE_STATUSES
).map((value) => ({
  label: RECEIVABLE_STATUS_LABELS[value as ReceivableStatus],
  value,
}));


// TypeScript 类型推导
export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export type RefundType = (typeof REFUND_TYPES)[keyof typeof REFUND_TYPES];

export type RefundMethod = (typeof REFUND_METHODS)[keyof typeof REFUND_METHODS];

export type RefundStatus =
  (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export type StatementStatus =
  (typeof STATEMENT_STATUSES)[keyof typeof STATEMENT_STATUSES];
