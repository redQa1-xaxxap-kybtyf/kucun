/**
 * 伙伴账本服务
 * 统一管理客户/供应商（业务伙伴）的账户流水与余额
 */
/* eslint-disable max-lines-per-function, max-lines */

import type {
  Prisma,
} from '@prisma/client';

import { publishFinanceChange } from '@/lib/cache/pubsub';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  AccountStatement,
  AccountStatementDetail,
  PartnerRole,
  StatementTransaction as StatementTransactionType,
  StatementStatus,
  StatementType,
  TransactionType,
} from '@/lib/types/statement';
import { toNumber } from '@/lib/utils/number';

// ==================== 类型定义 ====================

export interface RecordPartnerTransactionInput {
  partnerId: string;
  partnerName?: string;
  partnerRole?: PartnerRole;
  entityType?: StatementType;
  transactionType: TransactionType;
  amount: number;
  referenceId: string;
  referenceNumber?: string;
  description: string;
  occurredAt?: Date | string;
  dueDate?: Date | string;
  status?: 'pending' | 'completed' | 'overdue';
  metadata?: Record<string, unknown> | null;
}

export interface PartnerLedgerOptions {
  includeTransactions?: boolean;
  limit?: number;
  offset?: number;
  startDate?: Date | string;
  endDate?: Date | string;
}

interface PartnerEntity {
  id: string;
  name: string;
  role: PartnerRole;
  entityType: StatementType;
  phone?: string | null;
  address?: string | null;
}

const DEFAULT_TRANSACTION_STATUS: Record<
  TransactionType,
  'pending' | 'completed'
> = {
  sale: 'completed',
  sales_return: 'completed',
  order_cancellation: 'completed',
  payment_in: 'completed',
  payment_out: 'completed',
  prepayment_in: 'completed',
  prepayment_out: 'completed',
  refund: 'completed',
  purchase: 'completed',
  adjustment: 'completed',
};

type TransactionRule = {
  direction: 'debit' | 'credit';
  balanceDelta: (amount: number) => number;
  increaseOrderCount?: boolean;
  affectsPaidAmount?: boolean;
  affectsTotalAmount?: boolean;
  affectsPendingAmount?: boolean;
  updateLastPaymentDate?: boolean;
};

const TRANSACTION_RULES: Record<TransactionType, TransactionRule> = {
  sale: {
    direction: 'debit',
    balanceDelta: amount => amount,
    increaseOrderCount: true,
    affectsTotalAmount: true,
    affectsPendingAmount: true,
  },
  sales_return: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    affectsTotalAmount: true,
    affectsPendingAmount: true,
  },
  order_cancellation: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    affectsTotalAmount: true,
    affectsPendingAmount: true,
  },
  payment_in: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    affectsPaidAmount: true,
    affectsPendingAmount: true,
    updateLastPaymentDate: true,
  },
  payment_out: {
    direction: 'debit',
    balanceDelta: amount => amount,
    affectsPaidAmount: true,
    affectsPendingAmount: true,
    updateLastPaymentDate: true,
  },
  prepayment_in: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    affectsPaidAmount: true,
  },
  prepayment_out: {
    direction: 'debit',
    balanceDelta: amount => amount,
    affectsPaidAmount: true,
  },
  refund: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    affectsPaidAmount: true,
    updateLastPaymentDate: true,
  },
  purchase: {
    direction: 'credit',
    balanceDelta: amount => -amount,
    increaseOrderCount: true,
    affectsTotalAmount: true,
    affectsPendingAmount: true,
  },
  adjustment: {
    direction: 'debit',
    balanceDelta: amount => amount,
    affectsPendingAmount: true,
  },
};

const FINANCE_EVENT_TYPE: Record<
  TransactionType,
  'receivable' | 'payable' | 'payment'
> = {
  sale: 'receivable',
  sales_return: 'receivable',
  order_cancellation: 'receivable',
  payment_in: 'payment',
  payment_out: 'payment',
  prepayment_in: 'payment',
  prepayment_out: 'payment',
  refund: 'receivable',
  purchase: 'payable',
  adjustment: 'receivable',
};

// ==================== 工具函数 ====================

function resolveRule(type: TransactionType): TransactionRule {
  const rule = TRANSACTION_RULES[type];
  if (!rule) {
    throw new Error(`Unsupported transaction type: ${type}`);
  }
  return rule;
}

function normaliseDate(input?: Date | string): Date {
  if (!input) {
    return new Date();
  }

  if (input instanceof Date) {
    return input;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${input}`);
  }
  return parsed;
}

function serialiseMetadata(
  metadata?: Record<string, unknown> | null
): string | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch (_error) {
    throw new Error('Failed to serialise transaction metadata');
  }
}

function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) {
    return null;
  }

  if (typeof metadata === 'string') {
    if (!metadata) {
      return null;
    }
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch (_error) {
      return { parseError: 'invalid_metadata', raw: metadata };
    }
  }

  if (typeof metadata === 'object') {
    if (Array.isArray(metadata)) {
      return { value: metadata };
    }
    return metadata as Record<string, unknown>;
  }

  return { value: metadata };
}

function normalisePartnerRole(role?: string | null): PartnerRole {
  if (role === 'supplier' || role === 'both') {
    return role;
  }
  return 'customer';
}

function toStatementType(role: PartnerRole): StatementType {
  if (role === 'supplier') {
    return 'supplier';
  }
  if (role === 'both') {
    return 'partner';
  }
  return 'customer';
}

async function resolvePartnerEntity(partnerId: string): Promise<PartnerEntity> {
  const customer = await prisma.customer.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      role: true,
    },
  });

  if (customer) {
    const role = normalisePartnerRole(customer.role);
    return {
      id: customer.id,
      name: customer.name,
      role,
      entityType: toStatementType(role),
      phone: customer.phone,
      address: customer.address,
    };
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  });

  if (supplier) {
    return {
      id: supplier.id,
      name: supplier.name,
      role: 'supplier',
      entityType: 'supplier',
      phone: supplier.phone,
      address: supplier.address,
    };
  }

  throw new Error(`未找到伙伴信息: ${partnerId}`);
}

function createVirtualStatement(partner: PartnerEntity): AccountStatement {
  const timestamp = new Date(0);
  return {
    id: `virtual-${partner.id}`,
    entityId: partner.id,
    entityName: partner.name,
    entityType: partner.entityType,
    partnerRole: partner.role,
    totalOrders: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    currentBalance: 0,
    overdueAmount: 0,
    creditLimit: 0,
    paymentTerms: '30天',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergePartnerRole(
  existing: string | null | undefined,
  incoming: PartnerRole
): PartnerRole {
  if (!existing) {
    return incoming;
  }
  const current = normalisePartnerRole(existing);
  if (current === incoming) {
    return current;
  }
  return 'both';
}

function normaliseEntityType(
  value: string | null | undefined
): StatementType | undefined {
  if (value === 'customer' || value === 'supplier' || value === 'partner') {
    return value;
  }
  return undefined;
}

function normaliseStatementStatus(status?: string | null): StatementStatus {
  if (status === 'active' || status === 'settled' || status === 'suspended') {
    return status;
  }
  return 'active';
}

// ==================== 主流程 ====================

/**
 * 记录伙伴流水
 * 核心逻辑：
 * 1. 校验交易金额与类型
 * 2. 确保存在对应的 AccountStatement
 * 3. 写入 StatementTransaction 并更新余额与统计字段
 * 4. 发布缓存失效通知
 */
export async function recordPartnerTransaction(
  input: RecordPartnerTransactionInput,
  tx?: Prisma.TransactionClient
) {
  if (input.amount <= 0) {
    throw new Error('交易金额必须大于0');
  }

  const rule = resolveRule(input.transactionType);
  const transactionDate = normaliseDate(input.occurredAt);
  const dueDate = input.dueDate ? normaliseDate(input.dueDate) : undefined;
  const referenceNumber = input.referenceNumber ?? input.referenceId;
  const metadata = serialiseMetadata(input.metadata);
  const transactionStatus =
    input.status ??
    DEFAULT_TRANSACTION_STATUS[input.transactionType] ??
    'completed';

  const execute = async (db: Prisma.TransactionClient) => {
    // ✅ 防重复: 检查是否已经记录过相同的referenceId和transactionType
    const existingTransaction = await db.statementTransaction.findFirst({
      where: {
        referenceId: input.referenceId,
        transactionType: input.transactionType,
      },
    });

    if (existingTransaction) {
      logger.warn(
        'partner-ledger',
        '检测到重复的往来账交易记录,跳过创建',
        undefined,
        {
          referenceId: input.referenceId,
          transactionType: input.transactionType,
          existingTransactionId: existingTransaction.id,
        }
      );
      return existingTransaction;
    }

    const partner = await resolvePartnerEntity(input.partnerId);
    const incomingRole = input.partnerRole ?? partner.role;
    const existingStatement = await db.accountStatement.findUnique({
      where: { entityId: input.partnerId },
    });
    const mergedRole = mergePartnerRole(
      existingStatement?.partnerRole,
      incomingRole
    );
    const baseEntityType = input.entityType ?? toStatementType(incomingRole);
    const entityType =
      mergedRole === 'both'
        ? 'partner'
        : (normaliseEntityType(existingStatement?.entityType) ??
          baseEntityType ??
          partner.entityType);
    const partnerName = input.partnerName ?? partner.name;

    const statement = existingStatement
      ? await db.accountStatement.update({
          where: { id: existingStatement.id },
          data: {
            entityName: partnerName,
            partnerRole: mergedRole,
            entityType,
          },
        })
      : await db.accountStatement.create({
          data: {
            entityId: partner.id,
            entityName: partnerName,
            entityType,
            partnerRole: mergedRole,
            totalOrders: 0,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            currentBalance: 0,
            overdueAmount: 0,
            creditLimit: 0,
            paymentTerms: '30天',
            status: 'active',
            lastTransactionDate: transactionDate,
            lastPaymentDate: rule.updateLastPaymentDate
              ? transactionDate
              : null,
          },
        });

    const beforeBalance = toNumber(statement.currentBalance);
    const delta = rule.balanceDelta(input.amount);
    const afterBalance = beforeBalance + delta;
    const debitAmount = rule.direction === 'debit' ? input.amount : 0;
    const creditAmount = rule.direction === 'credit' ? input.amount : 0;

    const transaction = await db.statementTransaction.create({
      data: {
        statementId: statement.id,
        transactionType: input.transactionType,
        direction: rule.direction,
        referenceId: input.referenceId,
        referenceNumber,
        debitAmount,
        creditAmount,
        amount: input.amount,
        beforeBalance,
        balance: afterBalance,
        afterBalance,
        description: input.description,
        transactionDate,
        dueDate,
        status: transactionStatus,
        metadata,
      },
    });

    const updateData: Prisma.AccountStatementUpdateInput = {
      entityName: partnerName,
      partnerRole: mergedRole,
      entityType,
      currentBalance: afterBalance,
      pendingAmount: Math.abs(afterBalance),
      lastTransactionDate: transactionDate,
      status: afterBalance === 0 ? 'settled' : 'active',
    };

    if (rule.increaseOrderCount) {
      updateData.totalOrders = { increment: 1 };
    }

    if (rule.affectsTotalAmount) {
      updateData.totalAmount = {
        increment: rule.direction === 'debit' ? input.amount : -input.amount,
      };
    }

    if (rule.affectsPaidAmount) {
      updateData.paidAmount = { increment: input.amount };
    }

    if (rule.updateLastPaymentDate) {
      updateData.lastPaymentDate = transactionDate;
    }

    await db.accountStatement.update({
      where: { id: statement.id },
      data: updateData,
    });

    await publishFinanceChange({
      recordType: FINANCE_EVENT_TYPE[input.transactionType] ?? 'receivable',
      recordId: statement.id,
      action: 'update',
      amount: input.amount,
    });

    return transaction;
  };

  if (tx) {
    return execute(tx);
  }
  return prisma.$transaction(execute);
}

/**
 * 获取伙伴账本信息
 */
export async function getPartnerLedger(
  partnerId: string,
  options: PartnerLedgerOptions = {}
) {
  const partner = await resolvePartnerEntity(partnerId);
  const existingStatement = await prisma.accountStatement.findUnique({
    where: { entityId: partnerId },
  });

  const statement = existingStatement ?? createVirtualStatement(partner);

  if (!options.includeTransactions || !existingStatement) {
    return { statement, transactions: [] };
  }

  const where: Prisma.StatementTransactionWhereInput = {
    statementId: existingStatement.id,
  };

  if (options.startDate || options.endDate) {
    where.transactionDate = {};
    if (options.startDate) {
      (where.transactionDate as Prisma.DateTimeFilter).gte = normaliseDate(
        options.startDate
      );
    }
    if (options.endDate) {
      (where.transactionDate as Prisma.DateTimeFilter).lte = normaliseDate(
        options.endDate
      );
    }
  }

  const transactions = await prisma.statementTransaction.findMany({
    where,
    select: {
      id: true,
      statementId: true,
      transactionType: true,
      direction: true,
      referenceId: true,
      referenceNumber: true,
      amount: true,
      beforeBalance: true,
      balance: true,
      afterBalance: true,
      description: true,
      transactionDate: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { transactionDate: 'desc' },
    skip: options.offset,
    take: options.limit,
  });

  return {
    statement,
    transactions: transactions.map(transaction => ({
      ...transaction,
      metadata: parseMetadata(transaction.metadata),
    })),
  };
}

export interface PartnerStatementDetailOptions extends PartnerLedgerOptions {
  page?: number;
  pageSize?: number;
}

export async function getPartnerStatementDetail(
  partnerId: string,
  options: PartnerStatementDetailOptions = {}
): Promise<AccountStatementDetail> {
  const pageSize = options.pageSize ?? options.limit ?? 50;
  const page = options.page ?? 1;
  const offset = (page - 1) * pageSize;

  const partner = await resolvePartnerEntity(partnerId);
  const ledger = await getPartnerLedger(partnerId, {
    includeTransactions: true,
    limit: pageSize,
    offset,
    startDate: options.startDate,
    endDate: options.endDate,
  });

  if (!ledger) {
    throw new Error(`未找到伙伴账本: ${partnerId}`);
  }

  const { statement, transactions } = ledger;
  const statementId =
    statement.id.startsWith('virtual-') || !statement.id ? null : statement.id;

  let totalTransactions = 0;
  if (statementId) {
    const where: Prisma.StatementTransactionWhereInput = {
      statementId,
    };
    if (options.startDate || options.endDate) {
      where.transactionDate = {};
      if (options.startDate) {
        (where.transactionDate as Prisma.DateTimeFilter).gte = normaliseDate(
          options.startDate
        );
      }
      if (options.endDate) {
        (where.transactionDate as Prisma.DateTimeFilter).lte = normaliseDate(
          options.endDate
        );
      }
    }

    totalTransactions = await prisma.statementTransaction.count({ where });
  }

  const mappedTransactions: StatementTransactionType[] = transactions.map(
    transaction => {
      const direction = (transaction.direction as 'debit' | 'credit') ?? 'debit';
      const amount = toNumber(transaction.amount);
      const debitAmount = direction === 'debit' ? amount : 0;
      const creditAmount = direction === 'credit' ? amount : 0;

      return {
        id: transaction.id,
        statementId: transaction.statementId,
        transactionType: transaction.transactionType as TransactionType,
        direction,
        referenceId: transaction.referenceId,
        referenceNumber: transaction.referenceNumber,
        debitAmount,
        creditAmount,
        amount,
        beforeBalance: toNumber(transaction.beforeBalance),
        balance: toNumber(transaction.balance),
        afterBalance: toNumber(
          transaction.afterBalance ?? transaction.balance ?? transaction.amount
        ),
        description: transaction.description,
        transactionDate:
          transaction.transactionDate instanceof Date
            ? transaction.transactionDate.toISOString()
            : transaction.transactionDate,
        status:
          transaction.status === 'pending' || transaction.status === 'overdue'
            ? 'pending'
            : 'completed',
        metadata: parseMetadata(transaction.metadata),
        createdAt:
          transaction.createdAt instanceof Date
            ? transaction.createdAt.toISOString()
            : transaction.createdAt,
      };
    }
  );

  const partnerRole = normalisePartnerRole(statement.partnerRole);
  const entityType =
    normaliseEntityType(statement.entityType) ?? toStatementType(partnerRole);
  const totalOrders = statement.totalOrders ?? 0;
  const totalAmount = toNumber(statement.totalAmount);
  const paidAmount = toNumber(statement.paidAmount);
  const currentBalance = toNumber(statement.currentBalance);
  const pendingAmount =
    statement.pendingAmount == null
      ? Math.abs(currentBalance)
      : toNumber(statement.pendingAmount);
  const overdueAmount = toNumber(statement.overdueAmount);
  const creditLimit = toNumber(statement.creditLimit);
  const balance = currentBalance;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = startOfMonth;

  const aggregateByPeriod = (start: Date, end: Date | null): number =>
    mappedTransactions
      .filter(tx => {
        const date = new Date(tx.transactionDate);
        if (end) {
          return date >= start && date < end && tx.direction === 'debit';
        }
        return date >= start && tx.direction === 'debit';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

  const currentMonthAmount = aggregateByPeriod(startOfMonth, null);
  const lastMonthAmount = aggregateByPeriod(lastMonthStart, lastMonthEnd);
  const averageMonthlyAmount =
    totalOrders > 0 ? Math.abs(totalAmount) / totalOrders : Math.abs(totalAmount);

  const paymentRate =
    Math.abs(totalAmount) > 0
      ? (Math.abs(paidAmount) / Math.abs(totalAmount)) * 100
      : 0;

  const detail: AccountStatementDetail = {
    id: partner.id,
    entityId: statement.entityId,
    entityName: statement.entityName,
    entityType,
    partnerRole,
    totalOrders,
    totalAmount,
    paidAmount,
    pendingAmount,
    currentBalance: balance,
    overdueAmount,
    creditLimit,
    paymentTerms: statement.paymentTerms ?? '30天',
    status: normaliseStatementStatus(statement.status),
    lastTransactionDate: statement.lastTransactionDate ?? undefined,
    lastPaymentDate: statement.lastPaymentDate ?? undefined,
    createdAt: statement.createdAt,
    updatedAt: statement.updatedAt,
    transactions: mappedTransactions,
    summary: {
      currentMonthAmount,
      lastMonthAmount,
      averageMonthlyAmount,
      paymentRate,
      averagePaymentDays: 0,
    },
    entity: {
      id: partner.id,
      name: partner.name,
      phone: partner.phone ?? undefined,
      address: partner.address ?? undefined,
    },
  };

  if (statementId) {
    detail.transactionsPagination = {
      page,
      pageSize,
      total: totalTransactions,
      totalPages:
        totalTransactions > 0 ? Math.ceil(totalTransactions / pageSize) : 1,
    };
  }

  return detail;
}

/**
 * 写入期初余额调整
 */
export async function recordOpeningBalance(input: {
  partnerId: string;
  partnerRole: PartnerRole;
  amount: number;
  description?: string;
}) {
  return recordPartnerTransaction({
    partnerId: input.partnerId,
    partnerRole: input.partnerRole,
    transactionType: 'adjustment',
    amount: Math.abs(input.amount),
    referenceId: `opening-${input.partnerId}`,
    referenceNumber: `OPENING-${input.partnerId}`,
    description: input.description ?? '期初余额调整',
    occurredAt: new Date(0),
    metadata: {
      source: 'opening_balance',
    },
  });
}
