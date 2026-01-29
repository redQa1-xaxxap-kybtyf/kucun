import {
  getFinanceOverview,
  getFinanceStatistics,
} from '@/lib/services/finance-statistics';

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

const { getSystemMode } = jest.requireMock(
  '@/lib/services/system-mode-service'
) as {
  getSystemMode: jest.Mock;
};

function resetPrisma(overrides?: Partial<any>) {
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }

  Object.assign(prisma, {
    accountStatement: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    refundRecord: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    paymentRecord: {
      aggregate: jest.fn(),
    },
    salesOrder: {
      aggregate: jest.fn(),
    },
    ...overrides,
  });
}

describe('finance-statistics 服务（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
  });

  test('getFinanceOverview：production 模式应带 dataTag=prod，并正确聚合应收/可退款/本月收款', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

    try {
      getSystemMode.mockResolvedValue('production');

      prisma.accountStatement.aggregate.mockImplementation(
        async ({ where }: any) => {
          if (where?.currentBalance?.gt !== undefined) {
            return { _sum: { currentBalance: 600 } };
          }
          return { _sum: { totalAmount: 1000, paidAmount: 400 } };
        }
      );
      prisma.accountStatement.count.mockResolvedValue(3);

      prisma.refundRecord.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 50 },
      });
      prisma.refundRecord.count.mockResolvedValue(7);

      prisma.paymentRecord.aggregate.mockResolvedValue({
        _sum: { actualPaymentAmount: 200 },
      });

      const result = await getFinanceOverview();

      expect(result).toEqual(
        expect.objectContaining({
          totalReceivable: 600,
          totalRefundable: 50,
          monthlyReceived: 200,
          receivableCount: 3,
          refundCount: 7,
          summary: expect.objectContaining({
            totalOrders: 3,
            totalAmount: 1000,
            paidAmount: 400,
            pendingAmount: 600,
            paymentRate: 40,
          }),
        })
      );

      expect(prisma.refundRecord.aggregate).toHaveBeenCalledTimes(1);
      const [refundAggArgs] = prisma.refundRecord.aggregate.mock.calls[0] as [
        { where: any },
      ];
      expect(refundAggArgs.where).toEqual(
        expect.objectContaining({
          status: { in: ['pending', 'processing'] },
          remainingAmount: { gt: 0 },
          voidedAt: null,
          dataTag: 'prod',
        })
      );

      expect(prisma.paymentRecord.aggregate).toHaveBeenCalledTimes(1);
      const [paymentAggArgs] = prisma.paymentRecord.aggregate.mock.calls[0] as [
        { where: any },
      ];
      const expectedStartOfMonth = new Date(2026, 0, 1);
      const expectedStartOfNextMonth = new Date(2026, 1, 1);
      expect(paymentAggArgs.where).toEqual(
        expect.objectContaining({
          status: 'confirmed',
          voidedAt: null,
          dataTag: 'prod',
          actualPaymentAmount: { gt: 0 },
          paymentDate: {
            gte: expectedStartOfMonth,
            lt: expectedStartOfNextMonth,
          },
        })
      );

      expect(prisma.refundRecord.count).toHaveBeenCalledTimes(1);
      const [refundCountArgs] = prisma.refundRecord.count.mock.calls[0] as [
        { where: any },
      ];
      expect(refundCountArgs.where).toEqual(
        expect.objectContaining({
          status: { in: ['pending', 'processing', 'completed'] },
          voidedAt: null,
          dataTag: 'prod',
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('getFinanceOverview：trial 模式不应强制 dataTag=prod', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

    try {
      getSystemMode.mockResolvedValue('trial');

      prisma.accountStatement.aggregate.mockImplementation(
        async ({ where }: any) => {
          if (where?.currentBalance?.gt !== undefined) {
            return { _sum: { currentBalance: 10 } };
          }
          return { _sum: { totalAmount: 10, paidAmount: 0 } };
        }
      );
      prisma.accountStatement.count.mockResolvedValue(1);

      prisma.refundRecord.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 1 },
      });
      prisma.refundRecord.count.mockResolvedValue(1);
      prisma.paymentRecord.aggregate.mockResolvedValue({
        _sum: { actualPaymentAmount: 2 },
      });

      const result = await getFinanceOverview();
      expect(result.totalReceivable).toBe(10);

      const [refundAggArgs] = prisma.refundRecord.aggregate.mock.calls[0] as [
        { where: any },
      ];
      expect(refundAggArgs.where.dataTag).toBeUndefined();
      expect(refundAggArgs.where.voidedAt).toBeNull();

      const [paymentAggArgs] = prisma.paymentRecord.aggregate.mock.calls[0] as [
        { where: any },
      ];
      expect(paymentAggArgs.where.dataTag).toBeUndefined();
      expect(paymentAggArgs.where.voidedAt).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('getFinanceStatistics：支持期间+客户筛选，并可附带 refunds/statements', async () => {
    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 300 },
      _count: { id: 3 },
    });
    prisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 120 },
      _count: { id: 2 },
    });
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { refundAmount: 10 },
      _count: { id: 1 },
    });

    prisma.accountStatement.count
      .mockResolvedValueOnce(5) // customers
      .mockResolvedValueOnce(2); // suppliers
    prisma.accountStatement.aggregate
      .mockResolvedValueOnce({ _sum: { currentBalance: 80 } }) // receivableAgg
      .mockResolvedValueOnce({ _sum: { currentBalance: -30 } }); // payableAgg

    const result = await getFinanceStatistics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      customerId: 'cust-1',
    });

    expect(prisma.salesOrder.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'cust-1',
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        }),
      })
    );

    expect(prisma.paymentRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'cust-1',
          status: 'confirmed',
          paymentDate: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        }),
      })
    );

    expect(prisma.refundRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'cust-1',
          status: { in: ['pending', 'processing', 'completed'] },
          refundDate: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        }),
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        period: { startDate: '2026-01-01', endDate: '2026-01-31' },
        sales: { totalAmount: 300, orderCount: 3 },
        payments: { totalAmount: 120, paymentCount: 2 },
        receivables: { totalAmount: 180, paymentRate: 40 },
        refunds: { totalAmount: 10, refundCount: 1 },
        statements: {
          customerCount: 5,
          supplierCount: 2,
          totalReceivable: 80,
          totalPayable: 30,
        },
      })
    );
  });

  test('getFinanceStatistics：includeRefunds/includeStatements=false 时不查询对应数据', async () => {
    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0 },
      _count: { id: 0 },
    });
    prisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 0 },
      _count: { id: 0 },
    });

    const result = await getFinanceStatistics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      includeRefunds: false,
      includeStatements: false,
    });

    expect(prisma.refundRecord.aggregate).not.toHaveBeenCalled();
    expect(prisma.accountStatement.count).not.toHaveBeenCalled();
    expect(prisma.accountStatement.aggregate).not.toHaveBeenCalled();

    expect(result.refunds).toBeUndefined();
    expect(result.statements).toBeUndefined();
  });
});
