jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => ({
  env: {
    EXPENSE_TO_PAYABLE_ENABLED: false,
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

describe('/api/finance/payables/statistics（口径回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.payableRecord.aggregate.mockImplementation(
      async ({ _sum, where }: any) => {
        if (_sum?.paidAmount) {
          return { _sum: { paidAmount: 88 } };
        }

        if (_sum?.remainingAmount) {
          return { _sum: { remainingAmount: 12 } };
        }

        if (_sum?.payableAmount && where?.createdAt) {
          return { _sum: { payableAmount: 30 } };
        }

        return { _sum: { payableAmount: 100 } };
      }
    );

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
  });

  test('应付统计应以 payableRecord.paidAmount 作为已核销金额，并保留 thisMonthPayments 为 paymentAmount 记账口径', async () => {
    const { GET } = await import('@/app/api/finance/payables/statistics/route');

    const response = await GET(
      new Request('http://localhost/api/finance/payables/statistics')
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
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
      })
    );

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
});
