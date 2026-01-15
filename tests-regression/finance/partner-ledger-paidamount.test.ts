import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';

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

type Statement = {
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

function createStatementFixture(overrides: Partial<Statement> = {}): Statement {
  return {
    id: 'stmt-001',
    entityId: 'customer-001',
    entityName: '测试客户',
    entityType: 'customer',
    partnerRole: 'customer',
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
    ...overrides,
  };
}

describe('recordPartnerTransaction paidAmount delta', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      customer: { findUnique: jest.Mock };
      supplier: { findUnique: jest.Mock };
      statementTransaction: { findFirst: jest.Mock };
    };
  };

  test('sale 100 + payment_in 100 + refund 10 不应把 paidAmount 推到 110', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-001',
      name: '测试客户',
      phone: null,
      address: null,
      role: 'customer',
    });
    prisma.supplier.findUnique.mockResolvedValue(null);

    const state = {
      statement: null as Statement | null,
      createdTransactions: [] as any[],
    };

    const tx = {
      accountStatement: {
        findUnique: jest.fn().mockImplementation(() => state.statement),
        create: jest.fn().mockImplementation(({ data }: any) => {
          state.statement = createStatementFixture({
            id: data.id ?? 'stmt-001',
            entityId: data.entityId,
            entityName: data.entityName,
            entityType: data.entityType,
            partnerRole: data.partnerRole,
            lastTransactionDate: data.lastTransactionDate ?? null,
            lastPaymentDate: data.lastPaymentDate ?? null,
          });
          return state.statement;
        }),
        update: jest.fn().mockImplementation(({ data }: any) => {
          if (!state.statement) {
            throw new Error('statement not created');
          }

          if (data.entityName !== undefined) state.statement.entityName = data.entityName;
          if (data.partnerRole !== undefined) state.statement.partnerRole = data.partnerRole;
          if (data.entityType !== undefined) state.statement.entityType = data.entityType;
          if (data.currentBalance !== undefined)
            state.statement.currentBalance = data.currentBalance;
          if (data.pendingAmount !== undefined)
            state.statement.pendingAmount = data.pendingAmount;
          if (data.lastTransactionDate !== undefined)
            state.statement.lastTransactionDate = data.lastTransactionDate;
          if (data.lastPaymentDate !== undefined)
            state.statement.lastPaymentDate = data.lastPaymentDate;
          if (data.status !== undefined) state.statement.status = data.status;

          if (data.totalOrders?.increment) {
            state.statement.totalOrders += data.totalOrders.increment;
          }
          if (data.totalAmount?.increment) {
            state.statement.totalAmount += data.totalAmount.increment;
          }
          if (data.paidAmount?.increment) {
            state.statement.paidAmount += data.paidAmount.increment;
          }

          return state.statement;
        }),
      },
      statementTransaction: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          const txRow = {
            id: `tx-${state.createdTransactions.length + 1}`,
            ...data,
          };
          state.createdTransactions.push(txRow);
          return txRow;
        }),
      },
      systemLog: {
        create: jest.fn(),
      },
    };

    await recordPartnerTransaction(
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 100,
        referenceId: 'sales-001',
        referenceNumber: 'SO-001',
        description: '销售订单 SO-001',
        occurredAt: new Date('2025-01-01'),
      },
      tx as any
    );

    await recordPartnerTransaction(
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'payment_in',
        amount: 100,
        referenceId: 'payment-001',
        referenceNumber: 'PAY-001',
        description: '收款 PAY-001',
        occurredAt: new Date('2025-01-02'),
      },
      tx as any
    );

    await recordPartnerTransaction(
      {
        partnerId: 'customer-001',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'refund',
        amount: 10,
        referenceId: 'refund-001',
        referenceNumber: 'RF-001',
        description: '退款 RF-001',
        occurredAt: new Date('2025-01-03'),
      },
      tx as any
    );

    expect(state.statement?.paidAmount).toBe(90);
    expect(state.statement?.currentBalance).toBe(-10);

    const refundTx = state.createdTransactions.find(
      txRow => txRow.transactionType === 'refund'
    );
    expect(refundTx).toEqual(expect.objectContaining({ direction: 'credit' }));
  });
});
