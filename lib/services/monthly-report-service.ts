/**
 * 月度报表服务
 * 提供月度财务报表的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import type {
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

  const salesRevenue = salesStats._sum.totalAmount || 0;
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

  const salesCost = salesCostStats._sum.costAmount || 0;

  // 库存成本变化（入库成本 - 出库成本）
  const [inboundCost, outboundCost] = await Promise.all([
    prisma.inboundRecord.aggregate({
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

  const inventoryCostChange =
    (inboundCost._sum.totalCost || 0) - (outboundCost._sum.totalCost || 0);
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

  // 获取应收款数据
  const receivableStats = await prisma.accountStatement.aggregate({
    where: {
      partnerRole: { in: ['customer', 'partner'] },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
      currentBalance: true,
    },
  });

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

  return {
    totalReceivable: Math.abs(receivableStats._sum.totalAmount || 0),
    totalPayable: payableStats._sum.payableAmount || 0,
    receivedAmount: receivedStats._sum.actualPaymentAmount || 0,
    paidAmount: paidStats._sum.paymentAmount || 0,
    receivableBalance: Math.abs(receivableStats._sum.currentBalance || 0),
    payableBalance: payableStats._sum.remainingAmount || 0,
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

  // 计算利润
  const profit = calculateMonthlyProfit(revenue, costs, expenses);

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
    alerts,
  };

  // 如果需要环比数据
  if (includeComparison) {
    const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month);
    const [prevRevenue, prevExpenses, prevCosts] = await Promise.all([
      getMonthlyRevenue(prevYear, prevMonth),
      getMonthlyExpenses(prevYear, prevMonth),
      getMonthlyCosts(prevYear, prevMonth),
    ]);

    const prevProfit = calculateMonthlyProfit(
      prevRevenue,
      prevCosts,
      prevExpenses
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

  // 查询指定月份的所有已完成厂家发货订单
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
