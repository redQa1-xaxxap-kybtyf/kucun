// 客户对账单服务层
// 提供客户对账单的查询、计算和导出功能

import type { Prisma } from '@prisma/client';

import { buildDateTimeRangeFromDateStrings } from '@/lib/api/date-range';
import { REFUND_METHOD_LABELS } from '@/lib/config/finance';
import { prisma } from '@/lib/db';
import type {
  CustomerStatementDetail,
  CustomerStatementListItem,
  CustomerStatementQuery,
  CustomerStatementStatistics,
  CustomerStatementSummary,
  CustomerStatementTransaction,
} from '@/lib/types/customer-statement';

// 对账单中使用的收款/付款方式中文标签映射
const STATEMENT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  wechat_transfer: '微信转账',
  abc_qr: '农行码',
  icbc_qr: '工行码',
  ccb_qr: '建行码',
  cib_qr: '兴业码',
  bank_transfer: '银行转账',
  alipay: '支付宝',
  wechat: '微信支付',
  check: '支票',
  other: '其他',
};

const roundCurrency = (value: number): number =>
  Math.round(Number(value || 0) * 100) / 100;

function computeReceivableBalance(params: {
  salesAmount: number;
  salesReturnAmount: number;
  paymentReceived: number;
  prepaymentReceived: number;
  refundPaid: number;
}): number {
  return roundCurrency(
    params.salesAmount -
      params.salesReturnAmount -
      params.paymentReceived -
      params.prepaymentReceived -
      params.refundPaid
  );
}

function computePayableBalance(params: {
  purchaseAmount: number;
  purchaseReturnAmount: number;
  paymentPaid: number;
  prepaymentPaid: number;
  refundReceived: number;
}): number {
  return roundCurrency(
    params.purchaseAmount -
      params.purchaseReturnAmount -
      params.paymentPaid -
      params.prepaymentPaid +
      params.refundReceived
  );
}

function formatStatementPaymentMethod(method?: string | null): string {
  if (!method) return '';
  return STATEMENT_PAYMENT_METHOD_LABELS[method] ?? method;
}

function formatStatementRefundMethod(method?: string | null): string {
  if (!method) return '';
  return (
    REFUND_METHOD_LABELS[method as keyof typeof REFUND_METHOD_LABELS] ?? method
  );
}

/**
 * 获取客户对账单列表
 */
export async function getCustomerStatements(
  query: CustomerStatementQuery = {}
): Promise<{
  statements: CustomerStatementListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const {
    page = 1,
    pageSize = 20,
    customerId,
    customerName,
    startDate,
    endDate,
    minBalance,
    maxBalance,
    balanceType = 'all',
    sortBy = 'customerName',
    sortOrder = 'desc',
  } = query;

  const skip = (page - 1) * pageSize;

  // 构建客户查询条件
  const customerWhere: Prisma.CustomerWhereInput = {};

  if (customerId) {
    customerWhere.id = customerId;
  }

  if (customerName) {
    customerWhere.name = { contains: customerName };
  }

  const parsedDateFilter = buildDateTimeRangeFromDateStrings(startDate, endDate);
  const hasDateFilter = Boolean(parsedDateFilter);
  const dateFilter: Prisma.DateTimeFilter = parsedDateFilter ?? {};

  // 只显示“至少有一笔历史往来”的客户，避免列表出现大量 0 元账户
  // 对 date range 筛选场景：必须把时间条件带入客户查询，否则分页总数会不准确
  const salesOrderHistoryWhere: Prisma.SalesOrderWhereInput = {
    status: { in: ['confirmed', 'shipped', 'completed'] },
    ...(hasDateFilter && { createdAt: dateFilter }),
  };

  const returnOrderHistoryWhere: Prisma.ReturnOrderWhereInput = {
    status: { in: ['submitted', 'approved', 'processing', 'completed'] },
    ...(hasDateFilter && { createdAt: dateFilter }),
  };

  const paymentRecordHistoryWhere: Prisma.PaymentRecordWhereInput = {
    status: { in: ['confirmed', 'applied'] },
    paymentType: { in: ['order_payment', 'prepayment'] },
    ...(hasDateFilter && { paymentDate: dateFilter }),
  };

  const refundRecordHistoryWhere: Prisma.RefundRecordWhereInput = {
    status: { in: ['pending', 'processing', 'completed'] },
    ...(hasDateFilter && { refundDate: dateFilter }),
  };

  const factoryShipmentHistoryWhere: Prisma.FactoryShipmentOrderWhereInput = {
    status: { notIn: ['draft', 'cancelled'] },
    receivableAmount: { gt: 0 },
    ...(hasDateFilter
      ? { shipmentDate: dateFilter }
      : { shipmentDate: { not: null } }),
  };

  const customerWhereWithHistory: Prisma.CustomerWhereInput = {
    ...customerWhere,
    OR: [
      { salesOrders: { some: salesOrderHistoryWhere } },
      { returnOrders: { some: returnOrderHistoryWhere } },
      { factoryShipmentOrders: { some: factoryShipmentHistoryWhere } },
      { paymentRecords: { some: paymentRecordHistoryWhere } },
      { refundRecords: { some: refundRecordHistoryWhere } },
    ],
  };

  // 3. 批量查询所有客户的聚合数据（一次性查询，避免 N 次查询）
  const needsComputedPagination =
    sortBy !== 'customerName' ||
    balanceType !== 'all' ||
    minBalance !== undefined ||
    maxBalance !== undefined;

  let totalCustomers = 0;
  let customers: Array<{ id: string; name: string; phone: string | null }> = [];

  if (needsComputedPagination) {
    customers = await prisma.customer.findMany({
      where: customerWhereWithHistory,
      select: { id: true, name: true, phone: true },
    });
  } else {
    const [total, pageCustomers] = await Promise.all([
      prisma.customer.count({ where: customerWhereWithHistory }),
      prisma.customer.findMany({
        where: customerWhereWithHistory,
        select: { id: true, name: true, phone: true },
        orderBy: { name: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    totalCustomers = total;
    customers = pageCustomers;
  }

  if (customers.length === 0) {
    return {
      statements: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const customerIds = customers.map(c => c.id);

  // ✅ 批量聚合查询：销售订单（应收金额 = totalAmount + roundingAdjustment）
  // ✅ 批量聚合查询：厂家直发订单（只统计已发货的单据）
  // ✅ 批量聚合查询：退货订单（冲减应收）
  // ✅ 批量聚合查询：收款记录（订单收款 + 预收款）
  // ✅ 批量聚合查询：退款记录（已退款，用于冲回“应退给客户”的余额）
  const factoryWhere: Prisma.FactoryShipmentOrderWhereInput = {
    customerId: { in: customerIds },
    status: { notIn: ['draft', 'cancelled'] },
    receivableAmount: { gt: 0 },
  };
  if (hasDateFilter) {
    factoryWhere.shipmentDate = dateFilter;
  } else {
    factoryWhere.shipmentDate = { not: null };
  }

  const [
    salesAggregates,
    factoryAggregates,
    returnAggregates,
    paymentAggregates,
    refundAggregates,
    refundProcessedFallbackAggregates,
    suppliersForCustomers,
  ] = await Promise.all([
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: { in: ['confirmed', 'shipped', 'completed'] },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { totalAmount: true, roundingAdjustment: true },
      _max: { createdAt: true },
      _count: { id: true },
    }),
    prisma.factoryShipmentOrder.groupBy({
      by: ['customerId'],
      where: factoryWhere,
      _sum: { receivableAmount: true },
      _max: { shipmentDate: true },
      _count: { id: true },
    }),
    prisma.returnOrder.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: { in: ['submitted', 'approved', 'processing', 'completed'] },
        ...(hasDateFilter && { createdAt: dateFilter }),
      },
      _sum: { refundAmount: true },
      _max: { createdAt: true },
      _count: { id: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['customerId', 'paymentType'],
      where: {
        customerId: { in: customerIds },
        status: { in: ['confirmed', 'applied'] },
        paymentType: { in: ['order_payment', 'prepayment'] },
        ...(hasDateFilter && { paymentDate: dateFilter }),
      },
      _sum: { paymentAmount: true },
      _max: { paymentDate: true },
      _count: { id: true },
    }),
    prisma.refundRecord.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: { in: ['pending', 'processing', 'completed'] },
        ...(hasDateFilter && { refundDate: dateFilter }),
      },
      _sum: { processedAmount: true },
      _max: { refundDate: true },
      _count: { id: true },
    }),
    prisma.refundRecord.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: 'completed',
        processedAmount: 0,
        ...(hasDateFilter && { refundDate: dateFilter }),
      },
      _sum: { refundAmount: true },
    }),
    Promise.all(
      customers.map(customer =>
        findSupplierForCustomer(customer.id, {
          name: customer.name,
          phone: customer.phone,
        })
      )
    ),
  ]);

  const supplierIdByCustomerId = new Map(
    customers.map((customer, index) => [
      customer.id,
      suppliersForCustomers[index]?.id ?? null,
    ])
  );

  const supplierIds = suppliersForCustomers
    .filter((supplier): supplier is SupplierIdentifier => Boolean(supplier))
    .map(supplier => supplier.id);

  const supplierPrepaymentPaidMap = new Map<string, number>();

  if (supplierIds.length > 0) {
    const supplierPayments = await prisma.paymentOutRecord.groupBy({
      by: ['supplierId'],
      where: {
        supplierId: { in: supplierIds },
        status: 'confirmed',
        ...(hasDateFilter && { paymentDate: dateFilter }),
      },
      _sum: { paymentAmount: true },
    });

    for (const row of supplierPayments) {
      supplierPrepaymentPaidMap.set(
        row.supplierId,
        Number(row._sum.paymentAmount ?? 0)
      );
    }
  }

  const salesSummaryByCustomerId = new Map<
    string,
    { salesAmount: number; lastTransactionDate?: Date; count: number }
  >();
  for (const row of salesAggregates) {
    salesSummaryByCustomerId.set(row.customerId, {
      salesAmount:
        Number(row._sum.totalAmount ?? 0) +
        Number(row._sum.roundingAdjustment ?? 0),
      lastTransactionDate: row._max.createdAt ?? undefined,
      count: row._count.id ?? 0,
    });
  }

  const factorySummaryByCustomerId = new Map<
    string,
    { salesAmount: number; lastTransactionDate?: Date; count: number }
  >();
  for (const row of factoryAggregates) {
    factorySummaryByCustomerId.set(row.customerId, {
      salesAmount: Number(row._sum.receivableAmount ?? 0),
      lastTransactionDate: row._max.shipmentDate ?? undefined,
      count: row._count.id ?? 0,
    });
  }

  const returnSummaryByCustomerId = new Map<
    string,
    { returnAmount: number; lastTransactionDate?: Date; count: number }
  >();
  for (const row of returnAggregates) {
    returnSummaryByCustomerId.set(row.customerId, {
      returnAmount: Number(row._sum.refundAmount ?? 0),
      lastTransactionDate: row._max.createdAt ?? undefined,
      count: row._count.id ?? 0,
    });
  }

  const paymentReceivedByCustomerId = new Map<string, number>();
  const prepaymentReceivedByCustomerId = new Map<string, number>();
  const paymentCountByCustomerId = new Map<string, number>();
  const lastPaymentDateByCustomerId = new Map<string, Date>();

  for (const row of paymentAggregates) {
    paymentCountByCustomerId.set(
      row.customerId,
      (paymentCountByCustomerId.get(row.customerId) ?? 0) + (row._count.id ?? 0)
    );

    const paymentDate = row._max.paymentDate ?? undefined;
    if (paymentDate instanceof Date) {
      const existing = lastPaymentDateByCustomerId.get(row.customerId);
      if (!existing || paymentDate.getTime() > existing.getTime()) {
        lastPaymentDateByCustomerId.set(row.customerId, paymentDate);
      }
    }

    if (row.paymentType === 'order_payment') {
      paymentReceivedByCustomerId.set(
        row.customerId,
        (paymentReceivedByCustomerId.get(row.customerId) ?? 0) +
          Number(row._sum.paymentAmount ?? 0)
      );
      continue;
    }

    if (row.paymentType === 'prepayment') {
      prepaymentReceivedByCustomerId.set(
        row.customerId,
        (prepaymentReceivedByCustomerId.get(row.customerId) ?? 0) +
          Number(row._sum.paymentAmount ?? 0)
      );
    }
  }

  const refundPaidByCustomerId = new Map<string, number>();
  const refundCountByCustomerId = new Map<string, number>();
  const lastRefundDateByCustomerId = new Map<string, Date>();

  for (const row of refundAggregates) {
    refundPaidByCustomerId.set(
      row.customerId,
      (refundPaidByCustomerId.get(row.customerId) ?? 0) +
        Number(row._sum.processedAmount ?? 0)
    );
    refundCountByCustomerId.set(row.customerId, row._count.id ?? 0);

    const refundDate = row._max.refundDate ?? undefined;
    if (refundDate instanceof Date) {
      lastRefundDateByCustomerId.set(row.customerId, refundDate);
    }
  }

  // ✅ 兼容历史数据：已完成退款但 processedAmount 仍为 0（用 refundAmount 兜底）
  for (const row of refundProcessedFallbackAggregates) {
    const fallbackAmount = Number(row._sum.refundAmount ?? 0);
    if (fallbackAmount <= 0) continue;
    refundPaidByCustomerId.set(
      row.customerId,
      (refundPaidByCustomerId.get(row.customerId) ?? 0) + fallbackAmount
    );
  }

  // 4. 构建客户对账单数据（使用聚合结果，避免逐个查询）
  const statementsWithBalance = customers.map(customer => {
    const salesData = salesSummaryByCustomerId.get(customer.id);
    const factoryData = factorySummaryByCustomerId.get(customer.id);
    const returnData = returnSummaryByCustomerId.get(customer.id);

    const salesAmountFromOrders = salesData?.salesAmount ?? 0;
    const salesAmountFromFactory = factoryData?.salesAmount ?? 0;
    const salesAmount = salesAmountFromOrders + salesAmountFromFactory;
    const salesReturnAmount = returnData?.returnAmount ?? 0;
    const paymentReceived = paymentReceivedByCustomerId.get(customer.id) ?? 0;
    const prepaymentReceived =
      prepaymentReceivedByCustomerId.get(customer.id) ?? 0;
    const refundPaid = refundPaidByCustomerId.get(customer.id) ?? 0;

    const receivableBalance = computeReceivableBalance({
      salesAmount,
      salesReturnAmount,
      paymentReceived,
      prepaymentReceived,
      refundPaid,
    });

    const supplierId = supplierIdByCustomerId.get(customer.id);
    const prepaymentPaid = supplierId
      ? (supplierPrepaymentPaidMap.get(supplierId) ?? 0)
      : 0;

    const payableBalance = computePayableBalance({
      purchaseAmount: 0,
      purchaseReturnAmount: 0,
      paymentPaid: 0,
      prepaymentPaid,
      refundReceived: 0,
    });

    const netBalance = roundCurrency(receivableBalance - payableBalance);

    const lastTransactionDate = [
      salesData?.lastTransactionDate,
      factoryData?.lastTransactionDate,
      returnData?.lastTransactionDate,
      lastPaymentDateByCustomerId.get(customer.id),
      lastRefundDateByCustomerId.get(customer.id),
    ]
      .filter((date): date is Date => date instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const transactionCount =
      (salesData?.count ?? 0) +
      (factoryData?.count ?? 0) +
      (returnData?.count ?? 0) +
      (paymentCountByCustomerId.get(customer.id) ?? 0) +
      (refundCountByCustomerId.get(customer.id) ?? 0);

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || undefined,
      lastTransactionDate: lastTransactionDate?.toISOString(),
      summary: {
        receivables: {
          salesAmount,
          salesReturnAmount,
          paymentReceived,
          prepaymentReceived,
          refundPaid,
          receivableBalance,
        },
        payables: {
          purchaseAmount: 0,
          purchaseReturnAmount: 0,
          paymentPaid: 0,
          prepaymentPaid,
          refundReceived: 0,
          payableBalance,
        },
        netBalance,
      },
      transactionCount,
    };
  });

  let filteredStatements = statementsWithBalance;

  // 第二步：根据余额类型筛选（如果需要）

  if (balanceType === 'receivable') {
    filteredStatements = filteredStatements.filter(
      s => s.summary.receivables.receivableBalance > 0
    );
  } else if (balanceType === 'payable') {
    filteredStatements = filteredStatements.filter(
      s => s.summary.payables.payableBalance > 0
    );
  }

  // 根据余额范围筛选（如果需要）
  if (minBalance !== undefined) {
    filteredStatements = filteredStatements.filter(
      s => Math.abs(s.summary.netBalance) >= minBalance
    );
  }

  if (maxBalance !== undefined) {
    filteredStatements = filteredStatements.filter(
      s => Math.abs(s.summary.netBalance) <= maxBalance
    );
  }

  // 需要按计算字段筛选/排序时：必须全量计算后再分页，否则结果不完整
  if (needsComputedPagination) {
    filteredStatements.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'customerName':
          compareValue = a.customerName.localeCompare(b.customerName);
          break;
        case 'netBalance':
          compareValue = a.summary.netBalance - b.summary.netBalance;
          break;
        case 'receivableBalance':
          compareValue =
            a.summary.receivables.receivableBalance -
            b.summary.receivables.receivableBalance;
          break;
        case 'payableBalance':
          compareValue =
            a.summary.payables.payableBalance -
            b.summary.payables.payableBalance;
          break;
        case 'lastTransactionDate':
          compareValue =
            new Date(a.lastTransactionDate || 0).getTime() -
            new Date(b.lastTransactionDate || 0).getTime();
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
  }

  if (needsComputedPagination) {
    const total = filteredStatements.length;
    const totalPages = Math.ceil(total / pageSize);
    const pageStatements = filteredStatements.slice(skip, skip + pageSize);

    return {
      statements: pageStatements,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  return {
    statements: filteredStatements,
    pagination: {
      page,
      pageSize,
      total: totalCustomers,
      totalPages: Math.ceil(totalCustomers / pageSize),
    },
  };
}

/**
 * 获取客户对账单详情
 */
export async function getCustomerStatementDetail(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<CustomerStatementDetail> {
  // 查询客户信息
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  });

  if (!customer) {
    throw new Error('客户不存在');
  }

  // 计算期初余额(startDate之前的余额)
  const openingBalance = await calculateOpeningBalance(customerId, startDate);

  // 获取交易明细
  const transactions = await getCustomerTransactions(
    customerId,
    startDate,
    endDate
  );

  // 计算汇总数据
  const summary = await calculateCustomerStatementSummary(
    customerId,
    startDate,
    endDate
  );

  // 计算期末余额
  const closingBalance = roundCurrency(openingBalance + summary.netBalance);

  return {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone || undefined,
    customerAddress: customer.address || undefined,
    periodStart: startDate,
    periodEnd: endDate,
    openingBalance,
    transactions,
    summary,
    closingBalance,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 获取客户对账单统计数据
 */
export async function getCustomerStatementStatistics(): Promise<CustomerStatementStatistics> {
  const totalCustomers = await prisma.customer.count();

  const [
    salesGroups,
    factoryGroups,
    returnGroups,
    paymentGroups,
    refundGroups,
    refundProcessedFallbackGroups,
  ] = await Promise.all([
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { status: { in: ['confirmed', 'shipped', 'completed'] } },
      _sum: { totalAmount: true, roundingAdjustment: true },
    }),
    prisma.factoryShipmentOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { notIn: ['draft', 'cancelled'] },
        receivableAmount: { gt: 0 },
        shipmentDate: { not: null },
      },
      _sum: { receivableAmount: true },
    }),
    prisma.returnOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['submitted', 'approved', 'processing', 'completed'] },
      },
      _sum: { refundAmount: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['customerId', 'paymentType'],
      where: {
        status: { in: ['confirmed', 'applied'] },
        paymentType: { in: ['order_payment', 'prepayment'] },
      },
      _sum: { paymentAmount: true },
    }),
    prisma.refundRecord.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['pending', 'processing', 'completed'] },
      },
      _sum: { processedAmount: true },
    }),
    prisma.refundRecord.groupBy({
      by: ['customerId'],
      where: {
        status: 'completed',
        processedAmount: 0,
      },
      _sum: { refundAmount: true },
    }),
  ]);

  const activeCustomerIds = new Set<string>();

  const salesAmountByCustomer = new Map<string, number>();
  for (const row of salesGroups) {
    activeCustomerIds.add(row.customerId);
    salesAmountByCustomer.set(
      row.customerId,
      Number(row._sum.totalAmount ?? 0) + Number(row._sum.roundingAdjustment ?? 0)
    );
  }

  const factoryAmountByCustomer = new Map<string, number>();
  for (const row of factoryGroups) {
    activeCustomerIds.add(row.customerId);
    factoryAmountByCustomer.set(
      row.customerId,
      Number(row._sum.receivableAmount ?? 0)
    );
  }

  const returnAmountByCustomer = new Map<string, number>();
  for (const row of returnGroups) {
    activeCustomerIds.add(row.customerId);
    returnAmountByCustomer.set(
      row.customerId,
      Number(row._sum.refundAmount ?? 0)
    );
  }

  const paymentReceivedByCustomer = new Map<string, number>();
  const prepaymentReceivedByCustomer = new Map<string, number>();

  for (const row of paymentGroups) {
    activeCustomerIds.add(row.customerId);

    if (row.paymentType === 'order_payment') {
      paymentReceivedByCustomer.set(
        row.customerId,
        Number(row._sum.paymentAmount ?? 0)
      );
      continue;
    }

    if (row.paymentType === 'prepayment') {
      prepaymentReceivedByCustomer.set(
        row.customerId,
        Number(row._sum.paymentAmount ?? 0)
      );
    }
  }

  const refundPaidByCustomer = new Map<string, number>();
  for (const row of refundGroups) {
    activeCustomerIds.add(row.customerId);
    refundPaidByCustomer.set(
      row.customerId,
      Number(row._sum.processedAmount ?? 0)
    );
  }

  // ✅ 兼容历史数据：已完成退款但 processedAmount 仍为 0（用 refundAmount 兜底）
  for (const row of refundProcessedFallbackGroups) {
    const fallbackAmount = Number(row._sum.refundAmount ?? 0);
    if (fallbackAmount <= 0) continue;
    refundPaidByCustomer.set(
      row.customerId,
      (refundPaidByCustomer.get(row.customerId) ?? 0) + fallbackAmount
    );
    activeCustomerIds.add(row.customerId);
  }

  let totalReceivableBalance = 0;
  let totalPayableBalance = 0;
  let overdueCustomers = 0;

  for (const customerId of activeCustomerIds) {
    const salesAmount =
      (salesAmountByCustomer.get(customerId) ?? 0) +
      (factoryAmountByCustomer.get(customerId) ?? 0);
    const salesReturnAmount = returnAmountByCustomer.get(customerId) ?? 0;
    const paymentReceived = paymentReceivedByCustomer.get(customerId) ?? 0;
    const prepaymentReceived =
      prepaymentReceivedByCustomer.get(customerId) ?? 0;
    const refundPaid = refundPaidByCustomer.get(customerId) ?? 0;

    const receivableBalance = computeReceivableBalance({
      salesAmount,
      salesReturnAmount,
      paymentReceived,
      prepaymentReceived,
      refundPaid,
    });

    totalReceivableBalance += receivableBalance;

    if (receivableBalance > 0.01) {
      overdueCustomers += 1;
    }
  }

  totalReceivableBalance = roundCurrency(totalReceivableBalance);
  totalPayableBalance = roundCurrency(totalPayableBalance);

  const totalNetBalance = roundCurrency(
    totalReceivableBalance - totalPayableBalance
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    monthlySales,
    monthlyFactory,
    monthlyReturns,
    monthlyPayments,
    monthlyRefunds,
  ] = await Promise.all([
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['confirmed', 'shipped', 'completed'] },
        createdAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.factoryShipmentOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { notIn: ['draft', 'cancelled'] },
        shipmentDate: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.returnOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['submitted', 'approved', 'processing', 'completed'] },
        createdAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['confirmed', 'applied'] },
        paymentType: { in: ['order_payment', 'prepayment'] },
        paymentDate: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.refundRecord.groupBy({
      by: ['customerId'],
      where: {
        status: { in: ['pending', 'processing', 'completed'] },
        refundDate: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
  ]);

  const monthlyActiveSet = new Set<string>();
  monthlySales.forEach(row => monthlyActiveSet.add(row.customerId));
  monthlyFactory.forEach(row => monthlyActiveSet.add(row.customerId));
  monthlyReturns.forEach(row => monthlyActiveSet.add(row.customerId));
  monthlyPayments.forEach(row => monthlyActiveSet.add(row.customerId));
  monthlyRefunds.forEach(row => monthlyActiveSet.add(row.customerId));

  return {
    totalCustomers,
    activeCustomers: activeCustomerIds.size,
    totalReceivableBalance,
    totalPayableBalance,
    totalNetBalance,
    overdueCustomers,
    monthlyActiveCustomers: monthlyActiveSet.size,
  };
}

type SupplierIdentifier = { id: string };

async function findSupplierForCustomer(
  customerId: string,
  customerInfo?: { name?: string | null; phone?: string | null }
): Promise<SupplierIdentifier | null> {
  const customer =
    customerInfo ??
    (await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true },
    }));

  const name = customer?.name ?? null;
  const phone = customer?.phone ?? null;

  if (!name && !phone) {
    return null;
  }

  const orConditions: Prisma.SupplierWhereInput[] = [
    ...(name ? [{ name: { contains: name } }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (orConditions.length === 0) {
    return null;
  }

  return prisma.supplier.findFirst({
    where: { OR: orConditions },
    select: { id: true },
  });
}

/**
 * 计算客户对账单汇总数据
 *
 * 业务逻辑说明：
 * 1. 应收余额 = 销售金额 - 应退金额 - 已收款 - 预收款 - 已退款
 * 2. 退货单(ReturnOrder.refundAmount) 代表“应退给客户”的金额，减少应收
 * 3. 退款单(RefundRecord.processedAmount) 代表“实际已退款”的金额，计入应收余额减项
 */
type RefundRecordForStatement = {
  refundAmount: unknown | null;
  processedAmount: unknown | null;
  remainingAmount: unknown | null;
  status: string;
  returnOrder?: {
    refundAmount: unknown | null;
  } | null;
};

function normalizeRefundAmounts(record: RefundRecordForStatement) {
  const refundAmountRaw = Number(record.refundAmount ?? 0);
  const processedAmountRaw = Number(record.processedAmount ?? 0);
  const fallbackAmount = Number(record.returnOrder?.refundAmount ?? 0);

  const effectiveTotal =
    refundAmountRaw > 0
      ? refundAmountRaw
      : processedAmountRaw > 0
        ? processedAmountRaw
        : fallbackAmount;

  const effectiveProcessed =
    processedAmountRaw > 0
      ? processedAmountRaw
      : record.status === 'completed'
        ? effectiveTotal
        : 0;

  const fallbackRemaining = Math.max(0, effectiveTotal - effectiveProcessed);

  const hasRemainingField =
    record.remainingAmount !== null && record.remainingAmount !== undefined;
  const remainingFieldValue = Number(record.remainingAmount ?? 0);

  let effectiveRemaining = hasRemainingField
    ? remainingFieldValue
    : fallbackRemaining;

  if (record.status === 'completed') {
    effectiveRemaining = 0;
  } else {
    effectiveRemaining = Math.max(0, effectiveRemaining);
    if (effectiveRemaining === 0 && fallbackRemaining > 0) {
      effectiveRemaining = fallbackRemaining;
    }
  }

  return {
    effectiveTotal,
    effectiveProcessed,
    effectiveRemaining:
      record.status === 'completed' ? 0 : Math.max(0, effectiveRemaining),
  };
}

export async function calculateCustomerStatementSummary(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<CustomerStatementSummary> {
  const dateFilter: Prisma.DateTimeFilter = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    // 包含结束当天整日
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const hasDateFilter = Object.keys(dateFilter).length > 0;

  // 1. 查询销售订单(应收) - 包含所有有效状态
  // pending: 待处理（订单已提交，客户已承诺购买）
  // confirmed: 已确认
  // processing: 处理中
  // confirmed: 已确认
  // shipped: 已发货
  // completed: 已完成
  const salesOrderAggregate = await prisma.salesOrder.aggregate({
    where: {
      customerId,
      status: { in: ['confirmed', 'shipped', 'completed'] },
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
    _sum: { totalAmount: true, roundingAdjustment: true },
  });

  const salesAmountFromOrders =
    Number(salesOrderAggregate._sum.totalAmount ?? 0) +
    Number(salesOrderAggregate._sum.roundingAdjustment ?? 0);

  // 1.1 查询厂家直发订单(应收) - 视为与销售订单同等口径的应收销售
  const factoryWhere: Prisma.FactoryShipmentOrderWhereInput = {
    customerId,
    status: { notIn: ['draft', 'cancelled'] },
    receivableAmount: { gt: 0 },
  };
  if (hasDateFilter) {
    factoryWhere.shipmentDate = dateFilter;
  } else {
    // 统一口径：只有已发货的客户直发订单才计入对账
    factoryWhere.shipmentDate = { not: null };
  }

  const factoryOrderAggregate = await prisma.factoryShipmentOrder.aggregate({
    where: factoryWhere,
    _sum: { receivableAmount: true },
  });

  const salesAmountFromFactory = Number(
    factoryOrderAggregate._sum.receivableAmount ?? 0
  );

  const salesAmount = salesAmountFromOrders + salesAmountFromFactory;

  // 2. 查询销售退货(冲减应收) - 只包含有效状态的订单用于计算余额
  // 注意：不包含已取消(cancelled)和已拒绝(rejected)的订单
  const returnOrderAggregate = await prisma.returnOrder.aggregate({
    where: {
      customerId,
      status: { in: ['submitted', 'approved', 'processing', 'completed'] },
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
    _sum: { refundAmount: true },
  });

  const salesReturnAmount = Number(returnOrderAggregate._sum.refundAmount ?? 0);

  // 3. 查询收款记录
  // ✅ 修正: 分别统计订单付款和预收款已冲抵金额
  // 只统计已完成/已冲抵的收款，待确认收款不减少应收
  const paymentGroups = await prisma.paymentRecord.groupBy({
    by: ['paymentType'],
    where: {
      customerId,
      status: { in: ['confirmed', 'applied'] },
      paymentType: { in: ['order_payment', 'prepayment'] },
      ...(hasDateFilter && { paymentDate: dateFilter }),
    },
    _sum: {
      paymentAmount: true,
    },
  });

  let paymentReceived = 0;
  let prepaymentReceived = 0;

  for (const group of paymentGroups) {
    if (group.paymentType === 'order_payment') {
      paymentReceived = Number(group._sum.paymentAmount ?? 0);
    } else if (group.paymentType === 'prepayment') {
      prepaymentReceived = Number(group._sum.paymentAmount ?? 0);
    }
  }

  // 4. 查询退款记录(退款给客户)
  let refundCompensationPaid = 0;
  let refundProcessed = 0;
  let refundPending = 0;

  const refundPageSize = 2000;
  let refundCursor: string | undefined;

  while (true) {
    const refundPage = await prisma.refundRecord.findMany({
      where: {
        customerId,
        status: { in: ['pending', 'processing', 'completed'] },
        ...(hasDateFilter && { refundDate: dateFilter }),
      },
      select: {
        id: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        returnOrderId: true,
        status: true,
        returnOrder: {
          select: {
            refundAmount: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: refundPageSize,
      ...(refundCursor ? { cursor: { id: refundCursor }, skip: 1 } : {}),
    });

    for (const record of refundPage) {
      const { effectiveProcessed, effectiveRemaining } =
        normalizeRefundAmounts(record);
      refundProcessed += effectiveProcessed;
      refundPending += effectiveRemaining;
      if (record.returnOrderId === null) {
        refundCompensationPaid += effectiveProcessed;
      }
    }

    if (refundPage.length < refundPageSize) {
      break;
    }

    refundCursor = refundPage[refundPage.length - 1]?.id;
    if (!refundCursor) {
      break;
    }
  }

  const refundPaid = refundProcessed;

  // 6. 查询采购订单(应付 - 客户作为供应商)
  // 需要通过supplier表关联到customer
  // 暂时设为0,后续实现客户-供应商双重身份关联
  const purchaseAmount = 0;
  const purchaseReturnAmount = 0;
  const paymentPaid = 0;
  const refundReceived = 0;

  // 7. 查询预付款(向客户作为供应商时预付)
  // 通过供应商表查找是否有客户作为供应商的预付款
  // 首先查找是否有对应的供应商记录
  const customerAsSupplier = await findSupplierForCustomer(customerId);

  let prepaymentPaid = 0;
  if (customerAsSupplier) {
    const supplierPaymentAggregate = await prisma.paymentOutRecord.aggregate({
      where: {
        supplierId: customerAsSupplier.id,
        status: { in: ['confirmed'] },
        ...(hasDateFilter && { paymentDate: dateFilter }),
      },
      _sum: { paymentAmount: true },
    });

    prepaymentPaid = Number(supplierPaymentAggregate._sum.paymentAmount ?? 0);
  }

  const receivableBalance = computeReceivableBalance({
    salesAmount,
    salesReturnAmount,
    paymentReceived,
    prepaymentReceived,
    refundPaid,
  });

  const payableBalance = computePayableBalance({
    purchaseAmount,
    purchaseReturnAmount,
    paymentPaid,
    prepaymentPaid,
    refundReceived,
  });

  const netBalance = roundCurrency(receivableBalance - payableBalance);

  return {
    receivables: {
      salesAmount,
      salesReturnAmount,
      paymentReceived,
      refundPaid,
      prepaymentReceived,
      refundProcessed,
      refundPending,
      refundCompensation: refundCompensationPaid,
      receivableBalance,
    },
    payables: {
      purchaseAmount,
      purchaseReturnAmount,
      paymentPaid,
      refundReceived,
      prepaymentPaid,
      payableBalance,
    },
    netBalance,
  };
}

/**
 * 获取客户交易明细
 */
async function getCustomerTransactions(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<CustomerStatementTransaction[]> {
  const openingBalance = await calculateOpeningBalance(customerId, startDate);
  const transactionEntries: Omit<CustomerStatementTransaction, 'balance'>[] =
    [];

  const start = new Date(startDate);
  const end = new Date(endDate);
  // 结束日期包含当天整日
  end.setHours(23, 59, 59, 999);

  const dateFilter = {
    gte: start,
    lte: end,
  };

  // 检查客户是否也作为供应商存在
  const customerAsSupplier = await findSupplierForCustomer(customerId);
  const pageSize = 2000;

  // 1. 获取销售订单 - 包含所有有效状态
  let salesOrderCursor: string | undefined;
  while (true) {
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        customerId,
        status: { in: ['confirmed', 'shipped', 'completed'] },
        createdAt: dateFilter,
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        roundingAdjustment: true,
        createdAt: true,
        status: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(salesOrderCursor
        ? { cursor: { id: salesOrderCursor }, skip: 1 }
        : {}),
    });

    for (const order of salesOrders) {
      transactionEntries.push({
        id: order.id,
        transactionType: 'sales_order',
        transactionDate: order.createdAt.toISOString(),
        referenceNumber: order.orderNumber,
        referenceId: order.id,
        description: `销售订单 ${order.orderNumber}`,
        debitAmount:
          Number(order.totalAmount ?? 0) + Number(order.roundingAdjustment ?? 0),
        creditAmount: 0,
        status: order.status,
      });
    }

    if (salesOrders.length < pageSize) {
      break;
    }

    salesOrderCursor = salesOrders[salesOrders.length - 1]?.id;
    if (!salesOrderCursor) {
      break;
    }
  }

  // 1.1 获取厂家直发订单 - 视为同样的“销售订单”, 使用应收金额作为记账金额
  let factoryOrderCursor: string | undefined;
  while (true) {
    const factoryOrders = await prisma.factoryShipmentOrder.findMany({
      where: {
        customerId,
        status: { notIn: ['draft', 'cancelled'] },
        receivableAmount: { gt: 0 },
        shipmentDate: dateFilter,
      },
      select: {
        id: true,
        orderNumber: true,
        receivableAmount: true,
        shipmentDate: true,
        status: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(factoryOrderCursor
        ? { cursor: { id: factoryOrderCursor }, skip: 1 }
        : {}),
    });

    for (const order of factoryOrders) {
      const shipmentDate =
        order.shipmentDate instanceof Date
          ? order.shipmentDate
          : new Date(order.shipmentDate as unknown as string);

      transactionEntries.push({
        id: order.id,
        transactionType: 'sales_order',
        transactionDate: shipmentDate.toISOString(),
        referenceNumber: order.orderNumber,
        referenceId: order.id,
        description: `厂家直发 ${order.orderNumber}`,
        debitAmount: Number(order.receivableAmount ?? 0),
        creditAmount: 0,
        status: order.status,
      });
    }

    if (factoryOrders.length < pageSize) {
      break;
    }

    factoryOrderCursor = factoryOrders[factoryOrders.length - 1]?.id;
    if (!factoryOrderCursor) {
      break;
    }
  }

  // 2. 获取收款记录
  let paymentCursor: string | undefined;
  while (true) {
    const payments = await prisma.paymentRecord.findMany({
      where: {
        customerId,
        status: { in: ['pending', 'confirmed', 'applied'] },
        paymentType: 'order_payment',
        paymentDate: dateFilter,
      },
      select: {
        id: true,
        paymentNumber: true,
        paymentAmount: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(paymentCursor ? { cursor: { id: paymentCursor }, skip: 1 } : {}),
    });

    for (const payment of payments) {
      // 只在对账明细中展示“已完成/已冲抵”的收款
      // 待确认收款不在对账单中出现，避免给销售造成“已经收款”的错觉
      const isCompleted =
        payment.status === 'confirmed' || payment.status === 'applied';

      if (!isCompleted) {
        continue;
      }

      const paymentMethodLabel = formatStatementPaymentMethod(
        payment.paymentMethod
      );

      transactionEntries.push({
        id: payment.id,
        transactionType: 'payment_in',
        transactionDate: payment.paymentDate.toISOString(),
        referenceNumber: payment.paymentNumber,
        referenceId: payment.id,
        description: `收款 ${payment.paymentNumber} (${paymentMethodLabel})`,
        debitAmount: 0,
        creditAmount: Number(payment.paymentAmount),
        status: payment.status,
      });
    }

    if (payments.length < pageSize) {
      break;
    }

    paymentCursor = payments[payments.length - 1]?.id;
    if (!paymentCursor) {
      break;
    }
  }

  // 3. 获取退货订单（包含所有非草稿状态，用于完整的历史记录）
  // 注意：已取消/已拒绝的订单也会显示，但在计算余额时会被排除
  let returnOrderCursor: string | undefined;
  while (true) {
    const returnOrders = await prisma.returnOrder.findMany({
      where: {
        customerId,
        status: { not: 'draft' }, // 排除草稿，其他所有状态都包含
        createdAt: dateFilter,
      },
      select: {
        id: true,
        returnNumber: true,
        refundAmount: true,
        createdAt: true,
        status: true,
        type: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(returnOrderCursor
        ? { cursor: { id: returnOrderCursor }, skip: 1 }
        : {}),
    });

    for (const returnOrder of returnOrders) {
      // 已取消或已拒绝的退货订单：显示在明细中但金额为0（不影响余额）
      const isInvalidStatus = ['cancelled', 'rejected'].includes(
        returnOrder.status
      );
      const effectiveRefundAmount = isInvalidStatus
        ? 0
        : Number(returnOrder.refundAmount);

      const description = isInvalidStatus
        ? `销售退货 ${returnOrder.returnNumber} (已${returnOrder.status === 'cancelled' ? '取消' : '拒绝'})`
        : `销售退货 ${returnOrder.returnNumber}`;

      transactionEntries.push({
        id: returnOrder.id,
        transactionType: 'sales_return',
        transactionDate: returnOrder.createdAt.toISOString(),
        referenceNumber: returnOrder.returnNumber,
        referenceId: returnOrder.id,
        description,
        debitAmount: 0,
        creditAmount: effectiveRefundAmount,
        status: returnOrder.status,
      });
    }

    if (returnOrders.length < pageSize) {
      break;
    }

    returnOrderCursor = returnOrders[returnOrders.length - 1]?.id;
    if (!returnOrderCursor) {
      break;
    }
  }

  // 4. 获取退款记录
  let refundCursor: string | undefined;
  while (true) {
    const refunds = await prisma.refundRecord.findMany({
      where: {
        customerId,
        status: { in: ['pending', 'processing', 'completed'] },
        refundDate: dateFilter,
      },
      select: {
        id: true,
        refundNumber: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        refundDate: true,
        refundMethod: true,
        refundType: true,
        status: true,
        returnOrderId: true,
        returnOrderNumber: true,
        returnOrder: {
          select: {
            refundAmount: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(refundCursor ? { cursor: { id: refundCursor }, skip: 1 } : {}),
    });

    for (const refund of refunds) {
      const { effectiveProcessed, effectiveRemaining } =
        normalizeRefundAmounts(refund);

      const refundMethodLabel = formatStatementRefundMethod(
        refund.refundMethod
      );

      const descriptionParts = [
        `退款 ${refund.refundNumber} (${refundMethodLabel})`,
      ];

      if (effectiveRemaining > 0) {
        descriptionParts.push(`待退 ${effectiveRemaining.toFixed(2)}`);
      }

      transactionEntries.push({
        id: refund.id,
        transactionType: 'refund_out',
        transactionDate: refund.refundDate.toISOString(),
        referenceNumber: refund.refundNumber,
        referenceId: refund.id,
        description: descriptionParts.join(' / '),
        debitAmount: 0,
        creditAmount: effectiveProcessed,
        status: refund.status,
      });
    }

    if (refunds.length < pageSize) {
      break;
    }

    refundCursor = refunds[refunds.length - 1]?.id;
    if (!refundCursor) {
      break;
    }
  }

  // 5. 获取预收款记录
  let prepaymentCursor: string | undefined;
  while (true) {
    const prepaymentRecords = await prisma.paymentRecord.findMany({
      where: {
        customerId,
        paymentType: 'prepayment',
        status: { in: ['confirmed', 'applied'] },
        paymentDate: dateFilter,
      },
      select: {
        id: true,
        paymentNumber: true,
        paymentAmount: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(prepaymentCursor
        ? { cursor: { id: prepaymentCursor }, skip: 1 }
        : {}),
    });

    for (const prepayment of prepaymentRecords) {
      const paymentMethodLabel = formatStatementPaymentMethod(
        prepayment.paymentMethod
      );

      transactionEntries.push({
        id: prepayment.id,
        transactionType: 'prepayment_in',
        transactionDate: prepayment.paymentDate.toISOString(),
        referenceNumber: prepayment.paymentNumber,
        referenceId: prepayment.id,
        description: `预收款 ${prepayment.paymentNumber} (${paymentMethodLabel})`,
        debitAmount: 0,
        creditAmount: Number(prepayment.paymentAmount), // 减少应收
        status: prepayment.status,
      });
    }

    if (prepaymentRecords.length < pageSize) {
      break;
    }

    prepaymentCursor = prepaymentRecords[prepaymentRecords.length - 1]?.id;
    if (!prepaymentCursor) {
      break;
    }
  }

  // 6. 获取预付款记录(客户作为供应商场景)
  if (customerAsSupplier) {
    let supplierPrepaymentCursor: string | undefined;
    while (true) {
      const supplierPrepayments = await prisma.paymentOutRecord.findMany({
        where: {
          supplierId: customerAsSupplier.id,
          status: 'confirmed',
          paymentDate: dateFilter,
        },
        select: {
          id: true,
          paymentNumber: true,
          paymentAmount: true,
          paymentDate: true,
          paymentMethod: true,
          status: true,
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(supplierPrepaymentCursor
          ? { cursor: { id: supplierPrepaymentCursor }, skip: 1 }
          : {}),
      });

      for (const payment of supplierPrepayments) {
        const paymentMethodLabel = formatStatementPaymentMethod(
          payment.paymentMethod
        );

      transactionEntries.push({
        id: payment.id,
        transactionType: 'prepayment_out',
        transactionDate: payment.paymentDate.toISOString(),
        referenceNumber: payment.paymentNumber,
        referenceId: payment.id,
        description: `预付款 ${payment.paymentNumber} (${paymentMethodLabel})`,
        debitAmount: Number(payment.paymentAmount), // ✅ 预付款会减少应付/增加预付
        creditAmount: 0,
        status: payment.status,
      });
    }

      if (supplierPrepayments.length < pageSize) {
        break;
      }

      supplierPrepaymentCursor =
        supplierPrepayments[supplierPrepayments.length - 1]?.id;
      if (!supplierPrepaymentCursor) {
        break;
      }
    }
  }

  // 按日期升序排序（用于正确计算余额）
  const sortedTransactions = [...transactionEntries].sort((a, b) => {
    const dateDiff =
      new Date(a.transactionDate).getTime() -
      new Date(b.transactionDate).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    const typeDiff = a.transactionType.localeCompare(b.transactionType);
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  let runningBalance = openingBalance;

  return sortedTransactions.map(transaction => {
    runningBalance = roundCurrency(
      runningBalance +
        Number(transaction.debitAmount) -
        Number(transaction.creditAmount)
    );
    return {
      ...transaction,
      balance: runningBalance,
    };
  });
}

/**
 * 计算期初余额
 */
async function calculateOpeningBalance(
  customerId: string,
  beforeDate: string
): Promise<number> {
  const end = new Date(new Date(beforeDate).getTime() - 1);
  const dateFilter: Prisma.DateTimeFilter = { lte: end };

  const [
    salesOrderAggregate,
    factoryOrderAggregate,
    returnOrderAggregate,
    paymentGroups,
    refundAggregate,
    refundAggregateFallback,
    customerAsSupplier,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: {
        customerId,
        status: { in: ['confirmed', 'shipped', 'completed'] },
        createdAt: dateFilter,
      },
      _sum: { totalAmount: true, roundingAdjustment: true },
    }),
    prisma.factoryShipmentOrder.aggregate({
      where: {
        customerId,
        status: { notIn: ['draft', 'cancelled'] },
        receivableAmount: { gt: 0 },
        shipmentDate: dateFilter,
      },
      _sum: { receivableAmount: true },
    }),
    prisma.returnOrder.aggregate({
      where: {
        customerId,
        status: { in: ['submitted', 'approved', 'processing', 'completed'] },
        createdAt: dateFilter,
      },
      _sum: { refundAmount: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['paymentType'],
      where: {
        customerId,
        status: { in: ['confirmed', 'applied'] },
        paymentType: { in: ['order_payment', 'prepayment'] },
        paymentDate: dateFilter,
      },
      _sum: { paymentAmount: true },
    }),
    prisma.refundRecord.aggregate({
      where: {
        customerId,
        status: { in: ['pending', 'processing', 'completed'] },
        refundDate: dateFilter,
      },
      _sum: { processedAmount: true },
    }),
    prisma.refundRecord.aggregate({
      where: {
        customerId,
        status: 'completed',
        processedAmount: 0,
        refundDate: dateFilter,
      },
      _sum: { refundAmount: true },
    }),
    findSupplierForCustomer(customerId),
  ]);

  const salesAmountFromOrders =
    Number(salesOrderAggregate._sum.totalAmount ?? 0) +
    Number(salesOrderAggregate._sum.roundingAdjustment ?? 0);

  const salesAmountFromFactory = Number(
    factoryOrderAggregate._sum.receivableAmount ?? 0
  );

  const salesAmount = salesAmountFromOrders + salesAmountFromFactory;

  const salesReturnAmount = Number(returnOrderAggregate._sum.refundAmount ?? 0);

  let paymentReceived = 0;
  let prepaymentReceived = 0;

  for (const group of paymentGroups) {
    if (group.paymentType === 'order_payment') {
      paymentReceived = Number(group._sum.paymentAmount ?? 0);
      continue;
    }

    if (group.paymentType === 'prepayment') {
      prepaymentReceived = Number(group._sum.paymentAmount ?? 0);
    }
  }

  const refundPaid =
    Number(refundAggregate._sum.processedAmount ?? 0) +
    Number(refundAggregateFallback._sum.refundAmount ?? 0);

  const receivableBalance = computeReceivableBalance({
    salesAmount,
    salesReturnAmount,
    paymentReceived,
    prepaymentReceived,
    refundPaid,
  });

  let prepaymentPaid = 0;

  if (customerAsSupplier) {
    const supplierPaymentAggregate = await prisma.paymentOutRecord.aggregate({
      where: {
        supplierId: customerAsSupplier.id,
        status: { in: ['confirmed'] },
        paymentDate: dateFilter,
      },
      _sum: { paymentAmount: true },
    });

    prepaymentPaid = Number(supplierPaymentAggregate._sum.paymentAmount ?? 0);
  }

  const payableBalance = computePayableBalance({
    purchaseAmount: 0,
    purchaseReturnAmount: 0,
    paymentPaid: 0,
    prepaymentPaid,
    refundReceived: 0,
  });

  return roundCurrency(receivableBalance - payableBalance);
}
