/**
 * 月度报表服务
 * 提供月度财务报表的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import type {
    InventoryTurnover,
    MonthlyCosts,
    MonthlyExpenses,
    MonthlyFactoryShipmentProfit,
    MonthlyProfit,
    MonthlyReceivables,
    MonthlyReport,
    MonthlyRevenue,
} from '@/lib/types/report';
import {
    calculateTotalExpenses,
    extractExpensesByType,
} from '@/lib/utils/expense-type-helpers';
import { toNumber } from '@/lib/utils/number';

import {
    buildExpenseWhere,
    buildPaymentWhere,
    buildSalesOrderWhere,
    calculateComparison,
    calculateProfitMargin,
    createMonthlyPeriod,
    generateExpenseAlerts,
    generateProfitAlerts,
    getMonthDateRange,
    getPreviousMonth,
} from './report-helpers';

const REPORT_QUERY_BATCH_SIZE = 1000;

// ==================== 数据查询函数 ====================

/**
 * 获取月度收入数据
 */
async function getMonthlyRevenue(
  year: number,
  month: number
): Promise<MonthlyRevenue> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const where = buildSalesOrderWhere(startDate, endDate);

  // 聚合销售订单数据
  const [salesStats, orderCounts] = await Promise.all([
    prisma.salesOrder.aggregate({
      where,
      _sum: {
        totalAmount: true,
        itemsAmount: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.salesOrder.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const salesRevenue = toNumber(salesStats._sum.totalAmount);
  const orderCount = salesStats._count.id || 0;
  const averageOrderValue = orderCount > 0 ? salesRevenue / orderCount : 0;

  // 统计已完成和待处理订单数
  const completedOrders =
    orderCounts.find(g => g.status === 'completed')?._count.id || 0;
  const pendingOrders =
    orderCounts.find(g => g.status === 'draft')?._count.id || 0;

  return {
    salesRevenue,
    orderCount,
    averageOrderValue,
    completedOrders,
    pendingOrders,
  };
}

/**
 * 获取月度支出数据
 */
async function getMonthlyExpenses(
  year: number,
  month: number
): Promise<MonthlyExpenses> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const where = buildExpenseWhere(startDate, endDate);

  // 聚合费用数据
  const [totalStats, byTypeStats] = await Promise.all([
    prisma.expenseRecord.aggregate({
      where,
      _sum: {
        expenseAmount: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.expenseRecord.groupBy({
      by: ['expenseType'],
      where,
      _sum: {
        expenseAmount: true,
      },
    }),
  ]);

  // 使用工具函数提取费用类型金额
  const byType = extractExpensesByType(byTypeStats);
  const totalExpenses = calculateTotalExpenses(byType);
  const expenseCount = totalStats._count.id || 0;

  return {
    totalExpenses,
    byType,
    expenseCount,
  };
}

/**
 * 获取月度成本数据
 */
async function getMonthlyCosts(
  year: number,
  month: number
): Promise<MonthlyCosts> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  const where = buildSalesOrderWhere(startDate, endDate);

  // 聚合销售成本
  const salesCostStats = await prisma.salesOrder.aggregate({
    where,
    _sum: {
      costAmount: true,
    },
  });

  const salesCost = toNumber(salesCostStats._sum.costAmount);

  // 库存成本变化（入库成本 - 出库成本 + 盘点调整成本）
  const [inboundCost, outboundCost, adjustmentCost] = await Promise.all([
    prisma.inboundRecord.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        // 与盈亏分析保持一致：期初入库不计入当期成本
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
    prisma.inventoryAdjustment.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'approved',
        reason: {
          in: ['surplus', 'deficit'],
        },
      },
      _sum: {
        totalCost: true,
      },
    }),
  ]);

  const inventoryCostChange =
    Number(inboundCost._sum.totalCost ?? 0) -
    Number(outboundCost._sum.totalCost ?? 0) +
    Number(adjustmentCost._sum.totalCost ?? 0);
  const totalCost = salesCost + Math.abs(inventoryCostChange);

  return {
    salesCost,
    inventoryCostChange,
    totalCost,
  };
}

/**
 * 获取月度应收应付数据
 */
async function getMonthlyReceivables(
  year: number,
  month: number
): Promise<MonthlyReceivables> {
  const { startDate, endDate } = getMonthDateRange(year, month);

  // 获取应收款余额（基于伙伴账本的当前余额快照，按角色拆分）
  const receivableAggregate = await prisma.accountStatement.aggregate({
    where: {
      partnerRole: { in: ['customer', 'partner'] },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
      currentBalance: {
        gt: 0,
      },
    },
    _sum: {
      currentBalance: true,
    },
  });

  const totalReceivable = toNumber(receivableAggregate._sum.currentBalance);

  // 获取应付款数据
  const payableStats = await prisma.payableRecord.aggregate({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      payableAmount: true,
      paidAmount: true,
      remainingAmount: true,
    },
  });

  // 获取本月实际收款金额
  const paymentWhere = buildPaymentWhere(startDate, endDate);
  const receivedStats = await prisma.paymentRecord.aggregate({
    where: paymentWhere,
    _sum: {
      actualPaymentAmount: true,
    },
  });

  // 获取本月实际付款金额
  const paidStats = await prisma.paymentOutRecord.aggregate({
    where: {
      status: 'confirmed',
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      paymentAmount: true,
    },
  });

  const totalPayable = toNumber(payableStats._sum.payableAmount);
  const receivedAmount = Number(receivedStats._sum.actualPaymentAmount ?? 0);
  const paidAmount = toNumber(paidStats._sum.paymentAmount);
  const payableBalance = toNumber(payableStats._sum.remainingAmount);

  return {
    totalReceivable,
    totalPayable,
    receivedAmount,
    paidAmount,
    receivableBalance: totalReceivable,
    payableBalance,
  };
}

/**
 * 获取库存周转率数据
 */
async function getInventoryTurnover(
  year: number,
  month: number,
  salesCost: number
): Promise<InventoryTurnover> {
  const { startDate, endDate } = getMonthDateRange(year, month);

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
  // 期初库存 = 期末库存 - 本月入库 + 本月出库
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

  // 计算周转天数 = 30 / 周转率（月度报表用30天）
  const turnoverDays = turnoverRate > 0 ? 30 / turnoverRate : 0;

  return {
    turnoverRate: roundToTwoDecimals(turnoverRate),
    turnoverDays: roundToTwoDecimals(turnoverDays),
    averageInventoryValue: roundToTwoDecimals(averageInventoryValue),
    salesCost: roundToTwoDecimals(salesCost),
    beginningInventory: roundToTwoDecimals(beginningValue),
    endingInventory: roundToTwoDecimals(endingValue),
  };
}

/**
 * 计算月度利润数据
 */
function calculateMonthlyProfit(
  revenue: MonthlyRevenue,
  costs: MonthlyCosts,
  expenses: MonthlyExpenses
): MonthlyProfit {
  const { salesRevenue } = revenue;
  const { totalExpenses } = expenses;

  // 毛利润 = 销售收入 - 销售成本
  const grossProfit = salesRevenue - costs.salesCost;

  // 营业利润 = 毛利润 - 运营费用
  const operatingProfit = grossProfit - totalExpenses;

  // 净利润 = 营业利润（暂不扣除其他项）
  const netProfit = operatingProfit;

  // 利润率
  const profitMargin = calculateProfitMargin(netProfit, salesRevenue);
  const grossProfitMargin = calculateProfitMargin(grossProfit, salesRevenue);

  return {
    grossProfit,
    operatingProfit,
    netProfit,
    profitMargin,
    grossProfitMargin,
  };
}

/**
 * 将厂家直发利润合并到月度利润中
 *
 * 设计与盈亏分析保持一致:
 * - 月度费用中已经包含了厂家直发费用
 * - 厂家直发利润块包含:
 *   - customerProfit = 收入 - 成本 - 厂家费用
 *   - totalExpenses = 厂家费用
 * - 为避免厂家费用被扣两次, 需要加回一次厂家费用:
 *   factoryContribution = customerProfit + totalExpenses = 收入 - 成本
 */
function mergeFactoryShipmentIntoMonthlyProfit(
  baseProfit: MonthlyProfit,
  revenue: MonthlyRevenue,
  factoryShipmentProfit: MonthlyFactoryShipmentProfit
): MonthlyProfit {
  const factoryNetProfit = factoryShipmentProfit.customerProfit || 0;
  const factoryExpenses = factoryShipmentProfit.totalExpenses || 0;
  const factoryContribution = factoryNetProfit + factoryExpenses;

  // 合并后的收入: 仓库销售 + 厂家直发应收
  const totalRevenue =
    revenue.salesRevenue + (factoryShipmentProfit.totalRevenue || 0);

  const grossProfit = baseProfit.grossProfit + factoryContribution;
  const operatingProfit = baseProfit.operatingProfit + factoryContribution;
  const netProfit = baseProfit.netProfit + factoryContribution;

  return {
    grossProfit,
    operatingProfit,
    netProfit,
    grossProfitMargin: calculateProfitMargin(grossProfit, totalRevenue),
    profitMargin: calculateProfitMargin(netProfit, totalRevenue),
  };
}

// ==================== 主服务函数 ====================

/**
 * 获取月度报表
 */
export async function getMonthlyReport(
  year: number,
  month: number,
  includeComparison = true
): Promise<MonthlyReport> {
  // 获取当月数据
  const [revenue, expenses, costs, receivables, factoryShipmentProfit] =
    await Promise.all([
      getMonthlyRevenue(year, month),
      getMonthlyExpenses(year, month),
      getMonthlyCosts(year, month),
      getMonthlyReceivables(year, month),
      getMonthlyFactoryShipmentProfit(year, month),
    ]);

  // 先计算主营业务的基础利润(仅仓库销售), 再合并厂家直发利润
  const baseProfit = calculateMonthlyProfit(revenue, costs, expenses);
  const profit = mergeFactoryShipmentIntoMonthlyProfit(
    baseProfit,
    revenue,
    factoryShipmentProfit
  );

  // 计算库存周转率
  const inventoryTurnover = await getInventoryTurnover(
    year,
    month,
    costs.salesCost
  );

  // 创建报表周期
  const period = createMonthlyPeriod(year, month);

  // 生成预警
  const alerts = [
    ...generateProfitAlerts(
      profit.netProfit,
      profit.profitMargin,
      revenue.salesRevenue
    ),
    ...generateExpenseAlerts(expenses.totalExpenses, revenue.salesRevenue),
  ];

  // 构建基础报表
  const report: MonthlyReport = {
    period,
    revenue,
    expenses,
    costs,
    receivables,
    profit,
    factoryShipmentProfit,
    inventoryTurnover,
    alerts,
  };

  // 如果需要环比数据
  if (includeComparison) {
    const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month);
    const [prevRevenue, prevExpenses, prevCosts, prevFactoryShipmentProfit] =
      await Promise.all([
      getMonthlyRevenue(prevYear, prevMonth),
      getMonthlyExpenses(prevYear, prevMonth),
      getMonthlyCosts(prevYear, prevMonth),
      getMonthlyFactoryShipmentProfit(prevYear, prevMonth),
    ]);

    const prevBaseProfit = calculateMonthlyProfit(
      prevRevenue,
      prevCosts,
      prevExpenses
    );
    const prevProfit = mergeFactoryShipmentIntoMonthlyProfit(
      prevBaseProfit,
      prevRevenue,
      prevFactoryShipmentProfit
    );

    report.comparison = {
      revenue: calculateComparison(
        revenue.salesRevenue,
        prevRevenue.salesRevenue
      ),
      profit: calculateComparison(profit.netProfit, prevProfit.netProfit),
      expenses: calculateComparison(
        expenses.totalExpenses,
        prevExpenses.totalExpenses
      ),
    };
  }

  return report;
}

// ==================== 厂家发货利润统计 ====================

/**
 * 获取月度厂家发货利润统计
 *
 * @param year - 年份
 * @param month - 月份（1-12）
 * @returns 厂家发货利润统计数据
 */
export async function getMonthlyFactoryShipmentProfit(
  year: number,
  month: number
): Promise<MonthlyFactoryShipmentProfit> {
  const { startDate, endDate } = getMonthDateRange(year, month);

  let totalOrders = 0;
  let totalAmount = 0;
  let totalRevenue = 0;
  let customerProfit = 0;
  let selfCostAmount = 0;
  let totalExpenses = 0;

  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.factoryShipmentOrder.findMany({
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
      orderBy: {
        id: 'asc',
      },
      take: REPORT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    totalOrders += batch.length;

    for (const order of batch) {
      totalAmount += toNumber(order.totalAmount);
      totalRevenue += toNumber(order.receivableAmount);
      customerProfit += toNumber(order.customerProfit);
      selfCostAmount += toNumber(order.selfCostAmount);
      totalExpenses += toNumber(order.expenseAmount);
    }

    cursor = batch[batch.length - 1].id;
  }

  // 计算平均利润率
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  return {
    totalOrders,
    totalAmount: roundToTwoDecimals(totalAmount),
    totalRevenue: roundToTwoDecimals(totalRevenue),
    customerProfit: roundToTwoDecimals(customerProfit),
    selfCostAmount: roundToTwoDecimals(selfCostAmount),
    totalExpenses: roundToTwoDecimals(totalExpenses),
    averageProfitMargin,
  };
}
