/**
 * 年度报表服务
 * 提供年度财务报表的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import type {
  AnnualFactoryShipmentProfit,
  AnnualReport,
  AnnualSummary,
  ExpenseDistribution,
  MonthlyTrendData,
  QuarterlyData,
} from '@/lib/types/report';
import { getExpenseTypeName } from '@/lib/utils/expense-type-helpers';

import {
  buildExpenseWhere,
  buildSalesOrderWhere,
  calculateComparison,
  calculateProfitMargin,
  createAnnualPeriod,
  formatQuarterLabel,
  generateExpenseAlerts,
  generateProfitAlerts,
  getMonthDateRange,
  getYearDateRange,
} from './report-helpers';

// ==================== 数据查询函数 ====================

/**
 * 获取年度汇总数据
 */
async function getAnnualSummary(year: number): Promise<AnnualSummary> {
  const { startDate, endDate } = getYearDateRange(year);
  const salesWhere = buildSalesOrderWhere(startDate, endDate);
  const expenseWhere = buildExpenseWhere(startDate, endDate);

  // 聚合年度数据
  const [salesStats, expenseStats] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: salesWhere,
      _sum: {
        totalAmount: true,
        costAmount: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.expenseRecord.aggregate({
      where: expenseWhere,
      _sum: {
        expenseAmount: true,
      },
    }),
  ]);

  const totalRevenue = salesStats._sum.totalAmount || 0;
  const totalCost = salesStats._sum.costAmount || 0;
  const totalExpenses = expenseStats._sum.expenseAmount || 0;
  const orderCount = salesStats._count.id || 0;

  // 计算利润
  const grossProfit = totalRevenue - totalCost;
  const totalProfit = grossProfit - totalExpenses;
  const profitMargin = calculateProfitMargin(totalProfit, totalRevenue);

  // 月均收入
  const averageMonthlyRevenue = totalRevenue / 12;

  return {
    totalRevenue,
    totalExpenses,
    totalCost,
    totalProfit,
    profitMargin,
    orderCount,
    averageMonthlyRevenue,
  };
}

/**
 * 获取月度趋势数据
 */
async function getMonthlyTrend(year: number): Promise<MonthlyTrendData[]> {
  const monthlyData: MonthlyTrendData[] = [];

  // 并行查询12个月的数据
  const monthPromises = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return getMonthData(year, month);
  });

  const results = await Promise.all(monthPromises);

  results.forEach((data, index) => {
    const month = index + 1;
    monthlyData.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      monthLabel: `${month}月`,
      ...data,
    });
  });

  return monthlyData;
}

/**
 * 获取单个月份的数据
 */
async function getMonthData(
  year: number,
  month: number
): Promise<{
  revenue: number;
  expenses: number;
  cost: number;
  profit: number;
  orderCount: number;
}> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const salesWhere = buildSalesOrderWhere(startDate, endDate);
  const expenseWhere = buildExpenseWhere(startDate, endDate);

  const [salesStats, expenseStats] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: salesWhere,
      _sum: {
        totalAmount: true,
        costAmount: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.expenseRecord.aggregate({
      where: expenseWhere,
      _sum: {
        expenseAmount: true,
      },
    }),
  ]);

  const revenue = salesStats._sum.totalAmount || 0;
  const cost = salesStats._sum.costAmount || 0;
  const expenses = expenseStats._sum.expenseAmount || 0;
  const orderCount = salesStats._count.id || 0;

  const grossProfit = revenue - cost;
  const profit = grossProfit - expenses;

  return {
    revenue,
    expenses,
    cost,
    profit,
    orderCount,
  };
}

/**
 * 获取季度数据
 */
async function getQuarterlyData(year: number): Promise<QuarterlyData[]> {
  const quarterlyData: QuarterlyData[] = [];

  // 计算4个季度的数据
  for (let quarter = 1; quarter <= 4; quarter++) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    let quarterRevenue = 0;
    let quarterExpenses = 0;
    let quarterCost = 0;

    // 聚合季度内3个月的数据
    for (let month = startMonth; month <= endMonth; month++) {
      const monthData = await getMonthData(year, month);
      quarterRevenue += monthData.revenue;
      quarterExpenses += monthData.expenses;
      quarterCost += monthData.cost;
    }

    const quarterProfit = quarterRevenue - quarterCost - quarterExpenses;
    const profitMargin = calculateProfitMargin(quarterProfit, quarterRevenue);

    quarterlyData.push({
      quarter: `Q${quarter}`,
      quarterLabel: formatQuarterLabel(quarter),
      revenue: quarterRevenue,
      expenses: quarterExpenses,
      cost: quarterCost,
      profit: quarterProfit,
      profitMargin,
    });
  }

  return quarterlyData;
}

/**
 * 获取费用分布数据
 */
async function getExpenseDistribution(
  year: number
): Promise<ExpenseDistribution[]> {
  const { startDate, endDate } = getYearDateRange(year);
  const where = buildExpenseWhere(startDate, endDate);

  // 按费用类型分组
  const expensesByType = await prisma.expenseRecord.groupBy({
    by: ['expenseType'],
    where,
    _sum: {
      expenseAmount: true,
    },
    _count: {
      id: true,
    },
  });

  // 计算总费用
  const totalExpenses = expensesByType.reduce(
    (sum, item) => sum + (item._sum.expenseAmount || 0),
    0
  );

  // 构建分布数据（使用工具函数获取费用类型名称）
  const distribution: ExpenseDistribution[] = expensesByType.map(item => {
    const amount = item._sum.expenseAmount || 0;
    const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

    return {
      type: item.expenseType,
      typeName: getExpenseTypeName(item.expenseType as never),
      amount,
      percentage,
      count: item._count.id,
    };
  });

  // 按金额降序排序
  return distribution.sort((a, b) => b.amount - a.amount);
}

// ==================== 主服务函数 ====================

/**
 * 获取年度报表
 */
export async function getAnnualReport(
  year: number,
  includeYearOverYear = true
): Promise<AnnualReport> {
  // 并行获取所有数据
  const [
    summary,
    monthlyTrend,
    quarterlyData,
    expenseDistribution,
    factoryShipmentProfit,
  ] = await Promise.all([
    getAnnualSummary(year),
    getMonthlyTrend(year),
    getQuarterlyData(year),
    getExpenseDistribution(year),
    getAnnualFactoryShipmentProfit(year),
  ]);

  // 创建报表周期
  const period = createAnnualPeriod(year);

  // 生成预警
  const alerts = [
    ...generateProfitAlerts(
      summary.totalProfit,
      summary.profitMargin,
      summary.totalRevenue
    ),
    ...generateExpenseAlerts(summary.totalExpenses, summary.totalRevenue),
  ];

  // 构建基础报表
  const report: AnnualReport = {
    year,
    period,
    summary,
    monthlyTrend,
    quarterlyData,
    expenseDistribution,
    factoryShipmentProfit,
    alerts,
  };

  // 如果需要同比数据
  if (includeYearOverYear) {
    const prevYear = year - 1;
    const prevSummary = await getAnnualSummary(prevYear);

    report.yearOverYear = {
      revenue: calculateComparison(
        summary.totalRevenue,
        prevSummary.totalRevenue
      ),
      profit: calculateComparison(summary.totalProfit, prevSummary.totalProfit),
      expenses: calculateComparison(
        summary.totalExpenses,
        prevSummary.totalExpenses
      ),
    };
  }

  return report;
}

// ==================== 厂家发货利润统计 ====================

/**
 * 获取年度厂家发货利润统计
 *
 * @param year - 年份
 * @returns 年度厂家发货利润统计数据
 */
export async function getAnnualFactoryShipmentProfit(
  year: number
): Promise<AnnualFactoryShipmentProfit> {
  const { startDate, endDate } = getYearDateRange(year);

  // 查询指定年份的所有已完成厂家发货订单
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
      shipmentDate: true,
      totalAmount: true,
      receivableAmount: true,
      customerProfit: true,
      selfCostAmount: true,
      expenseAmount: true,
      profitAmount: true,
    },
  });

  // 统计年度总数据
  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.receivableAmount || 0),
    0
  );
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

  // 计算平均利润率
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  // 按月份统计数据
  const monthlyData: Array<{
    month: number;
    orders: number;
    profit: number;
    profitMargin: number;
  }> = [];

  for (let month = 1; month <= 12; month++) {
    const monthOrders = orders.filter(o => {
      const orderMonth = o.shipmentDate ? o.shipmentDate.getMonth() + 1 : 0;
      return orderMonth === month;
    });

    const monthProfit = monthOrders.reduce(
      (sum, o) => sum + (o.customerProfit || 0),
      0
    );
    const monthRevenue = monthOrders.reduce(
      (sum, o) => sum + (o.receivableAmount || 0),
      0
    );
    const monthProfitMargin =
      monthRevenue > 0
        ? roundToTwoDecimals((monthProfit / monthRevenue) * 100)
        : 0;

    monthlyData.push({
      month,
      orders: monthOrders.length,
      profit: roundToTwoDecimals(monthProfit),
      profitMargin: monthProfitMargin,
    });
  }

  return {
    totalOrders,
    totalAmount: roundToTwoDecimals(totalAmount),
    totalRevenue: roundToTwoDecimals(totalRevenue),
    customerProfit: roundToTwoDecimals(customerProfit),
    selfCostAmount: roundToTwoDecimals(selfCostAmount),
    totalExpenses: roundToTwoDecimals(totalExpenses),
    averageProfitMargin,
    monthlyData,
  };
}
