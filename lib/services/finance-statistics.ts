/**
 * 财务统计服务
 * 基于真实业务数据计算客户和供应商的往来账务统计
 * 聚合销售订单、付款记录、退款记录等数据
 */

import { prisma } from '@/lib/db';

// 财务概览数据类型
export interface FinanceOverview {
  totalReceivable: number;
  totalRefundable: number;
  overdueAmount: number;
  monthlyReceived: number;
  receivableCount: number;
  refundCount: number;
  overdueCount: number;
  summary: {
    totalOrders: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentRate: number;
  };
}

// 财务统计查询参数类型
export interface FinanceStatisticsParams {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  includeRefunds?: boolean;
  includeStatements?: boolean;
}

// 财务统计数据类型
export interface FinanceStatistics {
  period: {
    startDate?: string;
    endDate?: string;
  };
  sales: {
    totalAmount: number;
    orderCount: number;
  };
  payments: {
    totalAmount: number;
    paymentCount: number;
  };
  receivables: {
    totalAmount: number;
    paymentRate: number;
  };
  refunds?: {
    totalAmount: number;
    refundCount: number;
  };
  statements?: {
    customerCount: number;
    supplierCount: number;
    totalReceivable: number;
    totalPayable: number;
  };
}

// 往来账单统计数据类型
export interface StatementSummary {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  lastTransactionDate: string | null;
  creditLimit: number;
  paymentTerms: string;
}

// 统计汇总数据类型
export interface FinanceSummary {
  totalCustomers: number;
  totalSuppliers: number;
  totalReceivable: number;
  totalPayable: number;
}

// 查询参数类型
export interface StatementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'customer' | 'supplier';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 计算客户往来账务统计
 */
export async function calculateCustomerStatements(
  customerIds?: string[]
): Promise<StatementSummary[]> {
  const whereClause = customerIds ? { id: { in: customerIds } } : {};

  const customers = await prisma.customer.findMany({
    where: whereClause,
    include: {
      salesOrders: {
        where: {
          // 问题2修复：只处理有效的订单状态，过滤掉draft、cancelled等无效单据
          status: {
            in: ['confirmed', 'shipped', 'completed'],
          },
        },
        include: {
          payments: true,
          refunds: true,
        },
      },
    },
  });

  const statements: StatementSummary[] = [];

  for (const customer of customers) {
    // 计算总订单数和总金额
    const totalOrders = customer.salesOrders.length;
    const totalAmount = customer.salesOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    // 计算已付金额
    const paidAmount = customer.salesOrders.reduce((sum, order) => {
      const orderPaidAmount = order.payments
        .filter(payment => payment.status === 'confirmed')
        .reduce((paySum, payment) => paySum + payment.paymentAmount, 0);
      return sum + orderPaidAmount;
    }, 0);

    // 计算退款金额
    const refundAmount = customer.salesOrders.reduce((sum, order) => {
      const orderRefundAmount = order.refunds
        .filter(refund => refund.status === 'completed')
        .reduce((refundSum, refund) => refundSum + refund.refundAmount, 0);
      return sum + orderRefundAmount;
    }, 0);

    // 问题1修复：退款应该减少应收款，修正计算公式
    // 正确公式：待收金额 = 总金额 - 已付金额 - 退款金额
    const pendingAmount = Math.max(0, totalAmount - paidAmount - refundAmount);

    // 计算逾期金额（简化逻辑：假设超过30天未付款的为逾期）
    const overdueAmount = await calculateOverdueAmount(customer.id, 'customer');

    // 获取最后交易日期
    const lastTransactionDate = await getLastTransactionDate(
      customer.id,
      'customer'
    );

    statements.push({
      id: customer.id,
      name: customer.name,
      type: 'customer',
      totalOrders,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      lastTransactionDate,
      creditLimit: 50000, // 默认信用额度，实际应从客户扩展信息中获取
      paymentTerms: '30天', // 默认付款条件
    });
  }

  return statements;
}

/**
 * 计算供应商往来账务统计
 */
export async function calculateSupplierStatements(
  supplierIds?: string[]
): Promise<StatementSummary[]> {
  const whereClause = supplierIds ? { id: { in: supplierIds } } : {};

  const suppliers = await prisma.supplier.findMany({
    where: whereClause,
    include: {
      salesOrders: {
        where: {
          orderType: 'TRANSFER', // 调货销售订单
          // 问题2修复：只处理有效的订单状态
          status: {
            in: ['confirmed', 'shipped', 'completed'],
          },
        },
        include: {
          // 问题3修复：包含付款记录以计算已付金额
          payments: {
            where: {
              status: 'confirmed',
            },
          },
        },
      },
      factoryShipmentOrderItems: {
        include: {
          factoryShipmentOrder: true,
        },
      },
    },
  });

  const statements: StatementSummary[] = [];

  for (const supplier of suppliers) {
    // 计算调货销售订单统计
    const transferOrders = supplier.salesOrders;
    const totalOrders = transferOrders.length;
    const transferAmount = transferOrders.reduce(
      (sum, order) => sum + (order.costAmount || 0),
      0
    );

    // 问题3修复：计算调货销售订单的已付金额
    const transferPaidAmount = transferOrders.reduce((sum, order) => {
      const orderPaidAmount = order.payments.reduce(
        (paySum, payment) => paySum + payment.paymentAmount,
        0
      );
      return sum + orderPaidAmount;
    }, 0);

    // 计算厂家发货订单统计
    const factoryOrderAmount = supplier.factoryShipmentOrderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    // 问题3修复：厂家发货订单的付款金额从订单本身的paidAmount字段获取
    const factoryPaidAmount = supplier.factoryShipmentOrderItems.reduce(
      (sum, item) => sum + (item.factoryShipmentOrder.paidAmount || 0),
      0
    );

    const totalAmount = transferAmount + factoryOrderAmount;
    const paidAmount = transferPaidAmount + factoryPaidAmount;
    const pendingAmount = Math.max(0, totalAmount - paidAmount);
    const overdueAmount = await calculateOverdueAmount(supplier.id, 'supplier');

    // 获取最后交易日期
    const lastTransactionDate = await getLastTransactionDate(
      supplier.id,
      'supplier'
    );

    statements.push({
      id: supplier.id,
      name: supplier.name,
      type: 'supplier',
      totalOrders,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      lastTransactionDate,
      creditLimit: 100000, // 默认信用额度
      paymentTerms: '30天',
    });
  }

  return statements;
}

/**
 * 计算逾期金额
 */
async function calculateOverdueAmount(
  entityId: string,
  entityType: 'customer' | 'supplier'
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (entityType === 'customer') {
    // 计算客户逾期应收款
    const overdueOrders = await prisma.salesOrder.findMany({
      where: {
        customerId: entityId,
        createdAt: {
          lt: thirtyDaysAgo,
        },
        status: {
          in: ['confirmed', 'shipped'],
        },
      },
      include: {
        payments: {
          where: {
            status: 'confirmed',
          },
        },
      },
    });

    return overdueOrders.reduce((sum, order) => {
      const paidAmount = order.payments.reduce(
        (paySum, payment) => paySum + payment.paymentAmount,
        0
      );
      const unpaidAmount = Math.max(0, order.totalAmount - paidAmount);
      return sum + unpaidAmount;
    }, 0);
  } else {
    // 供应商逾期应付款（简化逻辑）
    return 0;
  }
}

/**
 * 获取最后交易日期
 */
async function getLastTransactionDate(
  entityId: string,
  entityType: 'customer' | 'supplier'
): Promise<string | null> {
  if (entityType === 'customer') {
    const lastOrder = await prisma.salesOrder.findFirst({
      where: {
        customerId: entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : null;
  } else {
    const lastOrder = await prisma.salesOrder.findFirst({
      where: {
        supplierId: entityId,
        orderType: 'TRANSFER',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : null;
  }
}

/**
 * 获取财务汇总统计
 * 问题4修复：支持按类型筛选的财务汇总
 */
export async function getFinanceSummary(
  type?: 'customer' | 'supplier'
): Promise<FinanceSummary> {
  let customerStatements: StatementSummary[] = [];
  let supplierStatements: StatementSummary[] = [];

  // 根据筛选条件分别计算客户和供应商的财务汇总数据
  if (!type || type === 'customer') {
    customerStatements = await calculateCustomerStatements();
  }

  if (!type || type === 'supplier') {
    supplierStatements = await calculateSupplierStatements();
  }

  const totalCustomers = customerStatements.length;
  const totalSuppliers = supplierStatements.length;

  const totalReceivable = customerStatements.reduce(
    (sum, statement) => sum + statement.pendingAmount,
    0
  );

  const totalPayable = supplierStatements.reduce(
    (sum, statement) => sum + statement.pendingAmount,
    0
  );

  return {
    totalCustomers,
    totalSuppliers,
    totalReceivable,
    totalPayable,
  };
}

/**
 * 获取往来账单列表（带分页和筛选）
 */
export async function getStatementsList(params: StatementQueryParams): Promise<{
  data: StatementSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: FinanceSummary;
}> {
  const {
    page = 1,
    limit = 20,
    search = '',
    type,
    sortBy = 'totalAmount',
    sortOrder = 'desc',
  } = params;

  // 获取所有统计数据
  let allStatements: StatementSummary[] = [];

  if (!type || type === 'customer') {
    const customerStatements = await calculateCustomerStatements();
    allStatements.push(...customerStatements);
  }

  if (!type || type === 'supplier') {
    const supplierStatements = await calculateSupplierStatements();
    allStatements.push(...supplierStatements);
  }

  // 应用搜索筛选
  if (search) {
    allStatements = allStatements.filter(statement =>
      statement.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 应用类型筛选
  if (type) {
    allStatements = allStatements.filter(statement => statement.type === type);
  }

  // 排序
  allStatements.sort((a, b) => {
    const aValue = a[sortBy as keyof StatementSummary] as number;
    const bValue = b[sortBy as keyof StatementSummary] as number;

    if (sortOrder === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  // 分页
  const total = allStatements.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = allStatements.slice(startIndex, endIndex);

  // 问题4修复：根据筛选条件计算对应的财务汇总数据
  const summary = await getFinanceSummary(type);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    summary,
  };
}

/**
 * 获取总应收金额
 * 基于销售订单和已收款计算
 */
export async function getTotalReceivable(): Promise<{
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}> {
  const result = await prisma.$queryRaw<
    Array<{ total_amount: number; paid_amount: number }>
  >`
    SELECT
      COALESCE(SUM(so.total_amount), 0) as total_amount,
      COALESCE(SUM(pr.payment_amount), 0) as paid_amount
    FROM sales_orders so
    LEFT JOIN payment_records pr ON so.id = pr.sales_order_id AND pr.status = 'confirmed'
    WHERE so.status IN ('confirmed', 'shipped', 'completed')
  `;

  const data = Array.isArray(result) ? result[0] : result;
  const totalAmount = Number(data?.total_amount || 0);
  const paidAmount = Number(data?.paid_amount || 0);
  const pendingAmount = totalAmount - paidAmount;

  return { totalAmount, paidAmount, pendingAmount };
}

/**
 * 获取总应退金额
 * 基于 remainingAmount 计算真实待付金额
 */
export async function getTotalRefundable(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ total_refundable: number }>>`
    SELECT COALESCE(SUM(remaining_amount), 0) as total_refundable
    FROM refund_records
    WHERE status IN ('pending', 'processing') AND remaining_amount > 0
  `;

  const data = Array.isArray(result) ? result[0] : result;
  return Number(data?.total_refundable || 0);
}

/**
 * 获取逾期金额
 * 基于销售订单创建时间超过30天的未付款订单
 */
export async function getOverdueAmount(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ overdue_amount: number }>>`
    SELECT COALESCE(SUM(so.total_amount - COALESCE(pr.paid_amount, 0)), 0) as overdue_amount
    FROM sales_orders so
    LEFT JOIN (
      SELECT sales_order_id, SUM(payment_amount) as paid_amount
      FROM payment_records
      WHERE status = 'confirmed'
      GROUP BY sales_order_id
    ) pr ON so.id = pr.sales_order_id
    WHERE so.status IN ('confirmed', 'shipped', 'completed')
    AND so.created_at < datetime('now', '-30 days')
    AND (so.total_amount - COALESCE(pr.paid_amount, 0)) > 0
  `;

  const data = Array.isArray(result) ? result[0] : result;
  return Number(data?.overdue_amount || 0);
}

/**
 * 获取本月收款金额
 * 基于本月的收款记录
 */
export async function getMonthlyReceived(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ monthly_received: number }>>`
    SELECT COALESCE(SUM(payment_amount), 0) as monthly_received
    FROM payment_records
    WHERE status = 'confirmed'
    AND strftime('%Y-%m', payment_date) = strftime('%Y-%m', datetime('now'))
  `;

  const data = Array.isArray(result) ? result[0] : result;
  return Number(data?.monthly_received || 0);
}

/**
 * 获取逾期订单数量
 */
export async function getOverdueCount(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) as count
    FROM sales_orders so
    LEFT JOIN (
      SELECT sales_order_id, SUM(payment_amount) as paid_amount
      FROM payment_records
      WHERE status = 'confirmed'
      GROUP BY sales_order_id
    ) pr ON so.id = pr.sales_order_id
    WHERE so.status IN ('confirmed', 'shipped', 'completed')
    AND so.created_at < datetime('now', '-30 days')
    AND (so.total_amount - COALESCE(pr.paid_amount, 0)) > 0
  `;

  const data = Array.isArray(result) ? result[0] : result;
  return Number(data?.count || 0);
}

/**
 * 获取财务概览数据
 * 聚合所有财务统计信息
 */
export async function getFinanceOverview(): Promise<FinanceOverview> {
  // 并行获取所有统计数据
  const [
    receivableData,
    totalRefundable,
    overdueAmount,
    monthlyReceived,
    receivableCount,
    refundCount,
    overdueCount,
  ] = await Promise.all([
    getTotalReceivable(),
    getTotalRefundable(),
    getOverdueAmount(),
    getMonthlyReceived(),
    prisma.salesOrder.count({
      where: { status: { in: ['confirmed', 'shipped', 'completed'] } },
    }),
    prisma.refundRecord.count({
      where: { status: { in: ['pending', 'processing', 'completed'] } },
    }),
    getOverdueCount(),
  ]);

  return {
    totalReceivable: receivableData.pendingAmount,
    totalRefundable,
    overdueAmount,
    monthlyReceived,
    receivableCount,
    refundCount,
    overdueCount,
    summary: {
      totalOrders: receivableCount,
      totalAmount: receivableData.totalAmount,
      paidAmount: receivableData.paidAmount,
      pendingAmount: receivableData.pendingAmount,
      paymentRate:
        receivableData.totalAmount > 0
          ? (receivableData.paidAmount / receivableData.totalAmount) * 100
          : 0,
    },
  };
}

/**
 * 获取财务统计数据
 * 根据查询参数获取指定条件的财务统计
 */
export async function getFinanceStatistics(
  params: FinanceStatisticsParams
): Promise<FinanceStatistics> {
  const {
    startDate,
    endDate,
    customerId,
    includeRefunds = true,
    includeStatements = true,
  } = params;

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (startDate && endDate) {
    whereConditions.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  if (customerId) {
    whereConditions.customerId = customerId;
  }

  // 获取销售订单统计
  const salesOrderStats = await prisma.salesOrder.aggregate({
    where: whereConditions,
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  // 获取收款统计
  const paymentStats = await prisma.paymentRecord.aggregate({
    where: { ...whereConditions, status: 'confirmed' },
    _sum: { paymentAmount: true },
    _count: { id: true },
  });

  // 构建基础响应数据
  const statisticsData: FinanceStatistics = {
    period: { startDate, endDate },
    sales: {
      totalAmount: salesOrderStats._sum.totalAmount || 0,
      orderCount: salesOrderStats._count.id || 0,
    },
    payments: {
      totalAmount: paymentStats._sum.paymentAmount || 0,
      paymentCount: paymentStats._count.id || 0,
    },
    receivables: {
      totalAmount:
        (salesOrderStats._sum.totalAmount || 0) -
        (paymentStats._sum.paymentAmount || 0),
      paymentRate: salesOrderStats._sum.totalAmount
        ? ((paymentStats._sum.paymentAmount || 0) /
            salesOrderStats._sum.totalAmount) *
          100
        : 0,
    },
  };

  // 如果需要包含退款数据
  if (includeRefunds) {
    const refundStats = await prisma.refundRecord.aggregate({
      where: {
        ...whereConditions,
        status: { in: ['pending', 'processing', 'completed'] },
      },
      _sum: { refundAmount: true },
      _count: { id: true },
    });

    statisticsData.refunds = {
      totalAmount: refundStats._sum.refundAmount || 0,
      refundCount: refundStats._count.id || 0,
    };
  }

  // 如果需要包含往来账单数据
  if (includeStatements) {
    const customerCount = await prisma.customer.count();
    statisticsData.statements = {
      customerCount,
      supplierCount: 0,
      totalReceivable:
        (salesOrderStats._sum.totalAmount || 0) -
        (paymentStats._sum.paymentAmount || 0),
      totalPayable: 0,
    };
  }

  return statisticsData;
}
