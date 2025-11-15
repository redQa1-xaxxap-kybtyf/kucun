/**
 * 盈亏分析服务
 * 提供盈亏分析的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import type {
  CostDetail,
  ExpenseDetail,
  FactoryShipmentProfitDetail,
  ProfitCalculation,
  ProfitLossAnalysis,
  ProfitLossTrend,
  RevenueDetail,
} from '@/lib/types/report';
import {
  calculateTotalExpenses,
  extractExpensesByType,
} from '@/lib/utils/expense-type-helpers';

import {
  buildExpenseWhere,
  buildRefundWhere,
  buildSalesOrderWhere,
  calculateComparison,
  calculateCostRate,
  calculateExpenseRate,
  calculateProfitMargin,
  createReportPeriod,
  determineProfitLossStatus,
  generateExpenseAlerts,
  generateProfitAlerts,
} from './report-helpers';

// ==================== 数据查询函数 ====================

/**
 * 获取收入明细
 */
async function getRevenueDetail(
  startDate: Date,
  endDate: Date
): Promise<RevenueDetail> {
  const where = buildSalesOrderWhere(startDate, endDate);

  const salesStats = await prisma.salesOrder.aggregate({
    where,
    _sum: {
      totalAmount: true,
      itemsAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const salesRevenue = salesStats._sum.totalAmount || 0;
  const orderCount = salesStats._count.id || 0;

  // 暂时没有其他收入来源
  const otherRevenue = 0;
  const totalRevenue = salesRevenue + otherRevenue;

  return {
    salesRevenue,
    otherRevenue,
    totalRevenue,
    orderCount,
  };
}

/**
 * 获取成本明细
 */
async function getCostDetail(
  startDate: Date,
  endDate: Date,
  totalRevenue: number
): Promise<CostDetail> {
  const where = buildSalesOrderWhere(startDate, endDate);

  // 销售成本
  const salesCostStats = await prisma.salesOrder.aggregate({
    where,
    _sum: {
      costAmount: true,
    },
  });

  const salesCost = salesCostStats._sum.costAmount || 0;

  // 库存成本变化
  // ✅ 修复：排除期初入库（opening_balance），期初库存不应冲击当期损益
  const [inboundCost, outboundCost] = await Promise.all([
    prisma.inboundRecord.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        reason: {
          not: 'opening_balance', // ✅ 排除期初入库
        },
      },
      _sum: {
        totalCost: true,
      },
    }),
    prisma.outboundRecord.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalCost: true,
      },
    }),
  ]);

  const inventoryCost =
    (inboundCost._sum.totalCost || 0) - (outboundCost._sum.totalCost || 0);

  const totalCost = salesCost + Math.abs(inventoryCost);
  const costRate = calculateCostRate(totalCost, totalRevenue);

  return {
    salesCost,
    inventoryCost,
    totalCost,
    costRate,
  };
}

/**
 * 获取费用明细
 */
async function getExpenseDetail(
  startDate: Date,
  endDate: Date,
  totalRevenue: number
): Promise<ExpenseDetail> {
  const where = buildExpenseWhere(startDate, endDate);

  // 按类型分组查询费用
  const expensesByType = await prisma.expenseRecord.groupBy({
    by: ['expenseType'],
    where,
    _sum: {
      expenseAmount: true,
    },
  });

  // 使用工具函数提取费用类型金额
  const byType = extractExpensesByType(expensesByType);
  const totalExpenses = calculateTotalExpenses(byType);
  const expenseRate = calculateExpenseRate(totalExpenses, totalRevenue);

  return {
    ...byType,
    totalExpenses,
    expenseRate,
  };
}

/**
 * 计算利润
 */
function calculateProfit(
  revenue: RevenueDetail,
  costs: CostDetail,
  expenses: ExpenseDetail,
  refundAmount: number
): ProfitCalculation {
  const { totalRevenue } = revenue;
  const { totalCost } = costs;
  const { totalExpenses } = expenses;

  // 毛利润 = 收入 - 成本
  const grossProfit = totalRevenue - totalCost;
  const grossProfitMargin = calculateProfitMargin(grossProfit, totalRevenue);

  // 营业利润 = 毛利润 - 费用
  const operatingProfit = grossProfit - totalExpenses;
  const operatingProfitMargin = calculateProfitMargin(
    operatingProfit,
    totalRevenue
  );

  // 净利润 = 营业利润 - 退款
  const netProfit = operatingProfit - refundAmount;
  const netProfitMargin = calculateProfitMargin(netProfit, totalRevenue);

  return {
    grossProfit,
    grossProfitMargin,
    operatingProfit,
    operatingProfitMargin,
    netProfit,
    netProfitMargin,
  };
}

/**
 * 获取趋势数据
 */
async function getProfitLossTrend(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<ProfitLossTrend[]> {
  // 根据分组方式生成日期范围
  const dateRanges = generateDateRanges(startDate, endDate, groupBy);

  // 并行查询每个时间段的数据
  const trendPromises = dateRanges.map(async range => {
    const [revenue, costs, expenses] = await Promise.all([
      getRevenueDetail(range.start, range.end),
      getCostDetail(range.start, range.end, 0), // 先传0，后面会重新计算
      getExpenseDetail(range.start, range.end, 0),
    ]);

    // 重新计算成本率和费用率
    const totalRevenue = revenue.totalRevenue;
    costs.costRate = calculateCostRate(costs.totalCost, totalRevenue);
    expenses.expenseRate = calculateExpenseRate(
      expenses.totalExpenses,
      totalRevenue
    );

    const profit =
      revenue.totalRevenue - costs.totalCost - expenses.totalExpenses;

    return {
      date: range.start.toISOString().split('T')[0],
      dateLabel: range.label,
      revenue: revenue.totalRevenue,
      cost: costs.totalCost,
      expense: expenses.totalExpenses,
      profit,
    };
  });

  const results = await Promise.all(trendPromises);
  return results;
}

/**
 * 生成日期范围
 */
function generateDateRanges(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month'
): Array<{ start: Date; end: Date; label: string }> {
  const ranges: Array<{ start: Date; end: Date; label: string }> = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const rangeStart = new Date(current);
    let rangeEnd: Date;
    let label: string;

    if (groupBy === 'day') {
      rangeEnd = new Date(current);
      rangeEnd.setHours(23, 59, 59, 999);
      label = `${rangeStart.getMonth() + 1}/${rangeStart.getDate()}`;
      current.setDate(current.getDate() + 1);
    } else if (groupBy === 'week') {
      rangeEnd = new Date(current);
      rangeEnd.setDate(rangeEnd.getDate() + 6);
      rangeEnd.setHours(23, 59, 59, 999);
      if (rangeEnd > endDate) rangeEnd = new Date(endDate);
      label = `${rangeStart.getMonth() + 1}/${rangeStart.getDate()}-${rangeEnd.getMonth() + 1}/${rangeEnd.getDate()}`;
      current.setDate(current.getDate() + 7);
    } else {
      // month
      rangeEnd = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      if (rangeEnd > endDate) rangeEnd = new Date(endDate);
      label = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}`;
      current.setMonth(current.getMonth() + 1);
    }

    if (rangeStart <= endDate) {
      ranges.push({ start: rangeStart, end: rangeEnd, label });
    }
  }

  return ranges;
}

// ==================== 主服务函数 ====================

/**
 * 获取盈亏分析
 */
export async function getProfitLossAnalysis(
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day',
  includeComparison = false
): Promise<ProfitLossAnalysis> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // 获取退款金额
  const refundWhere = buildRefundWhere(start, end);
  const refundStats = await prisma.refundRecord.aggregate({
    where: refundWhere,
    _sum: {
      processedAmount: true,
    },
  });
  const refundAmount = refundStats._sum.processedAmount || 0;

  // 并行获取所有数据
  const [revenue, trend] = await Promise.all([
    getRevenueDetail(start, end),
    getProfitLossTrend(start, end, groupBy),
  ]);

  // 获取成本、费用和厂家发货利润（需要总收入）
  const [costs, expenses, factoryShipmentProfit] = await Promise.all([
    getCostDetail(start, end, revenue.totalRevenue),
    getExpenseDetail(start, end, revenue.totalRevenue),
    getFactoryShipmentProfitDetail(start, end, revenue.totalRevenue),
  ]);

  // 计算利润
  const profit = calculateProfit(revenue, costs, expenses, refundAmount);

  // 判断盈亏状态
  const status = determineProfitLossStatus(profit.netProfit);

  // 创建报表周期
  const period = createReportPeriod(start, end);

  // 生成预警
  const alerts = [
    ...generateProfitAlerts(
      profit.netProfit,
      profit.netProfitMargin,
      revenue.totalRevenue
    ),
    ...generateExpenseAlerts(expenses.totalExpenses, revenue.totalRevenue),
  ];

  // 构建基础分析
  const analysis: ProfitLossAnalysis = {
    period,
    status,
    revenue,
    costs,
    expenses,
    profit,
    factoryShipmentProfit,
    trend,
    alerts,
  };

  // 如果需要对比数据（对比上一个相同时间段）
  if (includeComparison) {
    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - daysDiff);

    const [prevRevenue, prevCosts, prevExpenses] = await Promise.all([
      getRevenueDetail(prevStart, prevEnd),
      getCostDetail(prevStart, prevEnd, 0),
      getExpenseDetail(prevStart, prevEnd, 0),
    ]);

    const prevProfit = calculateProfit(prevRevenue, prevCosts, prevExpenses, 0);

    analysis.comparison = {
      revenue: calculateComparison(
        revenue.totalRevenue,
        prevRevenue.totalRevenue
      ),
      profit: calculateComparison(profit.netProfit, prevProfit.netProfit),
    };
  }

  return analysis;
}

// ==================== 厂家发货利润统计 ====================

/**
 * 获取厂家发货利润明细
 *
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @param totalRevenue - 总收入（用于计算占比）
 * @returns 厂家发货利润明细
 */
async function getFactoryShipmentProfitDetail(
  startDate: Date,
  endDate: Date,
  totalRevenue: number
): Promise<FactoryShipmentProfitDetail> {
  // 查询指定时间段的所有已完成厂家发货订单
  const orders = await prisma.factoryShipmentOrder.findMany({
    where: {
      shipmentDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ['arrived', 'completed'],
      },
    },
    select: {
      id: true,
      totalAmount: true,
      receivableAmount: true,
      customerProfit: true,
      selfCostAmount: true,
      expenseAmount: true,
      profitAmount: true,
    },
  });

  // 统计数据
  const customerProfit = orders.reduce(
    (sum, o) => sum + (o.customerProfit || 0),
    0
  );
  const selfCostAmount = orders.reduce(
    (sum, o) => sum + (o.selfCostAmount || 0),
    0
  );
  const totalExpenses = orders.reduce(
    (sum, o) => sum + (o.expenseAmount || 0),
    0
  );
  const factoryRevenue = orders.reduce(
    (sum, o) => sum + (o.receivableAmount || 0),
    0
  );

  // 计算利润率
  const profitMargin =
    factoryRevenue > 0
      ? roundToTwoDecimals((customerProfit / factoryRevenue) * 100)
      : 0;

  // 计算占总利润的比例
  const percentageOfTotal =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  return {
    customerProfit: roundToTwoDecimals(customerProfit),
    selfCostAmount: roundToTwoDecimals(selfCostAmount),
    totalExpenses: roundToTwoDecimals(totalExpenses),
    profitMargin,
    percentageOfTotal,
  };
}
