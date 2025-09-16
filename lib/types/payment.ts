// 收款管理类型定义
// 定义收款记录、应收账款等相关数据结构

// 收款方式枚举
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'other'

// 收款状态枚举
export type PaymentStatus = 'pending' | 'confirmed' | 'cancelled'

// 收款记录基础数据
export interface PaymentRecord {
  id: string
  paymentNumber: string
  salesOrderId: string
  customerId: string
  userId: string
  paymentMethod: PaymentMethod
  paymentAmount: number
  paymentDate: string
  status: PaymentStatus
  remarks?: string
  receiptNumber?: string
  bankInfo?: string
  createdAt: string
  updatedAt: string
}

// 收款记录详情（包含关联数据）
export interface PaymentRecordDetail extends PaymentRecord {
  salesOrder: {
    id: string
    orderNumber: string
    totalAmount: number
    status: string
  }
  customer: {
    id: string
    name: string
    phone?: string
  }
  user: {
    id: string
    name: string
  }
}

// 收款记录创建数据
export interface CreatePaymentRecordData {
  salesOrderId: string
  customerId: string
  paymentMethod: PaymentMethod
  paymentAmount: number
  paymentDate: string
  remarks?: string
  receiptNumber?: string
  bankInfo?: string
}

// 收款记录更新数据
export interface UpdatePaymentRecordData {
  paymentMethod?: PaymentMethod
  paymentAmount?: number
  paymentDate?: string
  status?: PaymentStatus
  remarks?: string
  receiptNumber?: string
  bankInfo?: string
}

// 应收账款数据
export interface AccountsReceivable {
  salesOrderId: string
  orderNumber: string
  customerId: string
  customerName: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue'
  orderDate: string
  dueDate?: string
  overdueDays?: number
  lastPaymentDate?: string
}

// 收款统计数据
export interface PaymentStatistics {
  totalReceivable: number      // 总应收金额
  totalReceived: number        // 总已收金额
  totalPending: number         // 总待收金额
  totalOverdue: number         // 总逾期金额
  receivableCount: number      // 应收账款数量
  receivedCount: number        // 已收款数量
  pendingCount: number         // 待收款数量
  overdueCount: number         // 逾期数量
  averagePaymentDays: number   // 平均收款天数
  paymentRate: number          // 收款率 (%)
}

// 收款方式统计
export interface PaymentMethodStatistics {
  method: PaymentMethod
  count: number
  amount: number
  percentage: number
}

// 客户收款统计
export interface CustomerPaymentStatistics {
  customerId: string
  customerName: string
  totalOrders: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  overdueAmount: number
  averagePaymentDays: number
  paymentRate: number
  lastPaymentDate?: string
}

// 收款记录查询参数
export interface PaymentRecordQuery {
  page?: number
  pageSize?: number
  search?: string              // 搜索关键词（订单号、客户名称等）
  customerId?: string          // 客户ID筛选
  userId?: string              // 用户ID筛选
  paymentMethod?: PaymentMethod // 收款方式筛选
  status?: PaymentStatus       // 状态筛选
  startDate?: string           // 开始日期
  endDate?: string             // 结束日期
  sortBy?: 'paymentDate' | 'paymentAmount' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// 应收账款查询参数
export interface AccountsReceivableQuery {
  page?: number
  pageSize?: number
  search?: string              // 搜索关键词
  customerId?: string          // 客户ID筛选
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overdue'
  startDate?: string           // 订单开始日期
  endDate?: string             // 订单结束日期
  sortBy?: 'orderDate' | 'totalAmount' | 'remainingAmount' | 'overdueDays'
  sortOrder?: 'asc' | 'desc'
}

// API响应类型
export interface PaymentRecordResponse {
  success: boolean
  data: PaymentRecord
  error?: string
}

export interface PaymentRecordListResponse {
  success: boolean
  data: {
    records: PaymentRecordDetail[]
    total: number
    page: number
    pageSize: number
  }
  error?: string
}

export interface AccountsReceivableResponse {
  success: boolean
  data: {
    records: AccountsReceivable[]
    total: number
    page: number
    pageSize: number
    statistics: PaymentStatistics
  }
  error?: string
}

export interface PaymentStatisticsResponse {
  success: boolean
  data: {
    overall: PaymentStatistics
    byMethod: PaymentMethodStatistics[]
    byCustomer: CustomerPaymentStatistics[]
  }
  error?: string
}

// 收款确认数据
export interface PaymentConfirmation {
  paymentRecordId: string
  confirmationDate: string
  confirmedBy: string
  notes?: string
}

// 收款提醒数据
export interface PaymentReminder {
  salesOrderId: string
  customerId: string
  orderNumber: string
  customerName: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueDate?: string
  overdueDays: number
  reminderType: 'due_soon' | 'overdue' | 'long_overdue'
  lastReminderDate?: string
}

// 收款计划数据
export interface PaymentPlan {
  id: string
  salesOrderId: string
  customerId: string
  totalAmount: number
  installments: PaymentInstallment[]
  status: 'active' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// 分期付款数据
export interface PaymentInstallment {
  id: string
  paymentPlanId: string
  installmentNumber: number
  amount: number
  dueDate: string
  status: 'pending' | 'paid' | 'overdue'
  paymentRecordId?: string
  paidDate?: string
  paidAmount?: number
}

// 收款方式配置
export interface PaymentMethodConfig {
  method: PaymentMethod
  label: string
  description: string
  requiresBankInfo: boolean
  requiresReceiptNumber: boolean
  isActive: boolean
  sortOrder: number
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
    sortOrder: 1
  },
  {
    method: 'bank_transfer',
    label: '银行转账',
    description: '银行转账收款',
    requiresBankInfo: true,
    requiresReceiptNumber: true,
    isActive: true,
    sortOrder: 2
  },
  {
    method: 'check',
    label: '支票',
    description: '支票收款',
    requiresBankInfo: false,
    requiresReceiptNumber: true,
    isActive: true,
    sortOrder: 3
  },
  {
    method: 'other',
    label: '其他',
    description: '其他收款方式',
    requiresBankInfo: false,
    requiresReceiptNumber: false,
    isActive: true,
    sortOrder: 4
  }
]

// 收款状态配置
export interface PaymentStatusConfig {
  status: PaymentStatus
  label: string
  description: string
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red'
  isActive: boolean
}

// 默认收款状态配置
export const DEFAULT_PAYMENT_STATUSES: PaymentStatusConfig[] = [
  {
    status: 'pending',
    label: '待确认',
    description: '收款记录已创建，等待确认',
    color: 'yellow',
    isActive: true
  },
  {
    status: 'confirmed',
    label: '已确认',
    description: '收款已确认到账',
    color: 'green',
    isActive: true
  },
  {
    status: 'cancelled',
    label: '已取消',
    description: '收款记录已取消',
    color: 'red',
    isActive: true
  }
]

// 工具函数类型
export interface PaymentUtils {
  formatAmount: (amount: number) => string
  formatPaymentMethod: (method: PaymentMethod) => string
  formatPaymentStatus: (status: PaymentStatus) => string
  calculatePaymentRate: (totalAmount: number, paidAmount: number) => number
  calculateOverdueDays: (dueDate: string) => number
  getPaymentStatusColor: (status: PaymentStatus) => string
  getPaymentMethodIcon: (method: PaymentMethod) => string
  generatePaymentNumber: () => string
  validatePaymentAmount: (amount: number, maxAmount: number) => boolean
}
