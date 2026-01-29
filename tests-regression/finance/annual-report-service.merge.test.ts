jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      aggregate: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
    inboundRecord: {
      aggregate: jest.fn(),
    },
    outboundRecord: {
      aggregate: jest.fn(),
    },
    factoryShipmentOrder: {
      findMany: jest.fn(),
    },
  },
}));

describe('annual-report-service：厂家直发合并口径（集成回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };
  const { getSystemMode } = jest.requireMock(
    '@/lib/services/system-mode-service'
  ) as {
    getSystemMode: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getSystemMode.mockResolvedValue('production');

    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 1000, costAmount: 600 },
      _count: { id: 10 },
    });

    // 费用汇总假设已包含厂家费用（例如：40）
    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 100 },
    });

    prisma.expenseRecord.groupBy.mockResolvedValue([]);

    prisma.inventory.findMany.mockResolvedValue([]);
    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });

    prisma.factoryShipmentOrder.findMany.mockImplementation(
      async (args: any) => {
        if (args?.cursor) {
          return [];
        }
        return [
          {
            id: 'fs-1',
            shipmentDate: new Date('2025-01-05T00:00:00.000Z'),
            totalAmount: 200,
            receivableAmount: 200,
            customerProfit: 10, // 200 - 150 - 40
            selfCostAmount: 150,
            expenseAmount: 40,
            profitAmount: 10,
          },
        ];
      }
    );
  });

  test('合并口径：利润应加回一次厂家费用，避免重复扣减', async () => {
    const { getAnnualReport } = await import(
      '@/lib/services/annual-report-service'
    );

    const report = await getAnnualReport(2025, false);

    expect(report.summary.totalRevenue).toBe(1200);
    expect(report.summary.totalCost).toBe(750);
    expect(report.summary.totalExpenses).toBe(100);
    expect(report.summary.totalProfit).toBe(350);
    expect(report.summary.orderCount).toBe(11);
    expect(report.summary.averageMonthlyRevenue).toBe(100);
    expect(report.summary.profitMargin).toBeCloseTo((350 / 1200) * 100, 6);
    expect(report.yearOverYear).toBeUndefined();
  });

  test('includeYearOverYear=true：应返回 yearOverYear 对比数据结构', async () => {
    const { getAnnualReport } = await import(
      '@/lib/services/annual-report-service'
    );

    const report = await getAnnualReport(2025, true);

    expect(report.yearOverYear).toEqual(
      expect.objectContaining({
        revenue: expect.objectContaining({ current: 1200, previous: 1200 }),
        profit: expect.objectContaining({ current: 350, previous: 350 }),
        expenses: expect.objectContaining({ current: 100, previous: 100 }),
      })
    );
  });
});
