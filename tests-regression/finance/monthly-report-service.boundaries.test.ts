jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    inboundRecord: {
      aggregate: jest.fn(),
    },
    outboundRecord: {
      aggregate: jest.fn(),
    },
    inventoryAdjustment: {
      aggregate: jest.fn(),
    },
    accountStatement: {
      aggregate: jest.fn(),
    },
    payableRecord: {
      aggregate: jest.fn(),
    },
    paymentRecord: {
      aggregate: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
    factoryShipmentOrder: {
      findMany: jest.fn(),
    },
  },
}));

describe('monthly-report-service：口径/边界（集成回归）', () => {
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
    prisma.salesOrder.groupBy.mockResolvedValue([]);

    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 0 },
      _count: { id: 0 },
    });
    prisma.expenseRecord.groupBy.mockResolvedValue([]);

    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.inventoryAdjustment.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });

    prisma.accountStatement.aggregate.mockResolvedValue({
      _sum: { currentBalance: 0 },
    });
    prisma.payableRecord.aggregate.mockResolvedValue({
      _sum: { payableAmount: 0, paidAmount: 0, remainingAmount: 0 },
    });
    prisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { actualPaymentAmount: 0 },
    });
    prisma.paymentOutRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 0 },
    });

    prisma.inventory.findMany.mockResolvedValue([]);
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);
  });

  test('includeComparison=true：1月应回溯上一年12月做环比', async () => {
    const { getMonthlyReport } = await import(
      '@/lib/services/monthly-report-service'
    );

    await getMonthlyReport(2025, 1, true);

    const expectedPrevStart = new Date(2024, 11, 1);
    const expectedPrevEnd = new Date(2024, 12, 0, 23, 59, 59, 999);

    const revenueCalls = (prisma.salesOrder.aggregate as jest.Mock).mock.calls
      .map(([args]: any[]) => args)
      .filter((args: any) => args?._sum?.totalAmount);

    const hasPrevRevenueQuery = revenueCalls.some((args: any) => {
      const gte = args?.where?.createdAt?.gte as Date | undefined;
      const lte = args?.where?.createdAt?.lte as Date | undefined;
      return (
        gte instanceof Date &&
        lte instanceof Date &&
        gte.getTime() === expectedPrevStart.getTime() &&
        lte.getTime() === expectedPrevEnd.getTime()
      );
    });

    expect(hasPrevRevenueQuery).toBe(true);
  });

  test('费用口径：应排除 relatedType=purchase_order 且生产环境强制 dataTag=prod + voidedAt=null', async () => {
    const { getMonthlyReport } = await import(
      '@/lib/services/monthly-report-service'
    );

    await getMonthlyReport(2025, 1, false);

    const expenseCalls = [
      ...(prisma.expenseRecord.aggregate as jest.Mock).mock.calls,
      ...(prisma.expenseRecord.groupBy as jest.Mock).mock.calls,
    ];

    expect(expenseCalls.length).toBeGreaterThan(0);

    for (const [args] of expenseCalls) {
      const where = args?.where as any;
      expect(where?.relatedType).toEqual({ not: 'purchase_order' });
      expect(where?.voidedAt).toBeNull();
      expect(where?.dataTag).toBe('prod');
      expect(where?.expenseDate?.gte).toBeInstanceOf(Date);
      expect(where?.expenseDate?.lte).toBeInstanceOf(Date);
    }
  });

  test('成本口径：入库统计应排除 opening_balance，且 purchaseOrder 走可见性过滤', async () => {
    const { getMonthlyReport } = await import(
      '@/lib/services/monthly-report-service'
    );

    await getMonthlyReport(2025, 1, false);

    const inboundCalls = (prisma.inboundRecord.aggregate as jest.Mock).mock
      .calls;
    expect(inboundCalls.length).toBeGreaterThan(0);

    const firstInboundWhere = inboundCalls[0]?.[0]?.where as any;
    expect(firstInboundWhere?.reason).toEqual({ not: 'opening_balance' });
    expect(firstInboundWhere?.purchaseOrder?.is).toEqual(
      expect.objectContaining({
        voidedAt: null,
        dataTag: 'prod',
      })
    );
  });

  test('库存周转：分页聚合 inventory.findMany 并正确计算期初/期末/周转率', async () => {
    prisma.salesOrder.aggregate.mockImplementation(async (args: any) => {
      if (args?._sum?.costAmount && !args?._sum?.totalAmount) {
        return { _sum: { costAmount: 310 } };
      }
      return {
        _sum: { totalAmount: 0, itemsAmount: 0 },
        _count: { id: 0 },
      };
    });

    prisma.inventory.findMany
      .mockResolvedValueOnce([
        { id: 'inv1', quantity: 10, unitCost: 2 },
        { id: 'inv2', quantity: 5, unitCost: 4 },
      ])
      .mockResolvedValueOnce([{ id: 'inv3', quantity: 1, unitCost: 100 }])
      .mockResolvedValueOnce([]);

    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 40 },
    });
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 70 },
    });

    const { getMonthlyReport } = await import(
      '@/lib/services/monthly-report-service'
    );
    const report = await getMonthlyReport(2025, 1, false);

    expect(prisma.inventory.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.inventory.findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        cursor: { id: 'inv2' },
        skip: 1,
      })
    );

    expect(report.inventoryTurnover.endingInventory).toBe(140);
    expect(report.inventoryTurnover.beginningInventory).toBe(170);
    expect(report.inventoryTurnover.averageInventoryValue).toBe(155);
    expect(report.inventoryTurnover.turnoverRate).toBe(2);
    expect(report.inventoryTurnover.turnoverDays).toBe(15);
  });
});
