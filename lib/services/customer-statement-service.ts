// 客户对账单服务层
// 提供客户对账单的查询、计算和导出功能

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  CustomerStatementDetail,
  CustomerStatementListItem,
  CustomerStatementQuery,
  CustomerStatementStatistics,
  CustomerStatementSummary,
  CustomerStatementTransaction,
} from '@/lib/types/customer-statement';

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

  // 查询所有符合条件的客户
  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  // 为每个客户计算对账单数据
  const statementsWithBalance = await Promise.all(
    customers.map(async customer => {
      const summary = await calculateCustomerStatementSummary(
        customer.id,
        startDate,
        endDate
      );

      const lastTransaction = await getLastTransactionDate(
        customer.id,
        startDate,
        endDate
      );

      const transactionCount = await getTransactionCount(
        customer.id,
        startDate,
        endDate
      );

      return {
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone || undefined,
        lastTransactionDate: lastTransaction,
        summary,
        transactionCount,
      };
    })
  );

  // 根据余额类型筛选
  let filteredStatements = statementsWithBalance;

  if (balanceType === 'receivable') {
    filteredStatements = filteredStatements.filter(
      s => s.summary.receivables.receivableBalance > 0
    );
  } else if (balanceType === 'payable') {
    filteredStatements = filteredStatements.filter(
      s => s.summary.payables.payableBalance > 0
    );
  }

  // 根据余额范围筛选
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

  // 排序
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
          a.summary.payables.payableBalance - b.summary.payables.payableBalance;
        break;
      case 'lastTransactionDate':
        compareValue =
          new Date(a.lastTransactionDate || 0).getTime() -
          new Date(b.lastTransactionDate || 0).getTime();
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // 分页
  const total = filteredStatements.length;
  const paginatedStatements = filteredStatements.slice(skip, skip + pageSize);

  return {
    statements: paginatedStatements,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
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
async function calculateCustomerStatementSummary(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<CustomerStatementSummary> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate);
  }

  // 1. 查询销售订单(应收)
  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      customerId,
      status: { in: ['confirmed', 'shipped', 'completed'] },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    },
    select: { totalAmount: true },
  });

  const salesAmount = salesOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0
  );

  // 2. 查询销售退货(冲减应收)
  const returnOrders = await prisma.returnOrder.findMany({
    where: {
      customerId,
      status: { in: ['approved', 'processing', 'completed'] },
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
  const payments = await prisma.paymentRecord.findMany({
    where: {
      customerId,
      status: { in: ['pending', 'confirmed', 'applied'] }, // ✅ 覆盖部分收款（待确认）和已冲抵记录
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
  // 注意：当前系统中所有退款都关联退货订单(returnOrderId不为空)
  // 退款金额已在ReturnOrder.refundAmount中统计，此处只查询无退货关联的补偿/折扣类退款
  // 避免重复计算：退货已减少应收，不应再单独计退款
  const refunds = await prisma.refundRecord.findMany({
    where: {
      customerId,
      status: 'completed',
      returnOrderId: null, // 只查询无退货关联的退款(补偿、折扣等)
      ...(Object.keys(dateFilter).length > 0 && { refundDate: dateFilter }),
    },
    select: { refundAmount: true },
  });

  const refundPaid = refunds.reduce(
    (sum, refund) => sum + Number(refund.refundAmount),
    0
  );
  // 当前系统中refundPaid通常为0，因为所有退款都关联退货

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

  const dateFilter = {
    gte: new Date(startDate),
    lte: new Date(endDate),
  };

  // 检查客户是否也作为供应商存在
  const customerAsSupplier = await findSupplierForCustomer(customerId);

  // 1. 获取销售订单
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
    transactionEntries.push({
      id: payment.id,
      transactionType: 'payment_in',
      transactionDate: payment.paymentDate.toISOString(),
      referenceNumber: payment.paymentNumber,
      referenceId: payment.id,
      description: `收款 ${payment.paymentNumber} (${payment.paymentMethod})`,
      debitAmount: 0,
      creditAmount: Number(payment.paymentAmount),
      status: payment.status,
    });
  }

  // 3. 获取退货订单
  const returnOrders = await prisma.returnOrder.findMany({
    where: {
      customerId,
      status: { in: ['approved', 'processing', 'completed'] },
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
    transactionEntries.push({
      id: returnOrder.id,
      transactionType: 'sales_return',
      transactionDate: returnOrder.createdAt.toISOString(),
      referenceNumber: returnOrder.returnNumber,
      referenceId: returnOrder.id,
      description: `销售退货 ${returnOrder.returnNumber}`,
      debitAmount: 0,
      creditAmount: Number(returnOrder.refundAmount),
      status: returnOrder.status,
    });
  }

  // 4. 获取退款记录
  // 注意：只查询无退货关联的退款(补偿、折扣等)
  // 退货关联的退款已在退货记录中体现，不应重复记录
  const refunds = await prisma.refundRecord.findMany({
    where: {
      customerId,
      status: 'completed',
      returnOrderId: null, // 只查询无退货关联的退款
      refundDate: dateFilter,
    },
    select: {
      id: true,
      refundNumber: true,
      refundAmount: true,
      refundDate: true,
      refundMethod: true,
      refundType: true,
      status: true,
    },
    orderBy: { refundDate: 'asc' },
  });

  // 无退货关联的退款作为借方(增加应收)
  // 例如：质量补偿、价格调整等，客户又欠我们的
  for (const refund of refunds) {
    transactionEntries.push({
      id: refund.id,
      transactionType: 'refund_out',
      transactionDate: refund.refundDate.toISOString(),
      referenceNumber: refund.refundNumber,
      referenceId: refund.id,
      description: `${refund.refundType === 'compensation_refund' ? '补偿退款' : '退款'} ${refund.refundNumber} (${refund.refundMethod})`,
      debitAmount: Number(refund.refundAmount), // 借方：增加应收
      creditAmount: 0,
      status: refund.status,
    });
  }
  // 当前系统中通常无记录，因为所有退款都关联退货

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
      prepayment.appliedAmount !== null && prepayment.appliedAmount !== undefined
        ? prepayment.appliedAmount
        : prepayment.paymentAmount;

    transactionEntries.push({
      id: prepayment.id,
      transactionType: 'prepayment_in',
      transactionDate: prepayment.paymentDate.toISOString(),
      referenceNumber: prepayment.paymentNumber,
      referenceId: prepayment.id,
      description: `预收款 ${prepayment.paymentNumber} (${prepayment.paymentMethod})`,
      debitAmount: 0,
      creditAmount: Number(appliedAmount), // 贷方：减少应收
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
      transactionEntries.push({
        id: payment.id,
        transactionType: 'prepayment_out',
        transactionDate: payment.paymentDate.toISOString(),
        referenceNumber: payment.paymentNumber,
        referenceId: payment.id,
        description: `预付款 ${payment.paymentNumber} (${payment.paymentMethod})`,
        debitAmount: Number(payment.paymentAmount), // 借方：增加应付
        creditAmount: 0,
        status: payment.status,
      });
    }
  }

  // 按日期排序
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
async function getLastTransactionDate(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<string | undefined> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate);
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
          ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
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
async function getTransactionCount(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate);
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
