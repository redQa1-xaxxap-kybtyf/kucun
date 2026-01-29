/**
 * 财务报表基础类型定义
 * 包含月度报表、年度报表、盈亏分析的通用类型
 */

// ==================== 通用类型 ====================

/**
 * 报表时间周期类型
 */
export type ReportPeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

/**
 * 报表时间周期
 */
export interface ReportPeriod {
  type: ReportPeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label?: string; // 显示标签，如 "2024年1月" 或 "2024年Q1"
}

/**
 * 环比/同比数据
 */
export interface ComparisonData {
  current: number; // 当前值
  previous: number; // 上期值
  change: number; // 变化值
  changeRate: number; // 变化率 (%)
  trend: 'up' | 'down' | 'stable'; // 趋势
}

/**
 * 趋势数据点
 */
export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // 显示标签
  value: number; // 数值
}

/**
 * 预警信息
 */
export interface ReportAlert {
  type: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  value?: number;
  threshold?: number;
}

// ==================== 月度报表类型 ====================

/**
 * 月度收入数据
 */
export interface MonthlyRevenue {
  salesRevenue: number; // 销售收入
  orderCount: number; // 订单数量
  averageOrderValue: number; // 平均订单金额
  completedOrders: number; // 已完成订单数
  pendingOrders: number; // 待处理订单数
}

/**
 * 月度支出数据
 */
export interface MonthlyExpenses {
  totalExpenses: number; // 总费用
  byType: {
    shipping: number; // 运费
    storage: number; // 仓储费
    labor: number; // 人工费
    travel: number; // 差旅费
    living: number; // 生活费
    loading_unloading: number; // 装卸费
    other: number; // 其他费用
  };
  expenseCount: number; // 费用记录数
}

/**
 * 月度成本数据
 */
export interface MonthlyCosts {
  salesCost: number; // 销售成本
  inventoryCostChange: number; // 库存成本变化
  totalCost: number; // 总成本
}

/**
 * 月度应收应付数据
 */
export interface MonthlyReceivables {
  totalReceivable: number; // 应收款总额
  totalPayable: number; // 应付款总额
  receivedAmount: number; // 实收金额
  paidAmount: number; // 实付金额
  receivableBalance: number; // 应收余额
  payableBalance: number; // 应付余额
}

/**
 * 月度利润数据
 */
export interface MonthlyProfit {
  grossProfit: number; // 毛利润
  operatingProfit: number; // 营业利润
  netProfit: number; // 净利润
  profitMargin: number; // 利润率 (%)
  grossProfitMargin: number; // 毛利率 (%)
}

/**
 * 月度厂家发货利润数据
 */
export interface MonthlyFactoryShipmentProfit {
  totalOrders: number; // 订单总数
  totalAmount: number; // 订单总金额
  totalRevenue: number; // 总收入（应收金额）
  customerProfit: number; // 客户货总利润
  selfCostAmount: number; // 自有货总成本
  totalExpenses: number; // 总费用
  averageProfitMargin: number; // 平均利润率（%）
}

/**
 * 库存周转率数据
 */
export interface InventoryTurnover {
  turnoverRate: number; // 周转率（次）
  turnoverDays: number; // 周转天数
  averageInventoryValue: number; // 平均库存价值
  salesCost: number; // 销售成本
  beginningInventory: number; // 期初库存
  endingInventory: number; // 期末库存
}

/**
 * 月度报表完整数据
 */
export interface MonthlyReport {
  period: ReportPeriod; // 报表周期
  revenue: MonthlyRevenue; // 收入数据
  expenses: MonthlyExpenses; // 支出数据
  costs: MonthlyCosts; // 成本数据
  receivables: MonthlyReceivables; // 应收应付数据
  profit: MonthlyProfit; // 利润数据
  factoryShipmentProfit: MonthlyFactoryShipmentProfit; // 厂家发货利润数据
  inventoryTurnover?: InventoryTurnover; // 库存周转率数据
  comparison?: {
    revenue: ComparisonData; // 收入环比
    profit: ComparisonData; // 利润环比
    expenses: ComparisonData; // 支出环比
  };
  alerts?: ReportAlert[]; // 预警信息
}

// ==================== 年度报表类型 ====================

/**
 * 年度汇总数据
 */
export interface AnnualSummary {
  totalRevenue: number; // 总收入
  totalExpenses: number; // 总支出
  totalCost: number; // 总成本
  totalProfit: number; // 总利润
  profitMargin: number; // 利润率 (%)
  orderCount: number; // 订单总数
  averageMonthlyRevenue: number; // 月均收入
}

/**
 * 月度趋势数据
 */
export interface MonthlyTrendData {
  month: string; // YYYY-MM
  monthLabel: string; // 显示标签，如 "1月"
  revenue: number; // 收入
  expenses: number; // 支出
  cost: number; // 成本
  profit: number; // 利润
  orderCount: number; // 订单数
}

/**
 * 季度数据
 */
export interface QuarterlyData {
  quarter: string; // Q1, Q2, Q3, Q4
  quarterLabel: string; // 显示标签，如 "第一季度"
  revenue: number; // 收入
  expenses: number; // 支出
  cost: number; // 成本
  profit: number; // 利润
  profitMargin: number; // 利润率 (%)
}

/**
 * 费用类型分布
 */
export interface ExpenseDistribution {
  type: string; // 费用类型
  typeName: string; // 类型名称
  amount: number; // 金额
  percentage: number; // 占比 (%)
  count: number; // 记录数
}

/**
 * 年度厂家发货利润数据
 */
export interface AnnualFactoryShipmentProfit {
  totalOrders: number; // 订单总数
  totalAmount: number; // 订单总金额
  totalRevenue: number; // 总收入（应收金额）
  customerProfit: number; // 客户货总利润
  selfCostAmount: number; // 自有货总成本
  totalExpenses: number; // 总费用
  averageProfitMargin: number; // 平均利润率（%）
  monthlyData: Array<{
    month: number; // 月份（1-12）
    orders: number; // 订单数
    profit: number; // 利润
    profitMargin: number; // 利润率（%）
  }>;
}

/**
 * 年度报表完整数据
 */
export interface AnnualReport {
  year: number; // 年份
  period: ReportPeriod; // 报表周期
  summary: AnnualSummary; // 年度汇总
  monthlyTrend: MonthlyTrendData[]; // 月度趋势 (12个月)
  quarterlyData: QuarterlyData[]; // 季度数据 (4个季度)
  expenseDistribution: ExpenseDistribution[]; // 费用分布
  factoryShipmentProfit: AnnualFactoryShipmentProfit; // 厂家发货利润数据
  inventoryTurnover?: InventoryTurnover; // 库存周转率数据
  yearOverYear?: {
    revenue: ComparisonData; // 收入同比
    profit: ComparisonData; // 利润同比
    expenses: ComparisonData; // 支出同比
  };
  alerts?: ReportAlert[]; // 预警信息
}

// ==================== 盈亏分析类型 ====================

/**
 * 盈亏状态
 */
export type ProfitLossStatus = 'profit' | 'loss' | 'breakeven';

/**
 * 收入明细
 */
export interface RevenueDetail {
  salesRevenue: number; // 销售订单收入
  factoryShipmentRevenue: number; // 厂家直发收入
  otherRevenue: number; // 其他收入
  totalRevenue: number; // 总收入
  orderCount: number; // 订单数量
}

/**
 * 成本明细
 */
export interface CostDetail {
  salesCost: number; // 销售成本
  inventoryCost: number; // 库存成本
  totalCost: number; // 总成本
  costRate: number; // 成本率 (%)
}

/**
 * 费用明细
 */
export interface ExpenseDetail {
  shipping: number; // 运费
  storage: number; // 仓储费
  labor: number; // 人工费
  travel: number; // 差旅费
  living: number; // 生活费
  loading_unloading: number; // 装卸费
  other: number; // 其他费用
  totalExpenses: number; // 总费用
  expenseRate: number; // 费用率 (%)
}

/**
 * 利润计算
 */
export interface ProfitCalculation {
  grossProfit: number; // 毛利润 = 收入 - 成本
  grossProfitMargin: number; // 毛利率 (%)
  operatingProfit: number; // 营业利润 = 毛利润 - 费用
  operatingProfitMargin: number; // 营业利润率 (%)
  netProfit: number; // 净利润 = 营业利润 - 退款等
  netProfitMargin: number; // 净利率 (%)
}

/**
 * 厂家发货利润明细（用于盈亏分析）
 */
export interface FactoryShipmentProfitDetail {
  customerProfit: number; // 客户货利润
  selfCostAmount: number; // 自有货成本
  totalExpenses: number; // 总费用
  profitMargin: number; // 利润率（%）
  percentageOfTotal: number; // 占总利润比例（%）
}

/**
 * 盈亏趋势数据
 */
export interface ProfitLossTrend {
  date: string; // YYYY-MM-DD
  dateLabel: string; // 显示标签
  revenue: number; // 收入
  cost: number; // 成本
  expense: number; // 费用
  profit: number; // 利润
}

/**
 * 盈亏分析完整数据
 */
export interface ProfitLossAnalysis {
  period: ReportPeriod; // 分析周期
  status: ProfitLossStatus; // 盈亏状态
  revenue: RevenueDetail; // 收入明细
  costs: CostDetail; // 成本明细
  expenses: ExpenseDetail; // 费用明细
  profit: ProfitCalculation; // 利润计算
  factoryShipmentProfit: FactoryShipmentProfitDetail; // 厂家发货利润明细
  trend: ProfitLossTrend[]; // 趋势数据
  adjustments: {
    returnAmountTotal: number; // 退货金额合计（冲减收入）
    returnCostReversalTotal: number; // 退货成本回冲合计（减少 COGS）
    compensationRefundTotal: number; // 补偿退款合计（计入费用/冲减利润）
  };
  comparison?: {
    revenue: ComparisonData; // 收入对比
    profit: ComparisonData; // 利润对比
  };
  alerts?: ReportAlert[]; // 预警信息
}

// ==================== 查询参数类型 ====================

/**
 * 月度报表查询参数
 */
export interface MonthlyReportParams {
  year: number; // 年份
  month: number; // 月份 (1-12)
  includeComparison?: boolean; // 是否包含环比数据
}

/**
 * 年度报表查询参数
 */
export interface AnnualReportParams {
  year: number; // 年份
  includeYearOverYear?: boolean; // 是否包含同比数据
}

/**
 * 盈亏分析查询参数
 */
export interface ProfitLossParams {
  startDate: string; // 开始日期 YYYY-MM-DD
  endDate: string; // 结束日期 YYYY-MM-DD
  groupBy?: 'day' | 'week' | 'month'; // 趋势数据分组方式
  includeComparison?: boolean; // 是否包含对比数据
}

// ==================== API 响应类型 ====================

/**
 * 报表 API 响应基础类型
 */
export interface ReportResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 月度报表响应
 */
export type MonthlyReportResponse = ReportResponse<MonthlyReport>;

/**
 * 年度报表响应
 */
export type AnnualReportResponse = ReportResponse<AnnualReport>;

/**
 * 盈亏分析响应
 */
export type ProfitLossResponse = ReportResponse<ProfitLossAnalysis>;
