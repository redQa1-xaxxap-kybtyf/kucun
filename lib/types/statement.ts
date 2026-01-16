// 往来账单类型定义
// 定义客户和供应商的综合账务往来数据结构

// 账单类型枚举（用于前端筛选）
export type StatementType = 'customer' | 'supplier' | 'partner';

// 伙伴角色（存储在伙伴、账单中）
export type PartnerRole = 'customer' | 'supplier' | 'both';

// 交易类型枚举
export type TransactionType =
  | 'sale'
  | 'sale_reversal'
  | 'sales_return'
  | 'sales_return_reversal'
  | 'order_cancellation'
  | 'order_cancellation_reversal'
  | 'payment_in'
  | 'payment_in_reversal'
  | 'payment_out'
  | 'payment_out_reversal'
  | 'prepayment_in'
  | 'prepayment_in_reversal'
  | 'prepayment_out'
  | 'prepayment_out_reversal'
  | 'refund'
  | 'refund_reversal'
  | 'purchase'
  | 'purchase_reversal'
  | 'adjustment'
  | 'adjustment_reversal';

// 账单状态枚举
export type StatementStatus = 'active' | 'settled' | 'suspended';

// 往来账单基础数据
export interface AccountStatement {
  id: string;
  entityId: string; // 客户或供应商ID
  entityName: string;
  entityType: StatementType;
  partnerRole: PartnerRole;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  creditLimit?: number;
  overdueAmount?: number;
  paymentTerms?: string;
  status: StatementStatus;
  lastTransactionDate?: Date | string; // 支持Date对象和ISO字符串
  lastPaymentDate?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 往来账单详情（包含交易明细）
export interface AccountStatementDetail extends AccountStatement {
  entity: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    extendedInfo?: string;
  };
  transactions: StatementTransaction[];
  transactionsPagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    currentMonthAmount: number;
    lastMonthAmount: number;
    averageMonthlyAmount: number;
    paymentRate: number;
    averagePaymentDays: number;
  };
}

// 账单交易记录
export interface StatementTransaction {
  id: string;
  statementId: string;
  transactionType: TransactionType;
  direction: 'debit' | 'credit';
  referenceId: string; // 关联的订单、支付或退款ID
  referenceNumber: string; // 关联的单据号
  debitAmount: number;
  creditAmount: number;
  amount: number;
  beforeBalance: number;
  balance: number; // 交易后余额
  afterBalance: number;
  description: string;
  transactionDate: Date | string; // 支持Date对象和ISO字符串
  status: 'pending' | 'completed';
  metadata?: Record<string, unknown> | null;
  createdAt: Date | string;
}

// 往来账单查询参数
export interface StatementQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  entityType?: StatementType;
  status?: StatementStatus;
  pendingAmountMin?: number;
  pendingAmountMax?: number;
  startDate?: string;
  endDate?: string;
  sortBy?:
    | 'entityName'
    | 'totalAmount'
    | 'pendingAmount'
    | 'lastTransactionDate';
  sortOrder?: 'asc' | 'desc';
}

// 交易记录查询参数
export interface TransactionQuery {
  statementId?: string;
  entityId?: string;
  transactionType?: TransactionType;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'completed';
  sortBy?: 'transactionDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// 往来账单统计数据
export interface StatementStatistics {
  customerStats: {
    totalCustomers: number;
    activeCustomers: number;
    totalReceivable: number;
    averagePaymentDays: number;
  };
  supplierStats: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalPayable: number;
    averagePaymentDays: number;
  };
  monthlyTrends: {
    month: string;
    customerAmount: number;
    supplierAmount: number;
    netAmount: number;
  }[];
}

// 账龄分析数据
export interface AgingAnalysis {
  entityId: string;
  entityName: string;
  entityType: StatementType;
  current: number; // 当期
  days30: number; // 30天内
  days60: number; // 31-60天
  days90: number; // 61-90天
  over90: number; // 90天以上
  total: number;
}

// 对账单数据
export interface ReconciliationStatement {
  statementId: string;
  entityName: string;
  entityType: StatementType;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  transactions: StatementTransaction[];
  generatedAt: string;
  generatedBy: string;
}

// API响应类型
export interface StatementResponse {
  success: boolean;
  data: AccountStatement;
  error?: string;
}

export interface StatementListResponse {
  success: boolean;
  data: {
    statements: AccountStatement[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: {
      totalCustomers: number;
      totalSuppliers: number;
      totalReceivable: number;
      totalPayable: number;
    };
  };
  error?: string;
}

export interface StatementDetailResponse {
  success: boolean;
  data: AccountStatementDetail;
  error?: string;
}

export interface StatementStatisticsResponse {
  success: boolean;
  data: StatementStatistics;
  error?: string;
}

export interface AgingAnalysisResponse {
  success: boolean;
  data: AgingAnalysis[];
  error?: string;
}

export interface ReconciliationResponse {
  success: boolean;
  data: ReconciliationStatement;
  error?: string;
}

// 账单状态配置
export interface StatementStatusConfig {
  status: StatementStatus;
  label: string;
  description: string;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange';
  isActive: boolean;
}

// 默认账单状态配置
export const DEFAULT_STATEMENT_STATUSES: StatementStatusConfig[] = [
  {
    status: 'active',
    label: '正常',
    description: '账户状态正常',
    color: 'green',
    isActive: true,
  },
  {
    status: 'settled',
    label: '已结清',
    description: '账户已结清',
    color: 'blue',
    isActive: true,
  },
  {
    status: 'suspended',
    label: '暂停',
    description: '账户已暂停',
    color: 'gray',
    isActive: true,
  },
];

// 交易类型配置
export interface TransactionTypeConfig {
  type: TransactionType;
  label: string;
  description: string;
  isDebit: boolean; // 是否为增加应收/减少应付
  isActive: boolean;
}

// 默认交易类型配置
export const DEFAULT_TRANSACTION_TYPES: TransactionTypeConfig[] = [
  {
    type: 'sale',
    label: '销售',
    description: '销售订单',
    isDebit: true,
    isActive: true,
  },
  {
    type: 'sale_reversal',
    label: '销售冲销',
    description: '销售订单冲销分录（系统内部）',
    isDebit: false,
    isActive: false,
  },
  {
    type: 'sales_return',
    label: '销售退货',
    description: '销售退货单',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'sales_return_reversal',
    label: '退货冲销',
    description: '销售退货冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'order_cancellation',
    label: '订单取消',
    description: '销售订单取消',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'order_cancellation_reversal',
    label: '取消冲销',
    description: '订单取消冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'payment_in',
    label: '收款',
    description: '客户付款',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'payment_in_reversal',
    label: '收款冲销',
    description: '客户收款冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'payment_out',
    label: '付款',
    description: '付款给伙伴',
    isDebit: true,
    isActive: true,
  },
  {
    type: 'payment_out_reversal',
    label: '付款冲销',
    description: '供应商付款冲销分录（系统内部）',
    isDebit: false,
    isActive: false,
  },
  {
    type: 'prepayment_in',
    label: '预收款',
    description: '收到预付款',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'prepayment_in_reversal',
    label: '预收冲销',
    description: '预收款冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'prepayment_out',
    label: '预付款',
    description: '支付预付款',
    isDebit: true,
    isActive: true,
  },
  {
    type: 'prepayment_out_reversal',
    label: '预付冲销',
    description: '预付款冲销分录（系统内部）',
    isDebit: false,
    isActive: false,
  },
  {
    type: 'refund',
    label: '退款',
    description: '退款给客户',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'refund_reversal',
    label: '退款冲销',
    description: '客户退款冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'purchase',
    label: '采购',
    description: '采购订单',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'purchase_reversal',
    label: '采购冲销',
    description: '采购应付冲销分录（系统内部）',
    isDebit: true,
    isActive: false,
  },
  {
    type: 'adjustment',
    label: '调整',
    description: '账务调整',
    isDebit: true,
    isActive: true,
  },
  {
    type: 'adjustment_reversal',
    label: '调整冲销',
    description: '账务调整冲销分录（系统内部）',
    isDebit: false,
    isActive: false,
  },
];

// 工具函数类型
export interface StatementUtils {
  formatAmount: (amount: number) => string;
  formatStatementStatus: (status: StatementStatus) => string;
  formatTransactionType: (type: TransactionType) => string;
  calculatePaymentRate: (totalAmount: number, paidAmount: number) => number;
  calculateAging: (transactions: StatementTransaction[]) => AgingAnalysis;
  getStatementStatusColor: (status: StatementStatus) => string;
  getTransactionTypeIcon: (type: TransactionType) => string;
  generateStatementNumber: () => string;
}
