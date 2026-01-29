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

describe('partner-ledger-service metadata truncation', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      customer: { findUnique: jest.Mock };
      supplier: { findUnique: jest.Mock };
      statementTransaction: { findFirst: jest.Mock };
    };
  };

  test('statement_transactions.metadata 超长时会被降级为 <=191 的合法 JSON', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-001',
      name: '测试客户',
      phone: null,
      address: null,
      role: 'customer',
    });
    prisma.supplier.findUnique.mockResolvedValue(null);

    const state = {
      statement: null as any,
      createdTransactions: [] as any[],
    };

    const tx = {
      accountStatement: {
        findUnique: jest.fn().mockImplementation(() => state.statement),
        create: jest.fn().mockImplementation(({ data }: any) => {
          state.statement = {
            id: data.id ?? 'stmt-001',
            entityId: data.entityId,
            entityName: data.entityName,
            entityType: data.entityType,
            partnerRole: data.partnerRole,
            totalOrders: 0,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            currentBalance: 0,
            overdueAmount: 0,
            creditLimit: 0,
            paymentTerms: '30天',
            status: 'active',
            lastTransactionDate: data.lastTransactionDate ?? null,
            lastPaymentDate: data.lastPaymentDate ?? null,
          };
          return state.statement;
        }),
        update: jest.fn().mockImplementation(({ data }: any) => {
          if (!state.statement) throw new Error('statement not created');
          if (data.paidAmount?.increment)
            state.statement.paidAmount += data.paidAmount.increment;
          if (data.currentBalance !== undefined)
            state.statement.currentBalance = data.currentBalance;
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
      systemLog: { create: jest.fn() },
    };

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
        metadata: {
          userId: 'operator-001',
          note: 'x'.repeat(400),
          source: 'refund_record',
        },
      },
      tx as any
    );

    const refundTx = state.createdTransactions.find(
      txRow => txRow.transactionType === 'refund'
    );
    expect(typeof refundTx?.metadata).toBe('string');
    expect(refundTx?.metadata.length).toBeLessThanOrEqual(191);

    const parsed = JSON.parse(refundTx.metadata);
    expect(parsed).toEqual(
      expect.objectContaining({ truncated: true, userId: 'operator-001' })
    );
  });
});
