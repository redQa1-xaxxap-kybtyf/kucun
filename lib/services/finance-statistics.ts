/**
 * 财务统计服务（基于伙伴账本）
 * 通过 AccountStatement / StatementTransaction 统一聚合客户与供应商的往来数据
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getSystemMode } from '@/lib/services/system-mode-service';
import type { StatementType } from '@/lib/types/statement';
import { toNumber } from '@/lib/utils/number';

import {
  CUSTOMER_ROLES,
  SUPPLIER_ROLES,
  buildStatementWhere,
  getStatementsOrderBy,
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

const accountStatementSummarySelect = {
  entityId: true,
  entityName: true,
  entityType: true,
  partnerRole: true,
  status: true,
  totalOrders: true,
  totalAmount: true,
  paidAmount: true,
  currentBalance: true,
  lastTransactionDate: true,
  lastPaymentDate: true,
} satisfies Prisma.AccountStatementSelect;

type AccountStatementSummaryRow = Prisma.AccountStatementGetPayload<{
  select: typeof accountStatementSummarySelect;
}>;

async function fetchAccountStatementSummaries(
  where: Prisma.AccountStatementWhereInput
) {
  const statements: AccountStatementSummaryRow[] = [];
  const pageSize = 2000;
  let cursor: string | undefined;

  while (true) {
    const page = await prisma.accountStatement.findMany({
      where,
      select: accountStatementSummarySelect,
      orderBy: [{ updatedAt: 'desc' }, { entityId: 'desc' }],
      take: pageSize,
      ...(cursor ? { cursor: { entityId: cursor }, skip: 1 } : {}),
    });

    statements.push(...page);
    if (page.length < pageSize) {
      break;
    }

    cursor = page[page.length - 1]?.entityId;
    if (!cursor) {
      break;
    }
  }

  return statements;
}

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

  const statements = customerIds?.length
    ? await prisma.accountStatement.findMany({
        where,
        select: accountStatementSummarySelect,
        orderBy: [{ updatedAt: 'desc' }, { entityId: 'desc' }],
        take: customerIds.length,
      })
    : await fetchAccountStatementSummaries(where);

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

  const statements = supplierIds?.length
    ? await prisma.accountStatement.findMany({
        where,
        select: accountStatementSummarySelect,
        orderBy: [{ updatedAt: 'desc' }, { entityId: 'desc' }],
        take: supplierIds.length,
      })
    : await fetchAccountStatementSummaries(where);

  return statements.map(statement =>
    mapAccountStatementToSummary(statement, 'supplier')
  );
}

export async function getFinanceSummary(
  filterType?: StatementType | 'all'
): Promise<FinanceSummary> {
  const includeCustomers =
    !filterType || filterType === 'customer' || filterType === 'partner';
  const includeSuppliers =
    !filterType || filterType === 'supplier' || filterType === 'partner';

  const [totalCustomers, totalSuppliers, receivableAgg, payableAgg] =
    await Promise.all([
      includeCustomers
        ? prisma.accountStatement.count({
            where: { partnerRole: { in: CUSTOMER_ROLES } },
          })
        : Promise.resolve(0),
      includeSuppliers
        ? prisma.accountStatement.count({
            where: { partnerRole: { in: SUPPLIER_ROLES } },
          })
        : Promise.resolve(0),
      includeCustomers
        ? prisma.accountStatement.aggregate({
            where: {
              partnerRole: { in: CUSTOMER_ROLES },
              currentBalance: { gt: 0 },
            },
            _sum: { currentBalance: true },
          })
        : Promise.resolve(null),
      includeSuppliers
        ? prisma.accountStatement.aggregate({
            where: {
              partnerRole: { in: SUPPLIER_ROLES },
              currentBalance: { lt: 0 },
            },
            _sum: { currentBalance: true },
          })
        : Promise.resolve(null),
    ]);

  const totalReceivable = includeCustomers
    ? toNumber(receivableAgg?._sum.currentBalance)
    : 0;
  const totalPayable = includeSuppliers
    ? Math.abs(toNumber(payableAgg?._sum.currentBalance))
    : 0;

  return {
    totalCustomers,
    totalSuppliers,
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
    const transactionDateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      transactionDateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      transactionDateFilter.lte = end;
    }
    if (Object.keys(transactionDateFilter).length > 0) {
      const dateWhere: Prisma.AccountStatementWhereInput = {
        OR: [
          { lastTransactionDate: transactionDateFilter },
          { lastTransactionDate: null, lastPaymentDate: transactionDateFilter },
        ],
      };

      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [...existingAnd, dateWhere];
    }
  }

  // ✅ 修复问题2：统计卡片应基于全量数据，不受分页影响
  // 1. 先查询全量数据用于统计（只查询必要字段）
  const [
    total,
    statements,
    customerCount,
    supplierCount,
    receivableAgg,
    payableAgg,
  ] = await Promise.all([
    prisma.accountStatement.count({ where }),
    prisma.accountStatement.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: accountStatementSummarySelect,
    }),
    prisma.accountStatement.count({
      where: {
        AND: [where, { partnerRole: { in: CUSTOMER_ROLES } }],
      },
    }),
    prisma.accountStatement.count({
      where: {
        AND: [where, { partnerRole: { in: SUPPLIER_ROLES } }],
      },
    }),
    prisma.accountStatement.aggregate({
      where: {
        AND: [
          where,
          { partnerRole: { in: CUSTOMER_ROLES }, currentBalance: { gt: 0 } },
        ],
      },
      _sum: { currentBalance: true },
    }),
    prisma.accountStatement.aggregate({
      where: {
        AND: [
          where,
          { partnerRole: { in: SUPPLIER_ROLES }, currentBalance: { lt: 0 } },
        ],
      },
      _sum: { currentBalance: true },
    }),
  ]);

  const mappedStatements = statements.map(statement =>
    mapAccountStatementToSummary(statement)
  );

  const summary = {
    totalCustomers: customerCount,
    totalSuppliers: supplierCount,
    totalReceivable: toNumber(receivableAgg._sum.currentBalance),
    totalPayable: Math.abs(toNumber(payableAgg._sum.currentBalance)),
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
  const [totals, pending] = await Promise.all([
    prisma.accountStatement.aggregate({
      where: { partnerRole: { in: CUSTOMER_ROLES } },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
    }),
    prisma.accountStatement.aggregate({
      where: { partnerRole: { in: CUSTOMER_ROLES }, currentBalance: { gt: 0 } },
      _sum: {
        currentBalance: true,
      },
    }),
  ]);

  const totalAmount = toNumber(totals._sum.totalAmount);
  const paidAmount = toNumber(totals._sum.paidAmount);
  const pendingAmount = toNumber(pending._sum.currentBalance);

  return {
    totalAmount: Math.abs(totalAmount),
    paidAmount: Math.abs(paidAmount),
    pendingAmount,
  };
}

export async function getTotalRefundable(): Promise<number> {
  const systemMode = await getSystemMode();
  const result = await prisma.refundRecord.aggregate({
    _sum: { remainingAmount: true },
    where: {
      status: { in: ['pending', 'processing'] },
      remainingAmount: { gt: 0 },
      voidedAt: null,
      ...(systemMode === 'production' ? { dataTag: 'prod' } : {}),
    },
  });

  return toNumber(result._sum.remainingAmount);
}

export async function getOverdueAmount(): Promise<number> {
  // 逾期逻辑与旧实现保持一致，暂时返回0
  return 0;
}

export async function getMonthlyReceived(): Promise<number> {
  const systemMode = await getSystemMode();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await prisma.paymentRecord.aggregate({
    _sum: { actualPaymentAmount: true },
    where: {
      status: 'confirmed',
      voidedAt: null,
      ...(systemMode === 'production' ? { dataTag: 'prod' } : {}),
      paymentDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
      actualPaymentAmount: { gt: 0 },
    },
  });

  return toNumber(result._sum.actualPaymentAmount);
}

export async function getOverdueCount(): Promise<number> {
  // 逾期统计占位实现
  return 0;
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const systemMode = await getSystemMode();
  const refundVisibility =
    systemMode === 'production'
      ? ({ voidedAt: null, dataTag: 'prod' } as const)
      : ({ voidedAt: null } as const);
  const [
    receivableData,
    totalRefundable,
    monthlyReceived,
    receivableCount,
    refundCount,
  ] = await Promise.all([
    getTotalReceivable(),
    getTotalRefundable(),
    getMonthlyReceived(),
    prisma.accountStatement.count({
      where: {
        partnerRole: { in: CUSTOMER_ROLES },
        currentBalance: { gt: 0 },
      },
    }),
    prisma.refundRecord.count({
      where: {
        status: { in: ['pending', 'processing', 'completed'] },
        ...refundVisibility,
      },
    }),
  ]);

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

  const totalSalesAmount = toNumber(salesOrderStats._sum.totalAmount);
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
