jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      aggregate: jest.fn(),
    },
    factoryShipmentOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    inboundRecord: {
      aggregate: jest.fn(),
    },
    outboundRecord: {
      aggregate: jest.fn(),
    },
    expenseRecord: {
      groupBy: jest.fn(),
    },
    refundRecord: {
      aggregate: jest.fn(),
    },
  },
}));

describe('profit-loss-service：趋势分组/日期边界（集成回归）', () => {
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
      _sum: { totalAmount: 0, itemsAmount: 0, costAmount: 0 },
      _count: { id: 0 },
    });

    prisma.factoryShipmentOrder.aggregate.mockResolvedValue({
      _sum: { receivableAmount: 0 },
      _count: { id: 0 },
    });
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);

    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.expenseRecord.groupBy.mockResolvedValue([]);
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { processedAmount: 0 },
    });
  });

  test('groupBy=day：按天拆分趋势', async () => {
    const { getProfitLossAnalysis } = await import(
      '@/lib/services/profit-loss-service'
    );

    const result = await getProfitLossAnalysis(
      '2025-01-01',
      '2025-01-03',
      'day',
      false
    );

    expect(result.trend).toHaveLength(3);
    expect(result.trend.map(item => item.date)).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
    ]);
    expect(result.trend.map(item => item.dateLabel)).toEqual([
      '1/1',
      '1/2',
      '1/3',
    ]);
  });

  test('groupBy=week：按7天窗口拆分趋势，末段应截断到 endDate', async () => {
    const { getProfitLossAnalysis } = await import(
      '@/lib/services/profit-loss-service'
    );

    const result = await getProfitLossAnalysis(
      '2025-01-01',
      '2025-01-10',
      'week',
      false
    );

    expect(result.trend).toHaveLength(2);
    expect(result.trend.map(item => item.dateLabel)).toEqual([
      '1/1-1/7',
      '1/8-1/10',
    ]);
  });

  test('groupBy=month：跨月且 startDate 非 1 号时应无缺口覆盖全部月份', async () => {
    const { getProfitLossAnalysis } = await import(
      '@/lib/services/profit-loss-service'
    );

    const result = await getProfitLossAnalysis(
      '2025-01-15',
      '2025-03-02',
      'month',
      false
    );

    expect(result.trend).toHaveLength(3);
    expect(result.trend.map(item => item.date)).toEqual([
      '2025-01-15',
      '2025-02-01',
      '2025-03-01',
    ]);
    expect(result.trend.map(item => item.dateLabel)).toEqual([
      '2025-01',
      '2025-02',
      '2025-03',
    ]);
  });

  test('includeComparison=true：应返回 comparison 字段', async () => {
    const { getProfitLossAnalysis } = await import(
      '@/lib/services/profit-loss-service'
    );

    const result = await getProfitLossAnalysis(
      '2025-01-01',
      '2025-01-01',
      'day',
      true
    );

    expect(result.comparison).toEqual(
      expect.objectContaining({
        revenue: expect.any(Object),
        profit: expect.any(Object),
      })
    );
  });
});
