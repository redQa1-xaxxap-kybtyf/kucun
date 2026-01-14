import type {
  AccountStatement as AccountStatementModel,
  Prisma,
} from '@prisma/client';

import type {
  PartnerRole,
  StatementStatus,
  StatementType,
} from '@/lib/types/statement';
import { toNumber } from '@/lib/utils/number';

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
  startDate?: string;
  endDate?: string;
}

export const CUSTOMER_ROLES: PartnerRole[] = ['customer', 'both'];
export const SUPPLIER_ROLES: PartnerRole[] = ['supplier', 'both'];

export function normalisePartnerRole(role?: string | null): PartnerRole {
  if (role === 'supplier' || role === 'both') {
    return role;
  }
  return 'customer';
}

export function normaliseStatementStatus(
  status?: string | null
): StatementStatus {
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

export function includesCustomerRole(role?: string | null): boolean {
  return role === 'customer' || role === 'both';
}

export function includesSupplierRole(role?: string | null): boolean {
  return role === 'supplier' || role === 'both';
}

function formatDate(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function mapAccountStatementToSummary(
  statement: Pick<
    AccountStatementModel,
    | 'entityId'
    | 'entityName'
    | 'entityType'
    | 'partnerRole'
    | 'status'
    | 'totalOrders'
    | 'totalAmount'
    | 'paidAmount'
    | 'currentBalance'
    | 'lastTransactionDate'
    | 'lastPaymentDate'
  >,
  overrideType?: StatementType
): StatementSummary {
  const partnerRole = normalisePartnerRole(statement.partnerRole);
  const type =
    overrideType ?? resolveStatementType(partnerRole, statement.entityType);
  const currentBalance = toNumber(statement.currentBalance);

  return {
    id: statement.entityId,
    name: statement.entityName,
    type,
    partnerRole,
    status: normaliseStatementStatus(statement.status),
    totalOrders: statement.totalOrders,
    totalAmount: toNumber(statement.totalAmount),
    paidAmount: toNumber(statement.paidAmount),
    pendingAmount: Math.abs(currentBalance),
    currentBalance,
    lastTransactionDate: formatDate(statement.lastTransactionDate),
    lastPaymentDate: formatDate(statement.lastPaymentDate),
  };
}

export function buildStatementWhere(params: {
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
      // ✅ 修复问题3：添加 partner 分支的过滤逻辑
      // 只显示同时作为客户和供应商的往来伙伴
      where.partnerRole = 'both';
      break;
    case 'all':
    case undefined:
      break;
    default:
      break;
  }

  const searchTerm = params.search?.trim();
  if (searchTerm) {
    where.OR = [
      {
        entityName: {
          contains: searchTerm,
        },
      },
      {
        entityId: {
          contains: searchTerm,
        },
      },
    ];
  }

  return where;
}

export function getStatementsOrderBy(
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
