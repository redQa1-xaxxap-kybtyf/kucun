/**
 * 应付款管理类型定义
 * 遵循全栈开发执行手册：Zod Schema 作为单一真理源
 *
 * 重要：枚举和表单输入类型从 lib/validations/payable.ts 导入
 * 本文件只定义 API 响应、详情和扩展类型
 */

// 从 Zod Schema 导入基础类型（单一真理源）
import type {
  PayableStatus,
  PayableSourceType,
  PaymentOutMethod,
  PaymentOutStatus,
  CreatePayableRecordData,
  UpdatePayableRecordData,
  CreatePaymentOutRecordData,
  UpdatePaymentOutRecordData,
  PayableRecordQuery,
  PaymentOutRecordQuery,
} from '@/lib/validations/payable';

// 重新导出以保持向后兼容
export type {
  PayableStatus,
  PayableSourceType,
  PaymentOutMethod,
  PaymentOutStatus,
  CreatePayableRecordData,
  UpdatePayableRecordData,
  CreatePaymentOutRecordData,
  UpdatePaymentOutRecordData,
  PayableRecordQuery,
  PaymentOutRecordQuery,
};

// 应付款记录基础数据
export interface PayableRecord {
  id: string;
  payableNumber: string;
  supplierId: string;
  userId: string;
  sourceType: PayableSourceType;
  sourceId?: string;
  sourceNumber?: string;
  payableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: Date | string;
  status: PayableStatus;
  paymentTerms: string;
  description?: string;
  remarks?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 应付款记录详情（包含关联数据）
export interface PayableRecordDetail extends PayableRecord {
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
  paymentOutRecords: PaymentOutRecord[];
}

// 付款记录基础数据
export interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  payableRecordId?: string;
  supplierId: string;
  userId: string;
  paymentMethod: PaymentOutMethod;
  paymentAmount: number;
  paymentDate: Date | string;
  status: PaymentOutStatus;
  remarks?: string;
  voucherNumber?: string;
  bankInfo?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 付款记录详情（包含关联数据）
export interface PaymentOutRecordDetail extends PaymentOutRecord {
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
  };
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
}

// 注意：CreatePayableRecordData, UpdatePayableRecordData 等
// 已从 lib/validations/payable.ts 导入，不在此重复定义

// 应付款统计数据
export interface PayableStatistics {
  totalPayables: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  overdueAmount: number;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  thisMonthPayables: number;
  thisMonthPayments: number;
}

// 应付款列表响应
export interface PayableRecordListResponse {
  data: PayableRecordDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 付款记录列表响应
export interface PaymentOutRecordListResponse {
  data: PaymentOutRecordDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 应付款统计响应
export interface PayableStatisticsResponse {
  success: boolean;
  data: PayableStatistics;
}

// 应付款记录响应
export interface PayableRecordResponse {
  success: boolean;
  data: PayableRecordDetail;
  message?: string;
}

// 付款记录响应
export interface PaymentOutRecordResponse {
  success: boolean;
  data: PaymentOutRecordDetail;
  message?: string;
}

// 应付款状态标签映射
export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending: '待付款',
  partial: '部分付款',
  paid: '已付款',
  overdue: '逾期',
  cancelled: '已取消',
};

// 应付款来源类型标签映射
export const PAYABLE_SOURCE_TYPE_LABELS: Record<PayableSourceType, string> = {
  purchase_order: '采购订单',
  factory_shipment: '厂家发货',
  sales_order: '调货销售',
  service: '服务费用',
  other: '其他',
};

// 付款方式标签映射
export const PAYMENT_OUT_METHOD_LABELS: Record<PaymentOutMethod, string> = {
  cash: '现金',
  bank_transfer: '银行转账',
  check: '支票',
  other: '其他',
};

// 付款状态标签映射
export const PAYMENT_OUT_STATUS_LABELS: Record<PaymentOutStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
};

// 应付款状态变体映射（用于Badge组件）
export const PAYABLE_STATUS_VARIANTS: Record<
  PayableStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  partial: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'destructive',
};

// 付款状态变体映射（用于Badge组件）
export const PAYMENT_OUT_STATUS_VARIANTS: Record<
  PaymentOutStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  confirmed: 'default',
  cancelled: 'destructive',
};

// 应付款排序选项
export const PAYABLE_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'payableAmount', label: '应付金额' },
  { value: 'dueDate', label: '到期日期' },
  { value: 'remainingAmount', label: '剩余金额' },
];

// 付款记录排序选项
export const PAYMENT_OUT_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'paymentAmount', label: '付款金额' },
  { value: 'paymentDate', label: '付款日期' },
];
