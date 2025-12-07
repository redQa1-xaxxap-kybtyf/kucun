/**
 * 财务统计服务（基于伙伴账本）
 * 通过 AccountStatement / StatementTransaction 统一聚合客户与供应商的往来数据
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { StatementType } from '@/lib/types/statement';

import {
  CUSTOMER_ROLES,
  SUPPLIER_ROLES,
  buildStatementWhere,
  getStatementsOrderBy,
  includesCustomerRole,
  includesSupplierRole,
  mapAccountStatementToSummary,
  type FinanceOverview,
  type FinanceStatistics,
  type FinanceStatisticsParams,
  type FinanceSummary,
  type StatementQueryParams,
  type StatementSummary,
} from './finance-statistics-shared';

export type {
  FinanceOverview,
  FinanceStatistics,
  FinanceStatisticsParams,
  FinanceSummary,
  StatementQueryParams,
  StatementSummary,
} from './finance-statistics-shared';

// ==================== 核心聚合函数 ====================

export async function calculateCustomerStatements(
  customerIds?: string[]
): Promise<StatementSummary[]> {
  const where: Prisma.AccountStatementWhereInput = {
    partnerRole: { in: CUSTOMER_ROLES },
  };

  if (customerIds?.length) {
    where.entityId = { in: customerIds };
  }

  const statements = await prisma.accountStatement.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return statements.map(statement =>
    mapAccountStatementToSummary(statement, 'customer')
  );
}

export async function calculateSupplierStatements(
  supplierIds?: string[]
): Promise<StatementSummary[]> {
  const where: Prisma.AccountStatementWhereInput = {
    partnerRole: { in: SUPPLIER_ROLES },
  };

  if (supplierIds?.length) {
    where.entityId = { in: supplierIds };
  }

  const statements = await prisma.accountStatement.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return statements.map(statement =>
    mapAccountStatementToSummary(statement, 'supplier')
  );
}

export async function getFinanceSummary(
  filterType?: StatementType | 'all'
): Promise<FinanceSummary> {
  const statements = await prisma.accountStatement.findMany({
    select: {
      partnerRole: true,
      currentBalance: true,
    },
  });

  const includeCustomers =
    !filterType || filterType === 'customer' || filterType === 'partner';
  const includeSuppliers =
    !filterType || filterType === 'supplier' || filterType === 'partner';

  const customerStatements = includeCustomers
    ? statements.filter(statement =>
        includesCustomerRole(statement.partnerRole)
      )
    : [];

  const supplierStatements = includeSuppliers
    ? statements.filter(statement =>
        includesSupplierRole(statement.partnerRole)
      )
    : [];

  const totalReceivable = customerStatements.reduce((sum, statement) => {
    const balance = statement.currentBalance ?? 0;
    return sum + Math.max(balance, 0);
  }, 0);

  const totalPayable = supplierStatements.reduce((sum, statement) => {
    const balance = statement.currentBalance ?? 0;
    return sum + Math.max(-balance, 0);
  }, 0);

  return {
    totalCustomers: includeCustomers
      ? statements.filter(statement =>
          includesCustomerRole(statement.partnerRole)
        ).length
      : 0,
    totalSuppliers: includeSuppliers
      ? statements.filter(statement =>
          includesSupplierRole(statement.partnerRole)
        ).length
      : 0,
    totalReceivable,
    totalPayable,
  };
}

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
    search,
    type,
    sortBy,
    sortOrder = 'desc',
    startDate,
    endDate,
  } = params;

  const where = buildStatementWhere({ type, search });
  const orderBy = getStatementsOrderBy(sortBy, sortOrder);
  const skip = (page - 1) * limit;

  if (startDate || endDate) {
    const updatedAtFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      updatedAtFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      updatedAtFilter.lte = end;
    }
    if (Object.keys(updatedAtFilter).length > 0) {
      where.updatedAt = updatedAtFilter;
    }
  }

  // ✅ 修复问题2：统计卡片应基于全量数据，不受分页影响
  // 1. 先查询全量数据用于统计（只查询必要字段）
  const [total, statements, allStatementsForSummary] =
    await prisma.$transaction([
      prisma.accountStatement.count({ where }),
      prisma.accountStatement.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      // 查询全量数据用于统计（不带 skip/take）
      prisma.accountStatement.findMany({
        where,
        select: {
          currentBalance: true,
          partnerRole: true,
          entityId: true,
        },
      }),
    ]);

  const mappedStatements = statements.map(statement =>
    mapAccountStatementToSummary(statement)
  );

  // 2. 基于全量数据计算统计（不受分页影响）
  const customerIds = new Set<string>();
  const supplierIds = new Set<string>();
  let totalReceivable = 0;
  let totalPayable = 0;

  for (const statement of allStatementsForSummary) {
    const balance = statement.currentBalance ?? 0;
    const role = statement.partnerRole;

    if (includesCustomerRole(role)) {
      customerIds.add(statement.entityId);
      totalReceivable += Math.max(balance, 0);
    }

    if (includesSupplierRole(role)) {
      supplierIds.add(statement.entityId);
      totalPayable += Math.max(-balance, 0);
    }
  }

  const summary = {
    totalCustomers: customerIds.size,
    totalSuppliers: supplierIds.size,
    totalReceivable,
    totalPayable,
  };

  return {
    data: mappedStatements,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 1,
    },
    summary,
  };
}

// ==================== 其他统计函数 ====================

export async function getTotalReceivable(): Promise<{
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}> {
  const statements = await prisma.accountStatement.findMany({
    where: { partnerRole: { in: CUSTOMER_ROLES } },
    select: {
      totalAmount: true,
      paidAmount: true,
      currentBalance: true,
    },
  });

  const totalAmount = statements.reduce(
    (sum, statement) => sum + statement.totalAmount,
    0
  );
  const paidAmount = statements.reduce(
    (sum, statement) => sum + statement.paidAmount,
    0
  );
  const pendingAmount = statements.reduce((sum, statement) => {
    const balance = statement.currentBalance ?? 0;
    return sum + Math.max(balance, 0);
  }, 0);

  return {
    totalAmount: Math.abs(totalAmount),
    paidAmount: Math.abs(paidAmount),
    pendingAmount,
  };
}

export async function getTotalRefundable(): Promise<number> {
  const result = await prisma.refundRecord.aggregate({
    _sum: { remainingAmount: true },
    where: {
      status: { in: ['pending', 'processing'] },
      remainingAmount: { gt: 0 },
    },
  });

  return result._sum.remainingAmount ?? 0;
}

export async function getOverdueAmount(): Promise<number> {
  // 逾期逻辑与旧实现保持一致，暂时返回0
  return 0;
}

export async function getMonthlyReceived(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await prisma.statementTransaction.aggregate({
    _sum: { amount: true },
    where: {
      transactionType: { in: ['payment_in', 'prepayment_in'] },
      status: 'completed',
      transactionDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
  });

  return result._sum.amount ?? 0;
}

export async function getOverdueCount(): Promise<number> {
  // 逾期统计占位实现
  return 0;
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const [
    receivableData,
    totalRefundable,
    monthlyReceived,
    statementRoles,
    refundCount,
  ] = await Promise.all([
    getTotalReceivable(),
    getTotalRefundable(),
    getMonthlyReceived(),
    prisma.accountStatement.findMany({
      select: { partnerRole: true, currentBalance: true },
    }),
    prisma.refundRecord.count({
      where: { status: { in: ['pending', 'processing', 'completed'] } },
    }),
  ]);

  const receivableCount = statementRoles.filter(statement => {
    const balance = statement.currentBalance ?? 0;
    return includesCustomerRole(statement.partnerRole) && balance > 0;
  }).length;

  return {
    totalReceivable: receivableData.pendingAmount,
    totalRefundable,
    monthlyReceived,
    receivableCount,
    refundCount,
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

  const whereConditions: Prisma.SalesOrderWhereInput = {};

  if (startDate && endDate) {
    whereConditions.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  if (customerId) {
    whereConditions.customerId = customerId;
  }

  const salesOrderStats = await prisma.salesOrder.aggregate({
    where: whereConditions,
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  const paymentStats = await prisma.paymentRecord.aggregate({
    where: {
      ...(customerId && { customerId }),
      status: 'confirmed',
      ...(startDate &&
        endDate && {
          paymentDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    },
    _sum: { paymentAmount: true },
    _count: { id: true },
  });

  const totalSalesAmount = salesOrderStats._sum.totalAmount || 0;
  const totalPaymentAmount = Number(paymentStats._sum.paymentAmount ?? 0);

  const statisticsData: FinanceStatistics = {
    period: { startDate, endDate },
    sales: {
      totalAmount: totalSalesAmount,
      orderCount: salesOrderStats._count.id || 0,
    },
    payments: {
      totalAmount: totalPaymentAmount,
      paymentCount: paymentStats._count.id || 0,
    },
    receivables: {
      totalAmount: totalSalesAmount - totalPaymentAmount,
      paymentRate:
        totalSalesAmount && totalSalesAmount > 0
          ? (totalPaymentAmount / totalSalesAmount) * 100
          : 0,
    },
  };

  if (includeRefunds) {
    const refundStats = await prisma.refundRecord.aggregate({
      where: {
        status: { in: ['pending', 'processing', 'completed'] },
        ...(customerId && { customerId }),
        ...(startDate &&
          endDate && {
            refundDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
      },
      _sum: { refundAmount: true },
      _count: { id: true },
    });

    statisticsData.refunds = {
      totalAmount: Number(refundStats._sum.refundAmount ?? 0),
      refundCount: refundStats._count.id || 0,
    };
  }

  if (includeStatements) {
    const statementSummary = await getFinanceSummary();
    statisticsData.statements = {
      customerCount: statementSummary.totalCustomers,
      supplierCount: statementSummary.totalSuppliers,
      totalReceivable: statementSummary.totalReceivable,
      totalPayable: statementSummary.totalPayable,
    };
  }

  return statisticsData;
}
