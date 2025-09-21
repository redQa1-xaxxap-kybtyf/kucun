// 退款管理类型定义
// 定义退款记录、退款申请等相关数据结构

// 退款方式枚举
export type RefundMethod =
  | 'cash'
  | 'bank_transfer'
  | 'original_payment'
  | 'other';

// 退款状态枚举
export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

// 退款类型枚举
export type RefundType = 'full_refund' | 'partial_refund' | 'exchange_refund';

// 退款记录基础数据
export interface RefundRecord {
  id: string;
  refundNumber: string;
  returnOrderId: string;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  refundDate: string;
  processedDate?: string;
  status: RefundStatus;
  reason: string;
  remarks?: string;
  bankInfo?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// 退款记录详情（包含关联数据）
export interface RefundRecordDetail extends RefundRecord {
  returnOrder: {
    id: string;
    returnNumber: string;
    type: string;
    status: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
}

// 退款记录创建数据
export interface CreateRefundRecordData {
  returnOrderId: string;
  salesOrderId: string;
  customerId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  refundDate: string;
  reason: string;
  remarks?: string;
  bankInfo?: string;
  receiptNumber?: string;
}

// 退款记录更新数据
export interface UpdateRefundRecordData {
  refundMethod?: RefundMethod;
  refundAmount?: number;
  processedAmount?: number;
  refundDate?: string;
  processedDate?: string;
  status?: RefundStatus;
  reason?: string;
  remarks?: string;
  bankInfo?: string;
  receiptNumber?: string;
}

// 退款统计数据
export interface RefundStatistics {
  totalRefundable: number; // 总应退金额
  totalProcessed: number; // 总已处理金额
  totalPending: number; // 总待处理金额
  totalRejected: number; // 总拒绝金额
  refundableCount: number; // 应退款数量
  processedCount: number; // 已处理数量
  pendingCount: number; // 待处理数量
  rejectedCount: number; // 拒绝数量
  averageProcessingDays: number; // 平均处理天数
  refundRate: number; // 退款率 (%)
}

// 退款方式统计
export interface RefundMethodStatistics {
  method: RefundMethod;
  count: number;
  amount: number;
  percentage: number;
}

// 客户退款统计
export interface CustomerRefundStatistics {
  customerId: string;
  customerName: string;
  totalRefunds: number;
  totalAmount: number;
  processedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  averageProcessingDays: number;
  refundRate: number;
  lastRefundDate?: string;
}

// 退款查询参数
export interface RefundRecordQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  customerId?: string;
  returnOrderId?: string;
  salesOrderId?: string;
  status?: RefundStatus;
  refundType?: RefundType;
  refundMethod?: RefundMethod;
  startDate?: string;
  endDate?: string;
  sortBy?: 'refundDate' | 'refundAmount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// API响应类型
export interface RefundRecordResponse {
  success: boolean;
  data: RefundRecord;
  error?: string;
}

export interface RefundRecordListResponse {
  success: boolean;
  data: {
    records: RefundRecordDetail[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface RefundStatisticsResponse {
  success: boolean;
  data: RefundStatistics;
  error?: string;
}

// 退款方式配置
export interface RefundMethodConfig {
  method: RefundMethod;
  label: string;
  description: string;
  requiresBankInfo: boolean;
  requiresReceiptNumber: boolean;
  isActive: boolean;
  sortOrder: number;
}

// 默认退款方式配置
export const DEFAULT_REFUND_METHODS: RefundMethodConfig[] = [
  {
    method: 'original_payment',
    label: '原路退回',
    description: '退回到原支付方式',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    method: 'cash',
    label: '现金退款',
    description: '现金退款',
    requiresBankInfo: false,
    requiresReceiptNumber: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    method: 'bank_transfer',
    label: '银行转账',
    description: '银行转账退款',
    requiresBankInfo: true,
    requiresReceiptNumber: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    method: 'other',
    label: '其他方式',
    description: '其他退款方式',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 4,
  },
];

// 退款状态配置
export interface RefundStatusConfig {
  status: RefundStatus;
  label: string;
  description: string;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange';
  isActive: boolean;
}

// 默认退款状态配置
export const DEFAULT_REFUND_STATUSES: RefundStatusConfig[] = [
  {
    status: 'pending',
    label: '待处理',
    description: '退款申请已提交，等待处理',
    color: 'yellow',
    isActive: true,
  },
  {
    status: 'processing',
    label: '处理中',
    description: '退款正在处理中',
    color: 'blue',
    isActive: true,
  },
  {
    status: 'completed',
    label: '已完成',
    description: '退款已完成',
    color: 'green',
    isActive: true,
  },
  {
    status: 'rejected',
    label: '已拒绝',
    description: '退款申请被拒绝',
    color: 'red',
    isActive: true,
  },
  {
    status: 'cancelled',
    label: '已取消',
    description: '退款申请已取消',
    color: 'gray',
    isActive: true,
  },
];

// 退款类型配置
export interface RefundTypeConfig {
  type: RefundType;
  label: string;
  description: string;
  isActive: boolean;
}

// 默认退款类型配置
export const DEFAULT_REFUND_TYPES: RefundTypeConfig[] = [
  {
    type: 'full_refund',
    label: '全额退款',
    description: '退回全部金额',
    isActive: true,
  },
  {
    type: 'partial_refund',
    label: '部分退款',
    description: '退回部分金额',
    isActive: true,
  },
  {
    type: 'exchange_refund',
    label: '换货退款',
    description: '换货产生的退款',
    isActive: true,
  },
];

// 工具函数类型
export interface RefundUtils {
  formatAmount: (amount: number) => string;
  formatRefundMethod: (method: RefundMethod) => string;
  formatRefundStatus: (status: RefundStatus) => string;
  formatRefundType: (type: RefundType) => string;
  calculateRefundRate: (totalAmount: number, refundAmount: number) => number;
  calculateProcessingDays: (
    createdDate: string,
    processedDate?: string
  ) => number;
  getRefundStatusColor: (status: RefundStatus) => string;
  getRefundMethodIcon: (method: RefundMethod) => string;
  generateRefundNumber: () => string;
  validateRefundAmount: (amount: number, maxAmount: number) => boolean;
}
