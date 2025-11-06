// 客户对账单类型定义
// 用于管理与客户之间的完整财务往来记录(包括销售、采购、退货等双向交易)

/**
 * 交易明细类型枚举
 */
export type CustomerStatementTransactionType =
  | 'sales_order' // 销售订单(应收)
  | 'sales_return' // 销售退货(冲减应收)
  | 'purchase_order' // 采购订单(应付,客户作为供应商)
  | 'purchase_return' // 采购退货(冲减应付)
  | 'payment_in' // 客户付款
  | 'payment_out' // 我方付款
  | 'refund_out' // 退款给客户
  | 'refund_in' // 客户退款给我方
  | 'prepayment_in' // 预收款(客户预付定金)
  | 'prepayment_out'; // 预付款(向客户作为供应商时预付)

/**
 * 交易明细接口
 */
export interface CustomerStatementTransaction {
  id: string;
  transactionType: CustomerStatementTransactionType;
  transactionDate: string; // ISO日期字符串
  referenceNumber: string; // 单据号
  referenceId: string; // 单据ID
  description: string; // 交易描述
  debitAmount: number; // 应收增加/应付减少金额
  creditAmount: number; // 应收减少/应付增加金额
  balance: number; // 余额(正数=客户欠款,负数=我方欠款)
  status: string; // 状态
  remarks?: string; // 备注
}

/**
 * 对账单汇总数据
 */
export interface CustomerStatementSummary {
  // 应收账款汇总
  receivables: {
    salesAmount: number; // 销售金额
    salesReturnAmount: number; // 销售退货金额
    paymentReceived: number; // 已收款
    refundPaid: number; // 已退款
    prepaymentReceived: number; // 预收款
    refundProcessed?: number; // 实际已退款金额（含退货退款）
    refundPending?: number; // 待退金额
    refundCompensation?: number; // 补偿性退款金额
    receivableBalance: number; // 应收余额 = 销售 - 退货 - 收款 - 预收 - 退款
  };

  // 应付账款汇总
  payables: {
    purchaseAmount: number; // 采购金额
    purchaseReturnAmount: number; // 采购退货金额
    paymentPaid: number; // 已付款
    refundReceived: number; // 已收退款
    prepaymentPaid: number; // 预付款
    payableBalance: number; // 应付余额 = 采购 - 退货 - 付款 - 预付 + 退款
  };

  // 净余额
  netBalance: number; // 净余额 = 应收余额 - 应付余额
}

/**
 * 客户对账单详情
 */
export interface CustomerStatementDetail {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;

  // 统计期间
  periodStart: string; // ISO日期字符串
  periodEnd: string; // ISO日期字符串

  // 期初余额
  openingBalance: number;

  // 交易明细（✅ P1修复: 支持分页）
  transactions: CustomerStatementTransaction[];

  // ✅ P1修复: 交易分页信息
  transactionsPagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // 汇总数据
  summary: CustomerStatementSummary;

  // 期末余额
  closingBalance: number;

  // 生成信息
  generatedAt: string;
  generatedBy?: string;
}

/**
 * 客户对账单列表项
 */
export interface CustomerStatementListItem {
  customerId: string;
  customerName: string;
  customerPhone?: string;

  // 最近交易日期
  lastTransactionDate?: string;

  // 汇总数据
  summary: CustomerStatementSummary;

  // 交易笔数
  transactionCount: number;
}

/**
 * 对账单查询参数
 */
export interface CustomerStatementQuery {
  // 分页参数
  page?: number;
  pageSize?: number;

  // 筛选条件
  customerId?: string; // 指定客户ID
  customerName?: string; // 客户名称搜索
  startDate?: string; // 开始日期
  endDate?: string; // 结束日期

  // 余额筛选
  minBalance?: number; // 最小余额
  maxBalance?: number; // 最大余额
  balanceType?: 'receivable' | 'payable' | 'all'; // 余额类型

  // 排序
  sortBy?:
    | 'customerName'
    | 'netBalance'
    | 'receivableBalance'
    | 'payableBalance'
    | 'lastTransactionDate';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 对账单导出参数
 */
export interface CustomerStatementExportQuery {
  customerId: string;
  startDate: string;
  endDate: string;
  format?: 'excel' | 'pdf'; // 导出格式
  includeDetails?: boolean; // 是否包含明细
}

/**
 * 对账单统计数据
 */
export interface CustomerStatementStatistics {
  // 客户总数
  totalCustomers: number;

  // 有往来的客户数
  activeCustomers: number;

  // 总应收余额
  totalReceivableBalance: number;

  // 总应付余额
  totalPayableBalance: number;

  // 总净余额
  totalNetBalance: number;

  // 总应退余额（可选，后端未实现时前端使用当前页数据回退）
  totalPendingRefundBalance?: number;

  // 总退货金额（可选）
  totalReturnAmount?: number;

  // 总已退款金额（可选）
  totalRefundPaidAmount?: number;

  // 逾期客户数
  overdueCustomers: number;

  // 本月交易客户数
  monthlyActiveCustomers: number;
}

/**
 * API响应类型
 */
export interface CustomerStatementListResponse {
  success: boolean;
  data: {
    statements: CustomerStatementListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface CustomerStatementDetailResponse {
  success: boolean;
  data: CustomerStatementDetail;
  error?: string;
}

export interface CustomerStatementStatisticsResponse {
  success: boolean;
  data: CustomerStatementStatistics;
  error?: string;
}

/**
 * 交易类型配置
 */
export interface CustomerStatementTransactionTypeConfig {
  type: CustomerStatementTransactionType;
  label: string;
  description: string;
  isDebit: boolean; // 是否为增加应收/减少应付
  category: 'receivable' | 'payable'; // 所属类别
}

/**
 * 默认交易类型配置
 */
export const CUSTOMER_STATEMENT_TRANSACTION_TYPES: CustomerStatementTransactionTypeConfig[] =
  [
    {
      type: 'sales_order',
      label: '销售订单',
      description: '客户采购产品',
      isDebit: true,
      category: 'receivable',
    },
    {
      type: 'sales_return',
      label: '销售退货',
      description: '客户退货',
      isDebit: false,
      category: 'receivable',
    },
    {
      type: 'payment_in',
      label: '收款',
      description: '客户付款',
      isDebit: false,
      category: 'receivable',
    },
    {
      type: 'refund_out',
      label: '退款',
      description: '退款给客户',
      isDebit: true,
      category: 'receivable',
    },
    {
      type: 'purchase_order',
      label: '采购订单',
      description: '向客户(供应商)采购',
      isDebit: false,
      category: 'payable',
    },
    {
      type: 'purchase_return',
      label: '采购退货',
      description: '向客户(供应商)退货',
      isDebit: true,
      category: 'payable',
    },
    {
      type: 'payment_out',
      label: '付款',
      description: '付款给客户(供应商)',
      isDebit: true,
      category: 'payable',
    },
    {
      type: 'refund_in',
      label: '收退款',
      description: '客户(供应商)退款',
      isDebit: false,
      category: 'payable',
    },
    {
      type: 'prepayment_in',
      label: '预收款',
      description: '客户预付定金',
      isDebit: false,
      category: 'receivable',
    },
    {
      type: 'prepayment_out',
      label: '预付款',
      description: '向客户(供应商)预付',
      isDebit: true,
      category: 'payable',
    },
  ];

/**
 * 工具函数类型
 */
export interface CustomerStatementUtils {
  formatTransactionType: (type: CustomerStatementTransactionType) => string;
  calculateBalance: (
    transactions: CustomerStatementTransaction[]
  ) => CustomerStatementSummary;
  getTransactionTypeConfig: (
    type: CustomerStatementTransactionType
  ) => CustomerStatementTransactionTypeConfig | undefined;
  isReceivableTransaction: (type: CustomerStatementTransactionType) => boolean;
  isPayableTransaction: (type: CustomerStatementTransactionType) => boolean;
}
