// 往来账单类型定义
// 定义客户和供应商的综合账务往来数据结构

// 账单类型枚举
export type StatementType = 'customer' | 'supplier';

// 交易类型枚举
export type TransactionType =
  | 'sale'
  | 'payment'
  | 'refund'
  | 'purchase'
  | 'payment_out'
  | 'adjustment';

// 账单状态枚举
export type StatementStatus = 'active' | 'settled' | 'overdue' | 'suspended';

// 往来账单基础数据
export interface AccountStatement {
  id: string;
  entityId: string; // 客户或供应商ID
  entityName: string;
  entityType: StatementType;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  creditLimit: number;
  paymentTerms: string; // 付款条件，如"30天"
  status: StatementStatus;
  lastTransactionDate?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
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
  referenceId: string; // 关联的订单、支付或退款ID
  referenceNumber: string; // 关联的单据号
  amount: number;
  balance: number; // 交易后余额
  description: string;
  transactionDate: string;
  dueDate?: string;
  status: 'pending' | 'completed' | 'overdue';
  createdAt: string;
}

// 往来账单查询参数
export interface StatementQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  entityType?: StatementType;
  status?: StatementStatus;
  creditLimitMin?: number;
  creditLimitMax?: number;
  pendingAmountMin?: number;
  pendingAmountMax?: number;
  overdueOnly?: boolean;
  startDate?: string;
  endDate?: string;
  sortBy?:
    | 'entityName'
    | 'totalAmount'
    | 'pendingAmount'
    | 'overdueAmount'
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
  status?: 'pending' | 'completed' | 'overdue';
  sortBy?: 'transactionDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// 往来账单统计数据
export interface StatementStatistics {
  customerStats: {
    totalCustomers: number;
    activeCustomers: number;
    totalReceivable: number;
    totalOverdue: number;
    averageCreditLimit: number;
    averagePaymentDays: number;
  };
  supplierStats: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalPayable: number;
    totalOverdue: number;
    averageCreditLimit: number;
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
    statements: AccountStatementDetail[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
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
    status: 'overdue',
    label: '逾期',
    description: '存在逾期账款',
    color: 'red',
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
  isDebit: boolean; // 是否为借方
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
    type: 'payment',
    label: '收款',
    description: '客户付款',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'refund',
    label: '退款',
    description: '退款给客户',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'purchase',
    label: '采购',
    description: '采购订单',
    isDebit: false,
    isActive: true,
  },
  {
    type: 'payment_out',
    label: '付款',
    description: '付款给供应商',
    isDebit: true,
    isActive: true,
  },
  {
    type: 'adjustment',
    label: '调整',
    description: '账务调整',
    isDebit: true,
    isActive: true,
  },
];

// 工具函数类型
export interface StatementUtils {
  formatAmount: (amount: number) => string;
  formatStatementStatus: (status: StatementStatus) => string;
  formatTransactionType: (type: TransactionType) => string;
  calculatePaymentRate: (totalAmount: number, paidAmount: number) => number;
  calculateOverdueDays: (dueDate: string) => number;
  calculateAging: (transactions: StatementTransaction[]) => AgingAnalysis;
  getStatementStatusColor: (status: StatementStatus) => string;
  getTransactionTypeIcon: (type: TransactionType) => string;
  generateStatementNumber: () => string;
  validateCreditLimit: (amount: number, creditLimit: number) => boolean;
}
