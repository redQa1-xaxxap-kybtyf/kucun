import { getCustomerStatementDetail } from '@/lib/services/customer-statement-service';

jest.mock('@/lib/db', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    salesOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    factoryShipmentOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    returnOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRecord: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    refundRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('customer-statement-service return order balance gating', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  const mockZeroAggregates = () => {
    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, roundingAdjustment: 0 },
    });
    prisma.factoryShipmentOrder.aggregate.mockResolvedValue({
      _sum: { receivableAmount: 0 },
    });
    prisma.paymentRecord.groupBy.mockResolvedValue([]);
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { processedAmount: 0, refundAmount: 0 },
    });
    prisma.refundRecord.findMany.mockResolvedValue([]);
    prisma.salesOrder.findMany.mockResolvedValue([]);
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);
    prisma.paymentRecord.findMany.mockResolvedValue([]);
    prisma.paymentOutRecord.findMany.mockResolvedValue([]);
    prisma.paymentOutRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 0 },
    });
    prisma.supplier.findFirst.mockResolvedValue(null);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-001',
      name: '测试客户',
      phone: null,
      address: null,
    });
    mockZeroAggregates();
  });

  test('submitted/approved/processing 退货：history 可出现但 balance 不变化', async () => {
    prisma.returnOrder.aggregate.mockResolvedValue({ _sum: { refundAmount: 0 } });
    prisma.returnOrder.findMany.mockResolvedValue([
      {
        id: 'return-001',
        returnNumber: 'RT-001',
        refundAmount: 10,
        createdAt: new Date('2025-01-10'),
        completedAt: null,
        status: 'submitted',
        type: 'quality_issue',
        processType: 'refund',
      },
    ]);

    const detail = await getCustomerStatementDetail('customer-001', '2025-01-01', '2025-01-31');

    expect(detail.summary.receivables.salesReturnAmount).toBe(0);
    expect(detail.openingBalance).toBe(0);
    expect(detail.closingBalance).toBe(0);
    expect(detail.transactions).toHaveLength(1);
    expect(detail.transactions[0]).toEqual(
      expect.objectContaining({
        transactionType: 'sales_return',
        creditAmount: 0,
        balance: 0,
        status: 'submitted',
      })
    );
  });

  test('completed 退货：仅在 completedAt 发生时影响 balance', async () => {
    const completedAt = new Date('2025-01-20');

    prisma.returnOrder.aggregate.mockImplementation(({ where }: any) => {
      const filter = where?.completedAt;
      if (!filter || where?.status !== 'completed') {
        return Promise.resolve({ _sum: { refundAmount: 0 } });
      }
      const gte = filter?.gte ? new Date(filter.gte).getTime() : null;
      const lte = filter?.lte ? new Date(filter.lte).getTime() : null;
      const time = completedAt.getTime();
      const matches = (gte === null || time >= gte) && (lte === null || time <= lte);
      return Promise.resolve({ _sum: { refundAmount: matches ? 10 : 0 } });
    });

    prisma.returnOrder.findMany.mockResolvedValue([
      {
        id: 'return-002',
        returnNumber: 'RT-002',
        refundAmount: 10,
        createdAt: new Date('2024-12-10'),
        completedAt,
        status: 'completed',
        type: 'quality_issue',
        processType: 'refund',
      },
    ]);

    const detail = await getCustomerStatementDetail('customer-001', '2025-01-01', '2025-01-31');

    expect(detail.summary.receivables.salesReturnAmount).toBe(10);
    expect(detail.openingBalance).toBe(0);
    expect(detail.closingBalance).toBe(-10);

    expect(prisma.returnOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ createdAt: expect.any(Object) }),
            expect.objectContaining({
              status: 'completed',
              processType: 'refund',
              completedAt: expect.any(Object),
            }),
          ]),
        }),
      })
    );

    expect(detail.transactions).toHaveLength(1);
    expect(detail.transactions[0]).toEqual(
      expect.objectContaining({
        transactionType: 'sales_return',
        transactionDate: completedAt.toISOString(),
        creditAmount: 10,
        balance: -10,
        status: 'completed',
      })
    );
  });

  test('completed 但 completedAt 为空：明细可见但不影响 balance', async () => {
    prisma.returnOrder.aggregate.mockResolvedValue({ _sum: { refundAmount: 0 } });
    prisma.returnOrder.findMany.mockResolvedValue([
      {
        id: 'return-003',
        returnNumber: 'RT-003',
        refundAmount: 10,
        createdAt: new Date('2025-01-10'),
        completedAt: null,
        status: 'completed',
        type: 'quality_issue',
        processType: 'refund',
      },
    ]);

    const detail = await getCustomerStatementDetail('customer-001', '2025-01-01', '2025-01-31');

    expect(detail.summary.receivables.salesReturnAmount).toBe(0);
    expect(detail.closingBalance).toBe(0);

    expect(detail.transactions).toHaveLength(1);
    expect(detail.transactions[0]).toEqual(
      expect.objectContaining({
        transactionType: 'sales_return',
        creditAmount: 0,
        balance: 0,
        status: 'completed',
        description: expect.stringContaining('completedAt缺失'),
      })
    );
  });
});
