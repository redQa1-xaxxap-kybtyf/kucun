jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    customer: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    salesOrder: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    factoryShipmentOrder: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    returnOrder: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRecord: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    refundRecord: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    payableRecord: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('customer-statement-service 应付边界回归', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      customer: {
        count: jest.Mock;
      };
      salesOrder: {
        groupBy: jest.Mock;
      };
      factoryShipmentOrder: {
        groupBy: jest.Mock;
      };
      returnOrder: {
        groupBy: jest.Mock;
      };
      paymentRecord: {
        groupBy: jest.Mock;
      };
      refundRecord: {
        groupBy: jest.Mock;
      };
      payableRecord: {
        aggregate: jest.Mock;
      };
      paymentOutRecord: {
        aggregate: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.customer.count.mockResolvedValue(12);

    prisma.salesOrder.groupBy.mockResolvedValue([]);
    prisma.factoryShipmentOrder.groupBy.mockResolvedValue([]);
    prisma.returnOrder.groupBy.mockResolvedValue([]);
    prisma.paymentRecord.groupBy.mockResolvedValue([]);
    prisma.refundRecord.groupBy.mockResolvedValue([]);

    prisma.payableRecord.aggregate.mockResolvedValue({
      _sum: { payableAmount: 1000 },
    });
    prisma.paymentOutRecord.aggregate
      .mockResolvedValueOnce({ _sum: { paymentAmount: 250 } })
      .mockResolvedValueOnce({ _sum: { paymentAmount: 50 } });
  });

  test('客户对账统计应排除已作废应付，避免作废费用继续挂在应付余额中', async () => {
    const { getCustomerStatementStatistics } = await import(
      '@/lib/services/customer-statement-service'
    );

    const result = await getCustomerStatementStatistics();

    expect(result).toEqual({
      totalCustomers: 12,
      activeCustomers: 0,
      totalReceivableBalance: 0,
      totalPayableBalance: 700,
      totalNetBalance: -700,
      overdueCustomers: 0,
      monthlyActiveCustomers: 0,
    });

    expect(prisma.payableRecord.aggregate).toHaveBeenCalledWith({
      where: {
        status: { not: 'cancelled' },
        voidedAt: null,
      },
      _sum: { payableAmount: true },
    });
  });
});
