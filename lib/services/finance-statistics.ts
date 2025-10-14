/**
 * 财务统计服务（基于伙伴账本）
 * 通过 AccountStatement / StatementTransaction 统一聚合客户与供应商的往来数据
 */

import type {
  AccountStatement as AccountStatementModel,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  PartnerRole,
  StatementStatus,
  StatementType,
} from '@/lib/types/statement';

// ==================== 类型定义 ====================

export interface FinanceOverview {
  totalReceivable: number;
  totalRefundable: number;
  monthlyReceived: number;
  receivableCount: number;
  refundCount: number;
  summary: {
    totalOrders: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentRate: number;
  };
}

export interface FinanceStatisticsParams {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  includeRefunds?: boolean;
  includeStatements?: boolean;
}

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

export interface StatementSummary {
  id: string;
  name: string;
  type: StatementType;
  partnerRole: PartnerRole;
  status: StatementStatus;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
}

export interface FinanceSummary {
  totalCustomers: number;
  totalSuppliers: number;
  totalReceivable: number;
  totalPayable: number;
}

export interface StatementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: StatementType | 'all';
  sortBy?:
    | 'entityName'
    | 'totalAmount'
    | 'pendingAmount'
    | 'totalOrders'
    | 'lastTransactionDate';
  sortOrder?: 'asc' | 'desc';
}

// ==================== 常量 & 工具函数 ====================

const CUSTOMER_ROLES: PartnerRole[] = ['customer', 'both'];
const SUPPLIER_ROLES: PartnerRole[] = ['supplier', 'both'];

function normalisePartnerRole(role?: string | null): PartnerRole {
  if (role === 'supplier' || role === 'both') {
    return role;
  }
  return 'customer';
}

function normaliseStatementStatus(status?: string | null): StatementStatus {
  if (status === 'active' || status === 'settled' || status === 'suspended') {
    return status;
  }
  return 'active';
}

function normaliseEntityType(value?: string | null): StatementType | undefined {
  if (value === 'customer' || value === 'supplier' || value === 'partner') {
    return value;
  }
  return undefined;
}

function resolveStatementType(
  role: PartnerRole,
  entityType?: string | null
): StatementType {
  const normalised = normaliseEntityType(entityType);
  if (normalised) {
    if (normalised === 'partner') {
      return 'partner';
    }
    return normalised;
  }
  if (role === 'supplier') {
    return 'supplier';
  }
  if (role === 'both') {
    return 'partner';
  }
  return 'customer';
}

function includesCustomerRole(role?: string | null): boolean {
  return role === 'customer' || role === 'both';
}

function includesSupplierRole(role?: string | null): boolean {
  return role === 'supplier' || role === 'both';
}

function formatDate(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapAccountStatementToSummary(
  statement: AccountStatementModel,
  overrideType?: StatementType
): StatementSummary {
  const partnerRole = normalisePartnerRole(statement.partnerRole);
  const type =
    overrideType ?? resolveStatementType(partnerRole, statement.entityType);
  const currentBalance = statement.currentBalance ?? 0;

  return {
    id: statement.entityId,
    name: statement.entityName,
    type,
    partnerRole,
    status: normaliseStatementStatus(statement.status),
    totalOrders: statement.totalOrders,
    totalAmount: statement.totalAmount,
    paidAmount: statement.paidAmount,
    pendingAmount: Math.abs(currentBalance),
    currentBalance,
    lastTransactionDate: formatDate(statement.lastTransactionDate),
    lastPaymentDate: formatDate(statement.lastPaymentDate),
  };
}

function buildStatementWhere(params: {
  type?: StatementType | 'all';
  search?: string;
}): Prisma.AccountStatementWhereInput {
  const where: Prisma.AccountStatementWhereInput = {};

  switch (params.type) {
    case 'customer':
      where.partnerRole = { in: CUSTOMER_ROLES };
      break;
    case 'supplier':
      where.partnerRole = { in: SUPPLIER_ROLES };
      break;
    case 'partner':
    case 'all':
    case undefined:
      // 不做限制
      break;
    default:
      break;
  }

  if (params.search) {
    where.OR = [
      {
        entityName: {
          contains: params.search,
          mode: 'insensitive',
        },
      },
      {
        entityId: {
          contains: params.search,
          mode: 'insensitive',
        },
      },
    ];
  }

  return where;
}

function getStatementsOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.AccountStatementOrderByWithRelationInput {
  const order: Prisma.AccountStatementOrderByWithRelationInput = {};

  switch (sortBy) {
    case 'entityName':
      order.entityName = sortOrder;
      break;
    case 'totalAmount':
      order.totalAmount = sortOrder;
      break;
    case 'pendingAmount':
      order.pendingAmount = sortOrder;
      break;
    case 'totalOrders':
      order.totalOrders = sortOrder;
      break;
    case 'lastTransactionDate':
      order.lastTransactionDate = sortOrder;
      break;
    default:
      order.updatedAt = sortOrder;
      break;
  }

  return order;
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
  } = params;

  const where = buildStatementWhere({ type, search });
  const orderBy = getStatementsOrderBy(sortBy, sortOrder);
  const skip = (page - 1) * limit;

  const [total, statements] = await prisma.$transaction([
    prisma.accountStatement.count({ where }),
    prisma.accountStatement.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const summary = await getFinanceSummary(
    type && type !== 'all' ? type : undefined
  );

  return {
    data: statements.map(statement => mapAccountStatementToSummary(statement)),
    pagination: {
      page,
      limit,
      pageSize: limit,
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
      paymentRate:
        salesOrderStats._sum.totalAmount && salesOrderStats._sum.totalAmount > 0
          ? ((paymentStats._sum.paymentAmount || 0) /
              salesOrderStats._sum.totalAmount) *
            100
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
      totalAmount: refundStats._sum.refundAmount || 0,
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
