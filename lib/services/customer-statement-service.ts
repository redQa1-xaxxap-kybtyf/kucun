// 客户对账单服务层
// 提供客户对账单的查询、计算和导出功能

import type { Prisma } from '@prisma/client';

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
  const customerWhere: Record<string, unknown> = {};

  if (customerId) {
    customerWhere.id = customerId;
  }

  if (customerName) {
    customerWhere.name = { contains: customerName };
  }

  // ✅ 性能优化：先在 SQL 层进行分页，只查询当前页需要的客户
  // 这样可以避免全表扫描和 O(N) 的数据库查询

  // 1. 先获取符合条件的客户总数（用于分页计算）
  const totalCustomers = await prisma.customer.count({
    where: customerWhere,
  });

  // 2. 使用 SQL 层分页查询客户（只查询当前页需要的数据）
  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: {
      id: true,
      name: true,
      phone: true,
    },
    // ✅ SQL 层排序（如果按客户名称排序）
    ...(sortBy === 'customerName' && {
      orderBy: { name: sortOrder },
    }),
    // ✅ SQL 层分页
    skip,
    take: pageSize,
  });

  // 3. 批量查询所有客户的聚合数据（一次性查询，避免 N 次查询）
  const customerIds = customers.map(c => c.id);

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

  // ✅ 批量聚合查询：销售订单
  const salesAggregates = await prisma.salesOrder.groupBy({
    by: ['customerId'],
    where: {
      customerId: { in: customerIds },
      status: { in: ['confirmed', 'shipped', 'completed'] },
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
    _count: { id: true },
  });

  // ✅ 批量聚合查询：厂家直发订单(按客户汇总应收金额)
  const factoryAggregates = await prisma.factoryShipmentOrder.groupBy({
    by: ['customerId'],
    where: {
      customerId: { in: customerIds },
      status: { notIn: ['draft', 'cancelled'] },
      receivableAmount: { gt: 0 },
      ...(hasDateFilter && { shipmentDate: dateFilter }),
    },
    _sum: { receivableAmount: true },
    _max: { shipmentDate: true },
    _count: { id: true },
  });

  // ✅ 批量聚合查询：退货订单
  const returnAggregates = await prisma.returnOrder.groupBy({
    by: ['customerId'],
    where: {
      customerId: { in: customerIds },
      status: { in: ['submitted', 'approved', 'processing', 'completed'] },
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
    _sum: { refundAmount: true },
    _max: { createdAt: true },
    _count: { id: true },
  });

  // ✅ 批量聚合查询：收款记录
  const paymentAggregates = await prisma.paymentRecord.groupBy({
    by: ['customerId'],
    where: {
      customerId: { in: customerIds },
      // 只统计已完成/已冲抵的收款，待确认收款不影响应收余额
      status: { in: ['confirmed', 'applied'] },
      ...(hasDateFilter && { paymentDate: dateFilter }),
    },
    _sum: { paymentAmount: true, appliedAmount: true },
    _max: { paymentDate: true },
    _count: { id: true },
  });

  // ✅ 批量聚合查询：退款记录
  // 说明：
  // - 退款金额在退货场景(ReturnOrder.refundAmount)中已经作为销售退货统计
  // - 这里只对“补偿退款”(无退货关联的退款)做金额聚合，用于计算 refundPaid
  // - 但为了统计最后交易日期和交易笔数，仍然需要聚合所有退款记录
  const refundAggregates = await prisma.refundRecord.groupBy({
    by: ['customerId', 'returnOrderId'],
    where: {
      customerId: { in: customerIds },
      status: { in: ['pending', 'processing', 'completed'] },
      ...(hasDateFilter && { refundDate: dateFilter }),
    },
    _sum: { processedAmount: true },
    _max: { refundDate: true },
    _count: { id: true },
  });

  // 3.1 额外查询：用于判断“是否有历史交易”（不受当前筛选条件限制）
  // 只要客户历史上有任何一笔交易，就应该能在对账单列表中找到对应客户
  const historyTransactionCounts = await Promise.all(
    customers.map(c => _getTransactionCount(c.id))
  );
  const historyTransactionCountMap = new Map(
    customers.map((c, index) => [c.id, historyTransactionCounts[index]])
  );

  // 4. 构建客户对账单数据（使用聚合结果，避免逐个查询）
  const statementsWithBalance = customers.map(customer => {
    // 从聚合结果中获取数据
    const salesData = salesAggregates.find(s => s.customerId === customer.id);
    const factoryData = factoryAggregates.find(
      f => f.customerId === customer.id
    );
    const returnData = returnAggregates.find(r => r.customerId === customer.id);
    const paymentData = paymentAggregates.find(
      p => p.customerId === customer.id
    );
    const refundsForCustomer = refundAggregates.filter(
      r => r.customerId === customer.id
    );

    // 计算汇总数据
    const salesAmountFromOrders = Number(salesData?._sum.totalAmount ?? 0);
    const salesAmountFromFactory = Number(
      factoryData?._sum.receivableAmount ?? 0
    );
    const salesAmount = salesAmountFromOrders + salesAmountFromFactory;
    const salesReturnAmount = Number(returnData?._sum.refundAmount ?? 0);
    const paymentReceived = Number(paymentData?._sum.paymentAmount ?? 0);
    const prepaymentReceived = Number(paymentData?._sum.appliedAmount ?? 0);

    // 仅统计“补偿退款”(无退货关联)到 refundPaid，避免与退货退款重复计算
    const refundPaid = refundsForCustomer
      .filter(r => r.returnOrderId === null)
      .reduce((sum, r) => sum + Number(r._sum.processedAmount ?? 0), 0);

    // 应收账款 = 销售金额 - 销售退货 - 收款 - 预收款 + 退款
    const receivableBalance =
      salesAmount -
      salesReturnAmount -
      paymentReceived -
      prepaymentReceived +
      refundPaid;

    // 应付账款（暂时为 0，后续实现客户作为供应商的场景）
    const payableBalance = 0;

    // 净余额 = 应收 - 应付
    const netBalance = receivableBalance - payableBalance;

    // 获取最后交易日期
    const lastRefundDate = refundsForCustomer
      .map(r => r._max.refundDate)
      .filter((date): date is Date => date instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const lastTransactionDate = [
      salesData?._max.createdAt,
      factoryData?._max.shipmentDate,
      returnData?._max.createdAt,
      paymentData?._max.paymentDate,
      lastRefundDate,
    ]
      .filter((date): date is Date => date instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    // 计算交易笔数
    const refundCount = refundsForCustomer.reduce(
      (sum, r) => sum + (r._count.id ?? 0),
      0
    );

    const transactionCount =
      (salesData?._count.id ?? 0) +
      (factoryData?._count.id ?? 0) +
      (returnData?._count.id ?? 0) +
      (paymentData?._count.id ?? 0) +
      refundCount;

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
          prepaymentPaid: 0,
          refundReceived: 0,
          payableBalance,
        },
        netBalance,
      },
      transactionCount,
    };
  });

  // ✅ 注意：由于已在 SQL 层分页，这里不需要再次分页
  // 但如果需要按余额等计算字段排序或筛选，需要在内存中处理

  // 第一步：过滤掉「从来没有任何交易」的客户，避免一进系统就看到一堆 0 元对账单
  // 规则：
  // - 如果客户在历史上没有任何交易记录(historyTransactionCount === 0)，并且
  //   当前筛选区间内交易笔数为 0 & 应收/应付余额都为 0，则不显示
  // - 如果客户历史上有交易，即使本期没有交易、余额为 0，也保留在列表中，方便查历史
  let filteredStatements = statementsWithBalance.filter(statement => {
    const historyTransactionCount =
      historyTransactionCountMap.get(statement.customerId) ??
      statement.transactionCount ??
      0;

    const receivableBalance =
      statement.summary.receivables.receivableBalance || 0;
    const payableBalance = statement.summary.payables.payableBalance || 0;

    const hasNonZeroBalance =
      Math.abs(receivableBalance) > 0 || Math.abs(payableBalance) > 0;

    const hasAnyHistory = historyTransactionCount > 0;

    // 从未发生过任何往来：且当前区间内也没有交易、余额都为 0 → 隐藏
    if (
      !hasAnyHistory &&
      statement.transactionCount === 0 &&
      !hasNonZeroBalance
    ) {
      return false;
    }

    return true;
  });

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

  // 排序（如果不是按客户名称排序，需要在内存中排序）
  if (sortBy !== 'customerName') {
    filteredStatements.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
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

  return {
    statements: filteredStatements,
    pagination: {
      page,
      pageSize,
      total: totalCustomers, // ✅ 使用客户总数而非筛选后的数量
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
  const closingBalance = openingBalance + summary.netBalance;

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
  const allCustomers = await prisma.customer.findMany({
    select: { id: true },
  });

  const totalCustomers = allCustomers.length;

  // 计算有往来的客户数
  const activeCustomers = 0; // TODO: 实现逻辑

  // 计算总余额
  let totalReceivableBalance = 0;
  let totalPayableBalance = 0;

  for (const customer of allCustomers) {
    const summary = await calculateCustomerStatementSummary(customer.id);
    totalReceivableBalance += summary.receivables.receivableBalance;
    totalPayableBalance += summary.payables.payableBalance;
  }

  const totalNetBalance = totalReceivableBalance - totalPayableBalance;

  return {
    totalCustomers,
    activeCustomers,
    totalReceivableBalance,
    totalPayableBalance,
    totalNetBalance,
    overdueCustomers: 0, // TODO: 实现逻辑
    monthlyActiveCustomers: 0, // TODO: 实现逻辑
  };
}

type SupplierIdentifier = { id: string };

async function findSupplierForCustomer(
  customerId: string
): Promise<SupplierIdentifier | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, phone: true },
  });

  if (!customer || (!customer.name && !customer.phone)) {
    return null;
  }

  const orConditions: Prisma.SupplierWhereInput[] = [
    ...(customer.name ? [{ name: { contains: customer.name } }] : []),
    ...(customer.phone ? [{ phone: customer.phone }] : []),
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
 * 1. 应收账款 = 销售金额 - 销售退货 - 收款 - 预收款 + 补偿退款
 * 2. 退货退款：退款金额已在ReturnOrder.refundAmount中，不重复计算
 * 3. 补偿退款：无退货关联的退款(returnOrderId=null)，增加应收
 * 4. 当前系统：所有退款都关联退货，补偿退款为0
 */
type RefundRecordForStatement = {
  refundAmount: number | null;
  processedAmount: number | null;
  remainingAmount: number | null;
  status: string;
  returnOrder?: {
    refundAmount: number | null;
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
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    // 包含结束当天整日
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  // 1. 查询销售订单(应收) - 包含所有有效状态
  // pending: 待处理（订单已提交，客户已承诺购买）
  // confirmed: 已确认
  // processing: 处理中
  // confirmed: 已确认
  // shipped: 已发货
  // completed: 已完成
  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      customerId,
      status: { in: ['confirmed', 'shipped', 'completed'] },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    },
    select: { totalAmount: true },
  });

  const salesAmountFromOrders = salesOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0
  );

  // 1.1 查询厂家直发订单(应收) - 视为与销售订单同等口径的应收销售
  const factoryOrders = await prisma.factoryShipmentOrder.findMany({
    where: {
      customerId,
      status: { notIn: ['draft', 'cancelled'] },
      receivableAmount: { gt: 0 },
      ...(Object.keys(dateFilter).length > 0 && { shipmentDate: dateFilter }),
    },
    select: { receivableAmount: true },
  });

  const salesAmountFromFactory = factoryOrders.reduce(
    (sum, order) => sum + Number(order.receivableAmount ?? 0),
    0
  );

  const salesAmount = salesAmountFromOrders + salesAmountFromFactory;

  // 2. 查询销售退货(冲减应收) - 只包含有效状态的订单用于计算余额
  // 注意：不包含已取消(cancelled)和已拒绝(rejected)的订单
  const returnOrders = await prisma.returnOrder.findMany({
    where: {
      customerId,
      status: { in: ['submitted', 'approved', 'processing', 'completed'] },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    },
    select: { refundAmount: true },
  });

  const salesReturnAmount = returnOrders.reduce(
    (sum, order) => sum + Number(order.refundAmount),
    0
  );

  // 3. 查询收款记录
  // ✅ 修正: 分别统计订单付款和预收款已冲抵金额
  // 只统计已完成/已冲抵的收款，待确认收款不减少应收
  const payments = await prisma.paymentRecord.findMany({
    where: {
      customerId,
      status: { in: ['confirmed', 'applied'] },
      ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
    },
    select: {
      paymentType: true, // ✅ 新增: 用于区分类型
      paymentAmount: true,
      appliedAmount: true, // ✅ 新增: 预收款已冲抵金额
    },
  });

  // 订单付款(直接付款)
  const orderPayments = payments.filter(p => p.paymentType === 'order_payment');
  const paymentReceived = orderPayments.reduce(
    (sum, payment) => sum + Number(payment.paymentAmount),
    0
  );

  // 预收款已冲抵金额(减少应收)
  const prepayments = payments.filter(p => p.paymentType === 'prepayment');
  const prepaymentReceived = prepayments.reduce(
    (sum, p) => sum + Number(p.appliedAmount),
    0
  );

  // 4. 查询退款记录(退款给客户)
  const refundRecords = await prisma.refundRecord.findMany({
    where: {
      customerId,
      status: { in: ['pending', 'processing', 'completed'] },
      ...(Object.keys(dateFilter).length > 0 && { refundDate: dateFilter }),
    },
    select: {
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
  });

  const refundCompensationPaid = refundRecords
    .filter(record => record.returnOrderId === null)
    .reduce((sum, record) => {
      const { effectiveProcessed } = normalizeRefundAmounts(record);
      return sum + effectiveProcessed;
    }, 0);

  const refundProcessed = refundRecords.reduce((sum, record) => {
    const { effectiveProcessed } = normalizeRefundAmounts(record);
    return sum + effectiveProcessed;
  }, 0);

  const refundPending = refundRecords.reduce((sum, record) => {
    const { effectiveRemaining } = normalizeRefundAmounts(record);
    return sum + effectiveRemaining;
  }, 0);

  const refundPaid = refundCompensationPaid;

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
    const supplierPayments = await prisma.paymentOutRecord.findMany({
      where: {
        supplierId: customerAsSupplier.id,
        status: { in: ['confirmed'] },
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      select: { paymentAmount: true },
    });

    prepaymentPaid = supplierPayments.reduce(
      (sum, record) => sum + Number(record.paymentAmount),
      0
    );
  }

  // 计算余额
  const receivableBalance =
    salesAmount -
    salesReturnAmount -
    paymentReceived -
    prepaymentReceived +
    refundPaid;
  const payableBalance =
    purchaseAmount -
    purchaseReturnAmount -
    paymentPaid -
    prepaymentPaid +
    refundReceived;
  const netBalance = receivableBalance - payableBalance;

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

  // 1. 获取销售订单 - 包含所有有效状态
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
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const order of salesOrders) {
    transactionEntries.push({
      id: order.id,
      transactionType: 'sales_order',
      transactionDate: order.createdAt.toISOString(),
      referenceNumber: order.orderNumber,
      referenceId: order.id,
      description: `销售订单 ${order.orderNumber}`,
      debitAmount: Number(order.totalAmount),
      creditAmount: 0,
      status: order.status,
    });
  }

  // 1.1 获取厂家直发订单 - 视为同样的“销售订单”, 使用应收金额作为记账金额
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
    orderBy: { shipmentDate: 'asc' },
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

  // 2. 获取收款记录
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
    orderBy: { paymentDate: 'asc' },
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

  // 3. 获取退货订单（包含所有非草稿状态，用于完整的历史记录）
  // 注意：已取消/已拒绝的订单也会显示，但在计算余额时会被排除
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
    orderBy: { createdAt: 'asc' },
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

  // 4. 获取退款记录
  const refunds = await prisma.refundRecord.findMany({
    where: {
      customerId,
      status: { in: ['pending', 'processing', 'completed'] },
      refundDate: dateFilter,
      // 只统计无退货关联的补偿退款，避免与退货退款重复影响应收余额
      returnOrderId: null,
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
    orderBy: { refundDate: 'asc' },
  });

  for (const refund of refunds) {
    const { effectiveProcessed, effectiveRemaining } =
      normalizeRefundAmounts(refund);

    const refundMethodLabel = formatStatementRefundMethod(refund.refundMethod);

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
      debitAmount: effectiveProcessed,
      creditAmount: 0,
      status: refund.status,
    });
  }

  // 5. 获取预收款记录
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
      appliedAmount: true,
      paymentDate: true,
      paymentMethod: true,
      status: true,
    },
    orderBy: { paymentDate: 'asc' },
  });

  for (const prepayment of prepaymentRecords) {
    const appliedAmount =
      prepayment.appliedAmount !== null &&
      prepayment.appliedAmount !== undefined
        ? prepayment.appliedAmount
        : prepayment.paymentAmount;

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
      creditAmount: Number(appliedAmount), // 减少应收
      status: prepayment.status,
    });
  }

  // 6. 获取预付款记录(客户作为供应商场景)
  if (customerAsSupplier) {
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
      orderBy: { paymentDate: 'asc' },
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
        debitAmount: Number(payment.paymentAmount), // 增加应付
        creditAmount: 0,
        status: payment.status,
      });
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
    runningBalance +=
      Number(transaction.debitAmount) - Number(transaction.creditAmount);
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
  const summary = await calculateCustomerStatementSummary(
    customerId,
    undefined,
    new Date(new Date(beforeDate).getTime() - 1).toISOString()
  );
  return summary.netBalance;
}

/**
 * 获取最后交易日期
 */
async function _getLastTransactionDate(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<string | undefined> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const [lastSalesOrder, lastPayment, lastReturn, lastRefund] =
    await Promise.all([
      prisma.salesOrder.findFirst({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.paymentRecord.findFirst({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && {
            paymentDate: dateFilter,
          }),
        },
        orderBy: { paymentDate: 'desc' },
        select: { paymentDate: true },
      }),
      prisma.returnOrder.findFirst({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.refundRecord.findFirst({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && { refundDate: dateFilter }),
        },
        orderBy: { refundDate: 'desc' },
        select: { refundDate: true },
      }),
    ]);

  const latestDate = [
    lastSalesOrder?.createdAt,
    lastPayment?.paymentDate,
    lastReturn?.createdAt,
    lastRefund?.refundDate,
  ]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return latestDate?.toISOString();
}

/**
 * 获取交易笔数
 */
async function _getTransactionCount(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const [salesCount, paymentCount, returnCount, refundCount] =
    await Promise.all([
      prisma.salesOrder.count({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      }),
      prisma.paymentRecord.count({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && {
            paymentDate: dateFilter,
          }),
        },
      }),
      prisma.returnOrder.count({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      }),
      prisma.refundRecord.count({
        where: {
          customerId,
          ...(Object.keys(dateFilter).length > 0 && {
            refundDate: dateFilter,
          }),
        },
      }),
    ]);

  return salesCount + paymentCount + returnCount + refundCount;
}
