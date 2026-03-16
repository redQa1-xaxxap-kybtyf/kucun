/**
 * 年度报表服务
 * 提供年度财务报表的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import { getSystemMode } from '@/lib/services/system-mode-service';
import type {
  AnnualFactoryShipmentProfit,
  AnnualReport,
  AnnualSummary,
  ExpenseDistribution,
  InventoryTurnover,
  MonthlyTrendData,
  QuarterlyData,
} from '@/lib/types/report';
import {
  getExpenseTypeName,
  isValidExpenseType,
} from '@/lib/utils/expense-type-helpers';
import { toNumber } from '@/lib/utils/number';

import { getReportAdjustments } from './report-adjustment-service';
import {
  applyReportVisibility,
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
  type ReportVisibility,
} from './report-helpers';
import { getAnnualSampleMetrics } from './report-sample-helpers';

const REPORT_QUERY_BATCH_SIZE = 1000;

type FactoryShipmentPeriodStats = {
  totalOrders: number;
  totalRevenue: number;
  customerProfit: number;
  selfCostAmount: number;
  totalExpenses: number;
};

// ==================== 数据查询函数 ====================

/**
 * 获取年度汇总数据(仅仓库销售部分)
 *
 * 注意:
 * - 这里只统计 SalesOrder + 全部费用, 不包含厂家直发收入/成本
 * - 厂家直发部分在 getAnnualFactoryShipmentProfit 中单独统计,
 *   并在 getAnnualReport 中统一合并, 保持与盈亏分析一致
 */
async function getAnnualSummary(
  year: number,
  visibility: ReportVisibility
): Promise<AnnualSummary> {
  const { startDate, endDate } = getYearDateRange(year);
  const salesWhere = applyReportVisibility(
    buildSalesOrderWhere(startDate, endDate),
    visibility
  );
  const expenseWhere = applyReportVisibility(
    buildExpenseWhere(startDate, endDate),
    visibility
  );

  // 聚合年度数据(仅销售订单收入/成本 + 全部费用)
  const [salesStats, expenseStats, adjustments] = await Promise.all([
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
    getReportAdjustments(startDate, endDate, visibility),
  ]);

  const totalRevenue = normalizeAnnualMetric(
    toNumber(salesStats._sum.totalAmount) - adjustments.returnAmountTotal
  );
  const totalCost = normalizeAnnualMetric(
    toNumber(salesStats._sum.costAmount) - adjustments.returnCostReversalTotal
  );
  const totalExpenses = normalizeAnnualMetric(
    toNumber(expenseStats._sum.expenseAmount)
  );
  const orderCount = salesStats._count.id || 0;

  // 计算利润
  const grossProfit = normalizeAnnualMetric(totalRevenue - totalCost);
  const totalProfit = normalizeAnnualMetric(
    grossProfit - totalExpenses - adjustments.compensationRefundTotal
  );
  const profitMargin = calculateProfitMargin(totalProfit, totalRevenue);

  // 月均收入
  const averageMonthlyRevenue = normalizeAnnualMetric(totalRevenue / 12);

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
 * 将厂家直发年度利润合并到年度汇总中
 *
 * 逻辑与盈亏分析一致:
 * - annualSummary.totalExpenses 已包含厂家费用
 * - AnnualFactoryShipmentProfit 中:
 *   - customerProfit = 收入 - 成本 - 厂家费用
 *   - totalExpenses = 厂家费用
 * - 合并时通过 + customerProfit + totalExpenses 将厂家部分还原为「收入-成本」,
 *   避免在费用口径上重复扣减厂家费用。
 */
function mergeAnnualSummaryWithFactoryShipment(
  summary: AnnualSummary,
  factory: AnnualFactoryShipmentProfit
): AnnualSummary {
  const factoryRevenue = factory.totalRevenue || 0;
  const factoryCost = factory.selfCostAmount || 0;
  const factoryExpenses = factory.totalExpenses || 0;
  const factoryNetProfit = factory.customerProfit || 0;

  // 合并后的总收入 = 仓库销售 + 厂家直发应收
  const totalRevenue = summary.totalRevenue + factoryRevenue;

  // 合并后的总成本 = 仓库销售成本 + 厂家直发成本
  const totalCost = summary.totalCost + factoryCost;

  // 费用总额保持不变(已包含厂家费用)
  const totalExpenses = summary.totalExpenses;

  // 合并后的总利润 = 原利润 + (厂家收入 - 厂家成本)
  // = 原利润 + customerProfit + totalExpenses(factory)
  const totalProfit = summary.totalProfit + factoryNetProfit + factoryExpenses;

  const profitMargin = calculateProfitMargin(totalProfit, totalRevenue);
  const averageMonthlyRevenue = totalRevenue / 12;

  return {
    totalRevenue,
    totalExpenses,
    totalCost,
    totalProfit,
    profitMargin,
    orderCount: summary.orderCount + factory.totalOrders,
    averageMonthlyRevenue,
  };
}

function normalizeAnnualMetric(value: number): number {
  return roundToTwoDecimals(value);
}

async function getFactoryShipmentPeriodStats(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<FactoryShipmentPeriodStats> {
  let totalOrders = 0;
  let totalRevenue = 0;
  let customerProfit = 0;
  let selfCostAmount = 0;
  let totalExpenses = 0;

  let orderCursor: string | undefined;
  while (true) {
    const where = applyReportVisibility(
      {
        shipmentDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['arrived', 'completed'],
        },
      } as any,
      visibility
    );

    const batch = await prisma.factoryShipmentOrder.findMany({
      where,
      select: {
        id: true,
        receivableAmount: true,
        customerProfit: true,
        selfCostAmount: true,
        expenseAmount: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: REPORT_QUERY_BATCH_SIZE,
      ...(orderCursor ? { cursor: { id: orderCursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    totalOrders += batch.length;

    for (const order of batch) {
      totalRevenue += toNumber(order.receivableAmount);
      customerProfit += toNumber(order.customerProfit);
      selfCostAmount += toNumber(order.selfCostAmount);
      totalExpenses += toNumber(order.expenseAmount);
    }

    orderCursor = batch[batch.length - 1].id;
  }

  return {
    totalOrders,
    totalRevenue,
    customerProfit,
    selfCostAmount,
    totalExpenses,
  };
}

/**
 * 获取月度趋势数据
 */
async function getMonthlyTrend(
  year: number,
  visibility: ReportVisibility
): Promise<MonthlyTrendData[]> {
  const monthlyData: MonthlyTrendData[] = [];

  // 并行查询12个月的数据
  const monthPromises = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return getMonthData(year, month, visibility);
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
  month: number,
  visibility: ReportVisibility
): Promise<{
  revenue: number;
  expenses: number;
  cost: number;
  profit: number;
  orderCount: number;
}> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const salesWhere = applyReportVisibility(
    buildSalesOrderWhere(startDate, endDate),
    visibility
  );
  const expenseWhere = applyReportVisibility(
    buildExpenseWhere(startDate, endDate),
    visibility
  );

  const [salesStats, expenseStats, factoryShipmentStats, adjustments] =
    await Promise.all([
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
    getFactoryShipmentPeriodStats(startDate, endDate, visibility),
    getReportAdjustments(startDate, endDate, visibility),
  ]);

  const warehouseRevenue = normalizeAnnualMetric(
    toNumber(salesStats._sum.totalAmount) - adjustments.returnAmountTotal
  );
  const warehouseCost = normalizeAnnualMetric(
    toNumber(salesStats._sum.costAmount) - adjustments.returnCostReversalTotal
  );
  const expenses = toNumber(expenseStats._sum.expenseAmount);
  const revenue = normalizeAnnualMetric(
    warehouseRevenue + factoryShipmentStats.totalRevenue
  );
  const cost = normalizeAnnualMetric(
    warehouseCost + factoryShipmentStats.selfCostAmount
  );
  const orderCount =
    (salesStats._count.id || 0) + factoryShipmentStats.totalOrders;

  // 与年度汇总保持一致：费用维度只按已审核 ExpenseRecord 口径统计，
  // 厂家直发收入/成本单独并入趋势与季度图表，避免顶部汇总和图表口径不一致。
  const profit = normalizeAnnualMetric(
    revenue - cost - expenses - adjustments.compensationRefundTotal
  );

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
async function getQuarterlyData(
  year: number,
  visibility: ReportVisibility
): Promise<QuarterlyData[]> {
  const quarterlyData: QuarterlyData[] = [];

  // 计算4个季度的数据
  for (let quarter = 1; quarter <= 4; quarter++) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    let quarterRevenue = 0;
    let quarterExpenses = 0;
    let quarterCost = 0;
    let quarterProfit = 0;

    // 聚合季度内3个月的数据
    for (let month = startMonth; month <= endMonth; month++) {
      const monthData = await getMonthData(year, month, visibility);
      quarterRevenue += monthData.revenue;
      quarterExpenses += monthData.expenses;
      quarterCost += monthData.cost;
      quarterProfit += monthData.profit;
    }

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
  year: number,
  visibility: ReportVisibility
): Promise<ExpenseDistribution[]> {
  const { startDate, endDate } = getYearDateRange(year);
  const where = applyReportVisibility(
    buildExpenseWhere(startDate, endDate),
    visibility
  );

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
    (sum, item) => sum + toNumber(item._sum.expenseAmount),
    0
  );

  // 构建分布数据（使用工具函数获取费用类型名称）
  const distribution: ExpenseDistribution[] = expensesByType.map(item => {
    const amount = toNumber(item._sum.expenseAmount);
    const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

    const expenseType = isValidExpenseType(item.expenseType)
      ? item.expenseType
      : 'other';

    return {
      type: expenseType,
      typeName: getExpenseTypeName(expenseType),
      amount,
      percentage,
      count: item._count.id,
    };
  });

  // 按金额降序排序
  return distribution.sort((a, b) => b.amount - a.amount);
}

/**
 * 获取年度库存周转率数据
 */
async function getAnnualInventoryTurnover(
  year: number,
  salesCost: number
): Promise<InventoryTurnover> {
  const { startDate, endDate } = getYearDateRange(year);

  // 获取期末库存价值（当前库存）
  let endingValue = 0;
  let inventoryCursor: string | undefined;

  while (true) {
    const batch = await prisma.inventory.findMany({
      where: {
        quantity: {
          gt: 0,
        },
      },
      select: {
        id: true,
        quantity: true,
        unitCost: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: REPORT_QUERY_BATCH_SIZE,
      ...(inventoryCursor ? { cursor: { id: inventoryCursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    for (const inv of batch) {
      endingValue += inv.quantity * toNumber(inv.unitCost);
    }

    inventoryCursor = batch[batch.length - 1].id;
  }

  // 计算期初库存价值
  // 期初库存 = 期末库存 - 本年入库 + 本年出库
  const [inboundStats, outboundStats] = await Promise.all([
    prisma.inboundRecord.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        // 排除期初入库
        reason: {
          not: 'opening_balance',
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

  const inboundCost = toNumber(inboundStats._sum.totalCost);
  const outboundCost = toNumber(outboundStats._sum.totalCost);

  // 期初库存 = 期末库存 - 入库成本 + 出库成本
  const beginningValue = endingValue - inboundCost + outboundCost;

  // 计算平均库存价值
  const averageInventoryValue = (beginningValue + endingValue) / 2;

  // 计算周转率 = 销售成本 / 平均库存价值
  const turnoverRate =
    averageInventoryValue > 0 ? salesCost / averageInventoryValue : 0;

  // 计算周转天数 = 365 / 周转率（年度报表用365天）
  const turnoverDays = turnoverRate > 0 ? 365 / turnoverRate : 0;

  return {
    turnoverRate: roundToTwoDecimals(turnoverRate),
    turnoverDays: roundToTwoDecimals(turnoverDays),
    averageInventoryValue: roundToTwoDecimals(averageInventoryValue),
    salesCost: roundToTwoDecimals(salesCost),
    beginningInventory: roundToTwoDecimals(beginningValue),
    endingInventory: roundToTwoDecimals(endingValue),
  };
}

// ==================== 主服务函数 ====================

/**
 * 获取年度报表
 */
export async function getAnnualReport(
  year: number,
  includeYearOverYear = true
): Promise<AnnualReport> {
  const visibility: ReportVisibility = { systemMode: await getSystemMode() };
  const { startDate, endDate } = getYearDateRange(year);

  // 并行获取所有数据
  const [
    summary,
    sample,
    monthlyTrend,
    quarterlyData,
    expenseDistribution,
    factoryShipmentProfit,
  ] = await Promise.all([
    getAnnualSummary(year, visibility),
    getAnnualSampleMetrics(startDate, endDate, visibility),
    getMonthlyTrend(year, visibility),
    getQuarterlyData(year, visibility),
    getExpenseDistribution(year, visibility),
    getAnnualFactoryShipmentProfit(year, visibility),
  ]);

  // 合并仓库销售 + 厂家直发后的年度汇总(用于报表 summary 展示)
  const combinedSummary = mergeAnnualSummaryWithFactoryShipment(
    summary,
    factoryShipmentProfit
  );

  // 计算库存周转率(只基于仓库销售成本, 厂家直发不占用库存)
  const inventoryTurnover = await getAnnualInventoryTurnover(
    year,
    summary.totalCost
  );

  // 创建报表周期
  const period = createAnnualPeriod(year);

  // 生成预警
  const alerts = [
    ...generateProfitAlerts(
      combinedSummary.totalProfit,
      combinedSummary.profitMargin,
      combinedSummary.totalRevenue
    ),
    ...generateExpenseAlerts(
      combinedSummary.totalExpenses,
      combinedSummary.totalRevenue
    ),
  ];

  // 构建基础报表
  const report: AnnualReport = {
    year,
    period,
    summary: combinedSummary,
    sample,
    monthlyTrend,
    quarterlyData,
    expenseDistribution,
    factoryShipmentProfit,
    inventoryTurnover,
    alerts,
  };

  // 如果需要同比数据
  if (includeYearOverYear) {
    const prevYear = year - 1;
    const [prevSummaryCore, prevFactoryShipment] = await Promise.all([
      getAnnualSummary(prevYear, visibility),
      getAnnualFactoryShipmentProfit(prevYear, visibility),
    ]);
    const prevSummary = mergeAnnualSummaryWithFactoryShipment(
      prevSummaryCore,
      prevFactoryShipment
    );

    report.yearOverYear = {
      revenue: calculateComparison(
        combinedSummary.totalRevenue,
        prevSummary.totalRevenue
      ),
      profit: calculateComparison(
        combinedSummary.totalProfit,
        prevSummary.totalProfit
      ),
      expenses: calculateComparison(
        combinedSummary.totalExpenses,
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
  year: number,
  visibility: ReportVisibility
): Promise<AnnualFactoryShipmentProfit> {
  const { startDate, endDate } = getYearDateRange(year);

  let totalOrders = 0;
  let totalAmount = 0;
  let totalRevenue = 0;
  let customerProfit = 0;
  let selfCostAmount = 0;
  let totalExpenses = 0;

  const monthlyOrdersCount = Array.from({ length: 12 }, () => 0);
  const monthlyProfit = Array.from({ length: 12 }, () => 0);
  const monthlyRevenue = Array.from({ length: 12 }, () => 0);

  let orderCursor: string | undefined;
  while (true) {
    const where = applyReportVisibility(
      {
        shipmentDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['arrived', 'completed'],
        },
      } as any,
      visibility
    );
    const batch = await prisma.factoryShipmentOrder.findMany({
      where,
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
      orderBy: {
        id: 'asc',
      },
      take: REPORT_QUERY_BATCH_SIZE,
      ...(orderCursor ? { cursor: { id: orderCursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    for (const order of batch) {
      totalOrders += 1;

      const amount = toNumber(order.totalAmount);
      const revenue = toNumber(order.receivableAmount);
      const profit = toNumber(order.customerProfit);
      const selfCost = toNumber(order.selfCostAmount);
      const expenses = toNumber(order.expenseAmount);

      totalAmount += amount;
      totalRevenue += revenue;
      customerProfit += profit;
      selfCostAmount += selfCost;
      totalExpenses += expenses;

      const monthIndex = order.shipmentDate
        ? order.shipmentDate.getMonth()
        : -1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyOrdersCount[monthIndex] += 1;
        monthlyProfit[monthIndex] += profit;
        monthlyRevenue[monthIndex] += revenue;
      }
    }

    orderCursor = batch[batch.length - 1].id;
  }

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
    const index = month - 1;
    const monthProfit = monthlyProfit[index] ?? 0;
    const monthRevenue = monthlyRevenue[index] ?? 0;
    const monthProfitMargin =
      monthRevenue > 0
        ? roundToTwoDecimals((monthProfit / monthRevenue) * 100)
        : 0;

    monthlyData.push({
      month,
      orders: monthlyOrdersCount[index] ?? 0,
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
