import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import type { TransactionType } from '@/lib/types/statement';

jest.mock('@/lib/cache/pubsub', () => ({
  publishFinanceChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    customer: { findUnique: jest.fn() },
    supplier: { findUnique: jest.fn() },
    statementTransaction: { findFirst: jest.fn() },
  },
}));

type StatementRow = {
  id: string;
  entityId: string;
  entityName: string;
  entityType: string;
  partnerRole: string;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  overdueAmount: number;
  creditLimit: number;
  paymentTerms: string;
  status: string;
  lastTransactionDate: Date | null;
  lastPaymentDate: Date | null;
};

function createStatementRow(
  entityId: string,
  entityType: string,
  partnerRole: string
) {
  return {
    id: `stmt-${entityId}`,
    entityId,
    entityName: entityId,
    entityType,
    partnerRole,
    totalOrders: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    currentBalance: 0,
    overdueAmount: 0,
    creditLimit: 0,
    paymentTerms: '30天',
    status: 'active',
    lastTransactionDate: null,
    lastPaymentDate: null,
  } satisfies StatementRow;
}

function applyStatementUpdate(statement: StatementRow, data: any) {
  if (data.entityName !== undefined) statement.entityName = data.entityName;
  if (data.partnerRole !== undefined) statement.partnerRole = data.partnerRole;
  if (data.entityType !== undefined) statement.entityType = data.entityType;
  if (data.currentBalance !== undefined)
    statement.currentBalance = data.currentBalance;
  if (data.pendingAmount !== undefined)
    statement.pendingAmount = data.pendingAmount;
  if (data.lastTransactionDate !== undefined)
    statement.lastTransactionDate = data.lastTransactionDate;
  if (data.lastPaymentDate !== undefined)
    statement.lastPaymentDate = data.lastPaymentDate;
  if (data.status !== undefined) statement.status = data.status;

  if (data.totalOrders?.increment)
    statement.totalOrders += data.totalOrders.increment;
  if (data.totalAmount?.increment)
    statement.totalAmount += data.totalAmount.increment;
  if (data.paidAmount?.increment)
    statement.paidAmount += data.paidAmount.increment;

  return statement;
}

describe('partner-ledger-service SystemLog audit', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      customer: { findUnique: jest.Mock };
      supplier: { findUnique: jest.Mock };
      statementTransaction: { findFirst: jest.Mock };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each<
    [
      TransactionType,
      {
        partnerId: string;
        partnerRole: 'customer' | 'supplier';
        entityType: 'customer' | 'supplier';
      },
    ]
  >([
    [
      'sale',
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
      },
    ],
    [
      'sales_return',
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
      },
    ],
    [
      'payment_in',
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
      },
    ],
    [
      'refund',
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
      },
    ],
    [
      'payment_out',
      {
        partnerId: 'supplier-001',
        partnerRole: 'supplier',
        entityType: 'supplier',
      },
    ],
    [
      'purchase',
      {
        partnerId: 'supplier-001',
        partnerRole: 'supplier',
        entityType: 'supplier',
      },
    ],
  ])('%s 会写入一条 SystemLog', async (transactionType, base) => {
    prisma.customer.findUnique.mockImplementation(({ where }: any) => {
      if (where?.id === 'customer-001') {
        return Promise.resolve({
          id: 'customer-001',
          name: '测试客户',
          phone: null,
          address: null,
          role: 'customer',
        });
      }
      return Promise.resolve(null);
    });
    prisma.supplier.findUnique.mockImplementation(({ where }: any) => {
      if (where?.id === 'supplier-001') {
        return Promise.resolve({
          id: 'supplier-001',
          name: '测试供应商',
          phone: null,
          address: null,
        });
      }
      return Promise.resolve(null);
    });

    const state = { statement: null as StatementRow | null };
    const tx = {
      accountStatement: {
        findUnique: jest.fn().mockImplementation(() => state.statement),
        create: jest.fn().mockImplementation(({ data }: any) => {
          state.statement = createStatementRow(
            data.entityId,
            data.entityType,
            data.partnerRole
          );
          return state.statement;
        }),
        update: jest.fn().mockImplementation(({ data }: any) => {
          if (!state.statement) throw new Error('statement not created');
          return applyStatementUpdate(state.statement, data);
        }),
      },
      statementTransaction: {
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'tx-001',
          ...data,
        })),
      },
      systemLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-001' }),
      },
    };

    await recordPartnerTransaction(
      {
        ...base,
        transactionType,
        amount: 10,
        referenceId: `ref-${transactionType}`,
        referenceNumber: `NO-${transactionType}`,
        description: `desc-${transactionType}`,
        occurredAt: new Date('2025-01-01'),
        userId: 'operator-001',
      },
      tx as any
    );

    expect(tx.systemLog.create).toHaveBeenCalledTimes(1);
    expect(tx.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'business_operation',
          level: 'info',
          action: `ledger:${transactionType}`,
          userId: 'operator-001',
        }),
      })
    );
  });
});
