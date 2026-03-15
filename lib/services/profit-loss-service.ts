/**
 * 盈亏分析服务
 * 提供盈亏分析的数据查询和计算功能
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import { getSystemMode } from '@/lib/services/system-mode-service';
import type {
  CostDetail,
  ExpenseDetail,
  FactoryShipmentProfitDetail,
  ProfitCalculation,
  ProfitLossAnalysis,
  ProfitLossTrend,
  RevenueDetail,
  SampleMetrics,
} from '@/lib/types/report';
import {
  calculateTotalExpenses,
  extractExpensesByType,
} from '@/lib/utils/expense-type-helpers';
import { toNumber, toNumberOrNull } from '@/lib/utils/number';

import {
  applyReportVisibility,
  buildExpenseWhere,
  buildSalesOrderWhere,
  calculateComparison,
  calculateCostRate,
  calculateExpenseRate,
  calculateProfitMargin,
  createReportPeriod,
  determineProfitLossStatus,
  generateExpenseAlerts,
  generateProfitAlerts,
  type ReportVisibility,
} from './report-helpers';
import { getSampleMetrics } from './report-sample-helpers';

const REPORT_QUERY_BATCH_SIZE = 1000;

// ==================== 数据查询函数 ====================

/**
 * 获取收入明细
 */
async function getRevenueDetail(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<RevenueDetail> {
  const where = applyReportVisibility(
    buildSalesOrderWhere(startDate, endDate),
    visibility
  );

  // 销售收入拆分：
  // - salesRevenue: 普通销售订单收入
  // - factoryShipmentRevenue: 厂家直发应收金额
  const factoryShipmentWhere = applyReportVisibility(
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
  const [salesStats, factoryShipmentStats] = await Promise.all([
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
    prisma.factoryShipmentOrder.aggregate({
      where: factoryShipmentWhere,
      _sum: {
        receivableAmount: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const salesRevenue = toNumber(salesStats._sum.totalAmount);
  const factoryShipmentRevenue = toNumber(
    factoryShipmentStats._sum?.receivableAmount
  );

  const orderCount =
    (salesStats._count.id || 0) +
    ((factoryShipmentStats._count?.id as number | null) || 0);

  // 暂时没有其他收入来源（利息、杂项等）
  const otherRevenue = 0;
  const totalRevenue = salesRevenue + factoryShipmentRevenue + otherRevenue;

  return {
    salesRevenue,
    factoryShipmentRevenue,
    otherRevenue,
    totalRevenue,
    orderCount,
  };
}

/**
 * 获取成本明细
 *
 * 会计口径（权责发生制）说明：
 * - 当期损益中的「成本」只包含已经实现的销售成本（COGS），来源于 salesOrder.costAmount
 * - 库存相关的入库/出库金额视为「资产变动」，不直接计入当期成本，但作为 inventoryCost 维度展示
 */
async function getCostDetail(
  startDate: Date,
  endDate: Date,
  totalRevenue: number,
  visibility: ReportVisibility
): Promise<CostDetail> {
  const where = applyReportVisibility(
    buildSalesOrderWhere(startDate, endDate),
    visibility
  );

  // 1) 销售成本（COGS）—— 唯一会计意义上的当期成本
  const salesCostStats = await prisma.salesOrder.aggregate({
    where,
    _sum: {
      costAmount: true,
    },
  });

  const salesCost = toNumber(salesCostStats._sum.costAmount);

  // 2) 库存成本变动（仅作为资产变动分析维度，不计入 totalCost）
  //    - 排除期初入库（opening_balance），期初库存不应冲击当期损益
  const [inboundCost, outboundCost] = await Promise.all([
    prisma.inboundRecord.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        reason: {
          not: 'opening_balance',
        },
        // 仅统计与采购订单关联的入库，避免清理/作废后残留入库影响报表
        purchaseOrder: {
          is: applyReportVisibility({} as any, visibility),
        },
      } as any,
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
        // 仅统计与销售订单关联的出库，避免清理/作废后残留出库影响报表
        salesOrder: {
          is: applyReportVisibility({} as any, visibility),
        },
      } as any,
      _sum: {
        totalCost: true,
      },
    }),
  ]);

  const inboundTotal = toNumber(inboundCost._sum.totalCost);
  const outboundTotal = toNumber(outboundCost._sum.totalCost);

  // 保留「入库成本 - 出库成本」的口径，作为库存资产变动的一个近似指标
  const inventoryCost = inboundTotal - outboundTotal;

  // 关键修正：利润表中的 totalCost 仅等于销售成本（COGS），不再叠加库存成本变动
  const totalCost = salesCost;
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
  totalRevenue: number,
  visibility: ReportVisibility
): Promise<ExpenseDetail> {
  const where = applyReportVisibility(
    buildExpenseWhere(startDate, endDate),
    visibility
  );
  const expenseRecordModel =
    prisma.expenseRecord as typeof prisma.expenseRecord &
      Partial<Pick<typeof prisma.expenseRecord, 'aggregate'>>;

  const expensesByType = await expenseRecordModel.groupBy({
    by: ['expenseType'],
    where,
    _sum: {
      expenseAmount: true,
    },
  });

  // 使用工具函数提取费用类型金额
  const byType = extractExpensesByType(expensesByType);
  let totalExpenses = calculateTotalExpenses(byType);

  if (typeof expenseRecordModel.aggregate === 'function') {
    const expenseAggregate = await expenseRecordModel.aggregate({
      where,
      _sum: {
        expenseAmount: true,
      },
    });

    // 总费用以聚合结果为准，兼容历史异常类型数据，避免明细映射遗漏后影响利润
    totalExpenses = toNumber(expenseAggregate._sum.expenseAmount);
  }

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
  groupBy: 'day' | 'week' | 'month',
  visibility: ReportVisibility
): Promise<ProfitLossTrend[]> {
  // 根据分组方式生成日期范围
  const dateRanges = generateDateRanges(startDate, endDate, groupBy);

  // 并行查询每个时间段的数据
  const trendPromises = dateRanges.map(async range => {
    const [revenue, costs, expenses] = await Promise.all([
      getRevenueDetail(range.start, range.end, visibility),
      getCostDetail(range.start, range.end, 0, visibility), // 先传0，后面会重新计算
      getExpenseDetail(range.start, range.end, 0, visibility),
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
      // ✅ 关键修复：推进到下个月的 1 号，避免从任意日开始导致整月区间出现缺口
      // 例如：start=1/15 时，下一段应从 2/1 开始，而不是 2/15
      current.setMonth(current.getMonth() + 1, 1);
    }

    if (rangeStart <= endDate) {
      ranges.push({ start: rangeStart, end: rangeEnd, label });
    }
  }

  return ranges;
}

// ==================== 主服务函数 ====================

async function getReturnAdjustments(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<{ returnAmountTotal: number; returnCostReversalTotal: number }> {
  const returnOrderItemModel = (prisma as any)?.returnOrderItem;
  if (
    !returnOrderItemModel ||
    typeof returnOrderItemModel.findMany !== 'function'
  ) {
    return { returnAmountTotal: 0, returnCostReversalTotal: 0 };
  }

  const returnOrderWhere = applyReportVisibility(
    {
      status: 'completed',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    } as any,
    visibility
  );

  const items = await returnOrderItemModel.findMany({
    where: {
      returnOrder: returnOrderWhere,
    },
    select: {
      subtotal: true,
      returnQuantity: true,
      damagedQuantity: true,
      salesOrderItem: {
        select: {
          unitCost: true,
          quantity: true,
          costSubtotal: true,
        },
      },
    },
  });

  let returnAmountTotal = 0;
  let returnCostReversalTotal = 0;

  for (const item of items) {
    returnAmountTotal += toNumber(item.subtotal);

    const returnQty = Number(item.returnQuantity ?? 0);
    const damagedQty = Number(item.damagedQuantity ?? 0);
    const reversibleQty = Math.max(0, returnQty - damagedQty);

    const explicitUnitCost = toNumberOrNull(item.salesOrderItem?.unitCost);
    const costSubtotal = toNumber(item.salesOrderItem?.costSubtotal);
    const originalQty = Number(item.salesOrderItem?.quantity ?? 0);
    const derivedUnitCost = originalQty > 0 ? costSubtotal / originalQty : 0;
    const unitCost = explicitUnitCost ?? derivedUnitCost;

    returnCostReversalTotal += reversibleQty * unitCost;
  }

  return {
    returnAmountTotal: roundToTwoDecimals(returnAmountTotal),
    returnCostReversalTotal: roundToTwoDecimals(returnCostReversalTotal),
  };
}

async function getCompensationRefundTotal(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<number> {
  const refundModel = (prisma as any)?.refundRecord;
  if (!refundModel || typeof refundModel.aggregate !== 'function') {
    return 0;
  }

  const baseWhere = applyReportVisibility(
    {
      status: 'completed',
      refundDate: {
        gte: startDate,
        lte: endDate,
      },
      returnOrderId: null,
    } as any,
    visibility
  );

  const [processedAgg, fallbackAgg] = await Promise.all([
    refundModel.aggregate({
      where: {
        ...baseWhere,
        processedAmount: { gt: 0 },
      },
      _sum: {
        processedAmount: true,
      },
    }),
    // ✅ 兼容历史数据：已完成退款但 processedAmount 仍为 0（用 refundAmount 兜底）
    refundModel.aggregate({
      where: {
        ...baseWhere,
        processedAmount: 0,
      },
      _sum: {
        refundAmount: true,
      },
    }),
  ]);

  return roundToTwoDecimals(
    toNumber(processedAgg._sum.processedAmount) +
      toNumber(fallbackAgg._sum.refundAmount)
  );
}

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
  const visibility: ReportVisibility = { systemMode: await getSystemMode() };

  // 并行获取所有数据
  const [returnAdjustments, compensationRefundTotal, revenueRaw, sample, trend] =
    await Promise.all([
      getReturnAdjustments(start, end, visibility),
      getCompensationRefundTotal(start, end, visibility),
      getRevenueDetail(start, end, visibility),
      getSampleMetrics(start, end, visibility),
      getProfitLossTrend(start, end, groupBy, visibility),
    ]);

  const adjustments = {
    ...returnAdjustments,
    compensationRefundTotal,
  };

  // ✅ 退货按 completedAt 入账：冲减销售收入（不影响厂家直发收入）
  const revenue: RevenueDetail = {
    ...revenueRaw,
    salesRevenue: revenueRaw.salesRevenue - adjustments.returnAmountTotal,
    totalRevenue: revenueRaw.totalRevenue - adjustments.returnAmountTotal,
  };

  // 获取成本、费用和厂家发货利润（需要总收入）
  const [costsRaw, expenses, factoryShipmentProfit] = await Promise.all([
    getCostDetail(start, end, revenueRaw.totalRevenue, visibility),
    getExpenseDetail(start, end, revenueRaw.totalRevenue, visibility),
    getFactoryShipmentProfitDetail(
      start,
      end,
      revenueRaw.totalRevenue,
      visibility
    ),
  ]);

  // ✅ 退货成本回冲：减少当期 COGS（仅非破损部分可回冲）
  const costs: CostDetail = {
    ...costsRaw,
    salesCost: costsRaw.salesCost - adjustments.returnCostReversalTotal,
    totalCost: costsRaw.totalCost - adjustments.returnCostReversalTotal,
    costRate: calculateCostRate(
      costsRaw.totalCost - adjustments.returnCostReversalTotal,
      revenue.totalRevenue
    ),
  };

  // 同步重算费用率（收入口径已被退货冲减）
  expenses.expenseRate = calculateExpenseRate(
    expenses.totalExpenses,
    revenue.totalRevenue
  );

  // 先计算主营业务的基础利润（不含厂家直发收入）
  const coreRevenue: RevenueDetail = {
    ...revenue,
    factoryShipmentRevenue: 0,
    totalRevenue: revenue.salesRevenue + revenue.otherRevenue,
  };
  const baseProfit = calculateProfit(
    coreRevenue,
    costs,
    expenses,
    adjustments.compensationRefundTotal
  );

  // 厂家直发利润视为额外的经营利润块，并入整体利润
  const factoryNetProfit = factoryShipmentProfit.customerProfit;

  const profit: ProfitCalculation = {
    grossProfit: baseProfit.grossProfit + factoryNetProfit,
    grossProfitMargin: calculateProfitMargin(
      baseProfit.grossProfit + factoryNetProfit,
      revenue.totalRevenue
    ),
    operatingProfit: baseProfit.operatingProfit + factoryNetProfit,
    operatingProfitMargin: calculateProfitMargin(
      baseProfit.operatingProfit + factoryNetProfit,
      revenue.totalRevenue
    ),
    netProfit: baseProfit.netProfit + factoryNetProfit,
    netProfitMargin: calculateProfitMargin(
      baseProfit.netProfit + factoryNetProfit,
      revenue.totalRevenue
    ),
  };

  // 重新计算厂家直发占总利润的比例（基于合并后的净利润）
  const totalNetProfit = profit.netProfit;
  const percentageOfTotal =
    Math.abs(totalNetProfit) > 0.01
      ? roundToTwoDecimals((factoryNetProfit / totalNetProfit) * 100)
      : 0;

  const normalizedFactoryShipmentProfit: FactoryShipmentProfitDetail = {
    ...factoryShipmentProfit,
    percentageOfTotal,
  };

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
    sample: sample as SampleMetrics,
    costs,
    expenses,
    profit,
    factoryShipmentProfit: normalizedFactoryShipmentProfit,
    trend,
    alerts,
    adjustments,
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
      getRevenueDetail(prevStart, prevEnd, visibility),
      getCostDetail(prevStart, prevEnd, 0, visibility),
      getExpenseDetail(prevStart, prevEnd, 0, visibility),
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
  totalRevenue: number,
  visibility: ReportVisibility
): Promise<FactoryShipmentProfitDetail> {
  let customerProfit = 0;
  let selfCostAmount = 0;
  let totalExpenses = 0;
  let factoryRevenue = 0;

  let cursor: string | undefined;
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
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    for (const order of batch) {
      customerProfit += toNumber(order.customerProfit);
      selfCostAmount += toNumber(order.selfCostAmount);
      totalExpenses += toNumber(order.expenseAmount);
      factoryRevenue += toNumber(order.receivableAmount);
    }

    cursor = batch[batch.length - 1].id;
  }

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
