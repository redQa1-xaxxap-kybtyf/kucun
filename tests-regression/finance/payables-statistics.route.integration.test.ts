jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      public readonly body: unknown,
      public readonly status: number
    ) {}

    async json() {
      return this.body;
    }
  }

  return {
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) =>
      handler(request, {
        ...context,
        user: {
          id: 'test-user',
          role: 'admin',
          permissions: ['finance:view', 'finance:manage'],
        },
      }),
}));

jest.mock('@/lib/env', () => ({
  env: {
    EXPENSE_TO_PAYABLE_ENABLED: true,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    payableRecord: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
    },
  },
}));

describe('/api/finance/payables/statistics 采购运费口径回归', () => {
  const { env } = jest.requireMock('@/lib/env') as {
    env: {
      EXPENSE_TO_PAYABLE_ENABLED: boolean;
    };
  };

  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      payableRecord: {
        aggregate: jest.Mock;
        groupBy: jest.Mock;
      };
      paymentOutRecord: {
        aggregate: jest.Mock;
      };
      expenseRecord: {
        aggregate: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    env.EXPENSE_TO_PAYABLE_ENABLED = true;

    prisma.payableRecord.aggregate
      .mockResolvedValueOnce({ _sum: { payableAmount: 1000 } })
      .mockResolvedValueOnce({ _sum: { paidAmount: 200 } })
      .mockResolvedValueOnce({ _sum: { remainingAmount: 800 } })
      .mockResolvedValueOnce({ _sum: { payableAmount: 300 } });
    prisma.payableRecord.groupBy.mockResolvedValue([]);
    prisma.paymentOutRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 120 },
    });
    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 88 },
    });
  });

  test('应继续以 payableRecord.paidAmount 作为已核销金额，并保留 thisMonthPayments 为 paymentAmount 口径', async () => {
    env.EXPENSE_TO_PAYABLE_ENABLED = false;

    prisma.payableRecord.aggregate.mockReset();
    prisma.payableRecord.groupBy.mockReset();
    prisma.paymentOutRecord.aggregate.mockReset();
    prisma.expenseRecord.aggregate.mockReset();

    prisma.payableRecord.aggregate
      .mockResolvedValueOnce({ _sum: { payableAmount: 100 } })
      .mockResolvedValueOnce({ _sum: { paidAmount: 88 } })
      .mockResolvedValueOnce({ _sum: { remainingAmount: 12 } })
      .mockResolvedValueOnce({ _sum: { payableAmount: 30 } });
    prisma.payableRecord.groupBy.mockResolvedValue([
      { status: 'pending', _count: { id: 2 } },
      { status: 'partial', _count: { id: 1 } },
      { status: 'paid', _count: { id: 3 } },
    ]);
    prisma.paymentOutRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 66 },
    });
    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 5 },
    });

    const { GET } = await import('@/app/api/finance/payables/statistics/route');
    const response = await GET({
      url: 'http://localhost/api/finance/payables/statistics',
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({
        totalPayables: 100,
        totalPaidAmount: 88,
        totalRemainingAmount: 12,
        thisMonthPayables: 30,
        thisMonthPayments: 66,
        purchaseGoodsAmount: 100,
        purchaseFreightAmount: 5,
        purchaseTotalCost: 105,
      }),
    });

    expect(prisma.payableRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { paidAmount: true },
      })
    );
    expect(prisma.paymentOutRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { paymentAmount: true },
        where: expect.objectContaining({
          status: 'confirmed',
          paymentDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  test('应排除已作废采购费用，避免继续计入采购运费和总成本', async () => {
    const { GET } = await import('@/app/api/finance/payables/statistics/route');
    const response = await GET({
      url: 'http://localhost/api/finance/payables/statistics?supplierId=supplier-1&startDate=2026-04-01&endDate=2026-04-30',
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({
        totalPayables: 1000,
        purchaseGoodsAmount: 912,
        purchaseFreightAmount: 88,
        purchaseTotalCost: 1000,
      }),
    });

    expect(prisma.expenseRecord.aggregate).toHaveBeenCalledWith({
      _sum: { expenseAmount: true },
      where: expect.objectContaining({
        relatedType: 'purchase_order',
        payableId: { not: null },
        supplierId: 'supplier-1',
        status: 'approved',
        voidedAt: null,
        expenseDate: expect.objectContaining({
          gte: new Date('2026-04-01'),
          lte: expect.any(Date),
        }),
      }),
    });
  });
});
