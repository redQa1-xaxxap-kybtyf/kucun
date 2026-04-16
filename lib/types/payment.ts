// 收款管理类型定义
// 定义收款记录、应收账款等相关数据结构

import type {
  AccountsReceivableQueryInput,
  BatchPaymentOperationInput,
  CreatePaymentRecordInput,
  PaymentConfirmationInput,
  PaymentMethod,
  PaymentRecordQueryInput,
  PaymentStatisticsQueryInput,
  PaymentStatus,
  PaymentType,
  UpdatePaymentRecordInput,
} from '@/lib/validations/payment';

// 收款方式、状态、类型枚举（与验证规则保持同步）
export type {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '@/lib/validations/payment';

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  salesOrderId: string | null;
  factoryShipmentOrderId?: string | null;
  customerId: string;
  userId: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  appliedAmount: number;
  paymentDate: Date | string; // 支持Date对象和ISO字符串
  status: PaymentStatus;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
}

// 收款记录详情（包含关联数据）
export interface PaymentRecordDetail extends PaymentRecord {
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };
  factoryShipmentOrder?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
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

// 收款记录创建/更新数据（直接复用 Zod 输入类型，保持与验证规则一致）
export type CreatePaymentRecordData = CreatePaymentRecordInput;
export type UpdatePaymentRecordData = UpdatePaymentRecordInput;

// 应收账款数据
export interface AccountsReceivable {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount?: number;
  remainingAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'pending' | 'paid';
  orderDate: Date | string; // 支持Date对象和ISO字符串
  dueDate?: Date | string;
  lastPaymentDate?: Date | string;
  [key: string]: unknown;
}

// 收款统计数据
export interface PaymentStatistics {
  totalReceivable: number; // 总应收金额
  totalReceived: number; // 总已收金额
  totalPending: number; // 总待收金额
  receivableCount: number; // 应收账款数量
  receivedCount: number; // 已收款数量
  pendingCount: number; // 待收款数量
  averagePaymentDays: number; // 平均收款天数
  paymentRate: number; // 收款率 (%)
}

// 收款方式统计
export interface PaymentMethodStatistics {
  method: PaymentMethod;
  count: number;
  amount: number;
  percentage: number;
}

// 客户收款统计
export interface CustomerPaymentStatistics {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  averagePaymentDays: number;
  paymentRate: number;
  lastPaymentDate?: string;
}

// 收款记录查询参数（limit 为后端字段，pageSize 供前端组件使用）
export type PaymentRecordQuery = Omit<PaymentRecordQueryInput, 'limit'> & {
  pageSize?: number;
  limit?: number;
};

// 应收账款查询参数
export type AccountsReceivableQuery = Omit<
  AccountsReceivableQueryInput,
  'limit'
> & {
  pageSize?: number;
  limit?: number;
};

// 统计/批量操作相关输入（保持与验证层命名一致）
export type PaymentStatisticsQuery = PaymentStatisticsQueryInput;
export type PaymentConfirmationData = PaymentConfirmationInput;
export type BatchPaymentOperationData = BatchPaymentOperationInput;

// API响应类型
export interface PaymentRecordResponse {
  success: boolean;
  data: PaymentRecord;
  error?: string;
  details?: Array<{
    path?: string[];
    message: string;
    code?: string;
  }>;
}

export interface PaymentRecordListResponse {
  success: boolean;
  data: {
    records: PaymentRecordDetail[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export interface AccountsReceivableResponse {
  success: boolean;
  data: {
    records: AccountsReceivable[];
    total: number;
    page: number;
    pageSize: number;
    statistics: PaymentStatistics;
  };
  error?: string;
}

export interface PaymentStatisticsResponse {
  success: boolean;
  data: {
    overall: PaymentStatistics;
    byMethod: PaymentMethodStatistics[];
    byCustomer: CustomerPaymentStatistics[];
  };
  error?: string;
}

// 收款确认数据
export interface PaymentConfirmation {
  paymentRecordId: string;
  confirmationDate: string;
  confirmedBy: string;
  notes?: string;
}

// 收款提醒数据
export interface PaymentReminder {
  salesOrderId: string;
  customerId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  reminderType: 'due_soon' | 'follow_up';
  lastReminderDate?: string;
}

// 收款计划数据
export interface PaymentPlan {
  id: string;
  salesOrderId: string;
  customerId: string;
  totalAmount: number;
  installments: PaymentInstallment[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// 分期付款数据
export interface PaymentInstallment {
  id: string;
  paymentPlanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid';
  paymentRecordId?: string;
  paidDate?: string;
  paidAmount?: number;
}

// 收款方式配置
export interface PaymentMethodConfig {
  method: PaymentMethod;
  label: string;
  description: string;
  requiresBankInfo: boolean;
  requiresReceiptNumber: boolean;
  isActive: boolean;
  sortOrder: number;
}

// 默认收款方式配置
export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    method: 'cash',
    label: '现金',
    description: '现金收款',
    requiresBankInfo: false,
    requiresReceiptNumber: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    method: 'wechat_transfer',
    label: '微信转账',
    description: '微信转账收款',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    method: 'abc_qr',
    label: '农行码',
    description: '中国农业银行收款码',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 3,
  },
  {
    method: 'icbc_qr',
    label: '工行码',
    description: '中国工商银行收款码',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 4,
  },
  {
    method: 'ccb_qr',
    label: '建行码',
    description: '中国建设银行收款码',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 5,
  },
  {
    method: 'cib_qr',
    label: '兴业码',
    description: '兴业银行收款码',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 6,
  },
];

// 收款状态配置
export interface PaymentStatusConfig {
  status: PaymentStatus;
  label: string;
  description: string;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red';
  isActive: boolean;
}

// 收款状态变体映射（用于Badge组件）
export const PAYMENT_STATUS_VARIANTS: Record<
  PaymentStatus,
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
> = {
  pending: 'warning',
  applied: 'info',
  confirmed: 'success',
  cancelled: 'destructive',
};

// 默认收款状态配置
export const DEFAULT_PAYMENT_STATUSES: PaymentStatusConfig[] = [
  {
    status: 'pending',
    label: '待确认到账',
    description: '收款信息已登记，等待确认到账',
    color: 'yellow',
    isActive: true,
  },
  {
    status: 'applied',
    label: '已冲抵',
    description: '预收款已部分或全部冲抵销售订单',
    color: 'blue',
    isActive: true,
  },
  {
    status: 'confirmed',
    label: '已到账',
    description: '收款已确认到账',
    color: 'green',
    isActive: true,
  },
  {
    status: 'cancelled',
    label: '已取消',
    description: '收款记录已取消',
    color: 'red',
    isActive: true,
  },
];

// 工具函数类型
export interface PaymentUtils {
  formatAmount: (amount: number) => string;
  formatPaymentMethod: (method: PaymentMethod) => string;
  formatPaymentStatus: (status: PaymentStatus) => string;
  calculatePaymentRate: (totalAmount: number, paidAmount: number) => number;
  calculateOverdueDays: (dueDate: string) => number;
  getPaymentStatusColor: (status: PaymentStatus) => string;
  getPaymentMethodIcon: (method: PaymentMethod) => string;
  generatePaymentNumber: () => string;
  validatePaymentAmount: (amount: number, maxAmount: number) => boolean;
}
