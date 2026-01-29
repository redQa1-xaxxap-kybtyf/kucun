import { getStatementsList } from '@/lib/services/finance-statistics';

jest.mock('@/lib/db', () => ({
  prisma: {
    accountStatement: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

describe('finance-statistics getStatementsList date filtering', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      accountStatement: {
        count: jest.Mock;
        findMany: jest.Mock;
        aggregate: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.accountStatement.count.mockResolvedValue(0);
    prisma.accountStatement.aggregate.mockResolvedValue({
      _sum: { currentBalance: 0 },
    });

    // 若实现回退到 updatedAt 过滤，该 mock 会返回一条记录导致断言失败
    prisma.accountStatement.findMany.mockImplementation(
      async ({ where }: any) => {
        if (where?.updatedAt) {
          return [
            {
              entityId: 'customer-001',
              entityName: '测试客户',
              entityType: 'customer',
              partnerRole: 'customer',
              status: 'active',
              totalOrders: 1,
              totalAmount: 100,
              paidAmount: 100,
              currentBalance: 0,
              lastTransactionDate: new Date('2024-12-31'),
              lastPaymentDate: new Date('2025-01-15'),
            },
          ];
        }
        return [];
      }
    );
  });

  test('期间筛选不再使用 updatedAt，应使用 lastTransactionDate/lastPaymentDate', async () => {
    const result = await getStatementsList({
      page: 1,
      limit: 20,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    expect(result.data).toEqual([]);

    expect(prisma.accountStatement.findMany).toHaveBeenCalledTimes(1);
    const [{ where }] = prisma.accountStatement.findMany.mock.calls[0] as [
      { where: any },
    ];

    expect(where.updatedAt).toBeUndefined();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              lastTransactionDate: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            }),
            expect.objectContaining({
              lastTransactionDate: null,
              lastPaymentDate: expect.any(Object),
            }),
          ]),
        }),
      ])
    );
  });
});
