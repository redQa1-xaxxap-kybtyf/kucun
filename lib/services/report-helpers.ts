/**
 * 财务报表辅助函数
 * 提供报表计算、数据聚合等通用功能
 */

import type { Prisma } from '@prisma/client';

import type {
  ComparisonData,
  ProfitLossStatus,
  ReportAlert,
  ReportPeriod,
} from '@/lib/types/report';

// ==================== 日期处理函数 ====================

/**
 * 获取月份的日期范围
 */
export function getMonthDateRange(
  year: number,
  month: number
): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * 获取年份的日期范围
 */
export function getYearDateRange(year: number): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * 获取上个月的年份和月份
 */
export function getPreviousMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * 格式化月份标签
 */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

/**
 * 格式化季度标签
 */
export function formatQuarterLabel(quarter: number): string {
  const quarterNames = ['第一季度', '第二季度', '第三季度', '第四季度'];
  return quarterNames[quarter - 1] || `Q${quarter}`;
}

/**
 * 获取月份所属季度
 */
export function getQuarter(month: number): number {
  return Math.ceil(month / 3);
}

// ==================== 数据聚合函数 ====================

/**
 * 构建销售订单查询条件
 */
export function buildSalesOrderWhere(
  startDate: Date,
  endDate: Date,
  customerId?: string
): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = {
    status: { in: ['confirmed', 'shipped', 'completed'] },
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (customerId) {
    where.customerId = customerId;
  }

  return where;
}

/**
 * 构建费用记录查询条件
 */
export function buildExpenseWhere(
  startDate: Date,
  endDate: Date
): Prisma.ExpenseRecordWhereInput {
  return {
    expenseDate: {
      gte: startDate,
      lte: endDate,
    },
    // 费用口径说明：
    // - 仅统计直接计入当期损益的费用
    // - 排除采购订单费用（relatedType = 'purchase_order'），这些费用已通过
    //   FIFO / 采购成本分摊计入库存与销售成本，避免在利润表中重复扣减
    relatedType: {
      not: 'purchase_order',
    },
  };
}

/**
 * 构建收款记录查询条件
 */
export function buildPaymentWhere(
  startDate: Date,
  endDate: Date,
  customerId?: string
): Prisma.PaymentRecordWhereInput {
  const where: Prisma.PaymentRecordWhereInput = {
    status: 'confirmed',
    paymentDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (customerId) {
    where.customerId = customerId;
  }

  return where;
}

/**
 * 构建退款记录查询条件
 */
export function buildRefundWhere(
  startDate: Date,
  endDate: Date,
  customerId?: string
): Prisma.RefundRecordWhereInput {
  const where: Prisma.RefundRecordWhereInput = {
    status: { in: ['pending', 'processing', 'completed'] },
    refundDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (customerId) {
    where.customerId = customerId;
  }

  return where;
}

// ==================== 计算函数 ====================

/**
 * 计算环比/同比数据
 */
export function calculateComparison(
  current: number,
  previous: number
): ComparisonData {
  const change = current - previous;
  const changeRate = previous !== 0 ? (change / previous) * 100 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changeRate) < 0.01) {
    trend = 'stable';
  } else if (changeRate > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }

  return {
    current,
    previous,
    change,
    changeRate,
    trend,
  };
}

/**
 * 计算利润率
 */
export function calculateProfitMargin(profit: number, revenue: number): number {
  if (revenue === 0) {
    return 0;
  }
  return (profit / revenue) * 100;
}

/**
 * 计算成本率
 */
export function calculateCostRate(cost: number, revenue: number): number {
  if (revenue === 0) {
    return 0;
  }
  return (cost / revenue) * 100;
}

/**
 * 计算费用率
 */
export function calculateExpenseRate(expense: number, revenue: number): number {
  if (revenue === 0) {
    return 0;
  }
  return (expense / revenue) * 100;
}

/**
 * 判断盈亏状态
 */
export function determineProfitLossStatus(profit: number): ProfitLossStatus {
  if (Math.abs(profit) < 0.01) {
    return 'breakeven';
  }
  return profit > 0 ? 'profit' : 'loss';
}

// ==================== 预警函数 ====================

/**
 * 生成利润预警
 */
export function generateProfitAlerts(
  profit: number,
  profitMargin: number,
  revenue: number
): ReportAlert[] {
  const alerts: ReportAlert[] = [];

  // 亏损预警
  if (profit < 0) {
    alerts.push({
      type: 'danger',
      title: '亏损预警',
      message: `当前处于亏损状态，净利润为负值`,
      value: profit,
    });
  }

  // 低利润率预警
  if (profitMargin < 5 && profitMargin > 0) {
    alerts.push({
      type: 'warning',
      title: '低利润率预警',
      message: `利润率低于5%，建议优化成本控制`,
      value: profitMargin,
      threshold: 5,
    });
  }

  // 收入过低预警
  if (revenue < 10000) {
    alerts.push({
      type: 'warning',
      title: '收入偏低',
      message: `当前收入较低，建议加强销售推广`,
      value: revenue,
    });
  }

  return alerts;
}

/**
 * 生成费用预警
 */
export function generateExpenseAlerts(
  totalExpenses: number,
  revenue: number
): ReportAlert[] {
  const alerts: ReportAlert[] = [];
  const expenseRate = calculateExpenseRate(totalExpenses, revenue);

  // 高费用率预警
  if (expenseRate > 30) {
    alerts.push({
      type: 'warning',
      title: '费用率过高',
      message: `费用率超过30%，建议优化费用支出`,
      value: expenseRate,
      threshold: 30,
    });
  }

  return alerts;
}

// ==================== 格式化函数 ====================

/**
 * 创建报表周期对象
 */
export function createReportPeriod(
  startDate: Date,
  endDate: Date,
  label?: string
): ReportPeriod {
  return {
    type: 'custom',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label,
  };
}

/**
 * 创建月度报表周期
 */
export function createMonthlyPeriod(year: number, month: number): ReportPeriod {
  const { startDate, endDate } = getMonthDateRange(year, month);
  return {
    type: 'monthly',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label: formatMonthLabel(year, month),
  };
}

/**
 * 创建年度报表周期
 */
export function createAnnualPeriod(year: number): ReportPeriod {
  const { startDate, endDate } = getYearDateRange(year);
  return {
    type: 'annual',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label: `${year}年`,
  };
}
