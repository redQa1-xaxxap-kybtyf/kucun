jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
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
      groupBy: jest.fn(),
    },
    outboundRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryAdjustment: {
      findMany: jest.fn(),
    },
    manualDamageLedger: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
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
    prisma.salesOrder.findMany.mockResolvedValue([]);

    // 费用汇总假设已包含厂家费用（例如：40）
    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 100 },
    });

    prisma.expenseRecord.groupBy.mockResolvedValue([]);

    prisma.inventory.findMany.mockResolvedValue([]);
    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.inboundRecord.groupBy.mockResolvedValue([]);
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    prisma.outboundRecord.findMany.mockResolvedValue([]);
    prisma.inventoryAdjustment.findMany.mockResolvedValue([]);
    prisma.manualDamageLedger.aggregate.mockResolvedValue({
      _sum: { damagedQuantity: 0, referenceAmount: 0 },
    });
    prisma.manualDamageLedger.groupBy.mockResolvedValue([]);

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
    prisma.inboundRecord.aggregate.mockImplementation(async (args: any) => {
      if (args?._sum?.damagedQuantity) {
        return {
          _sum: { damagedQuantity: 14, damageTotalCost: 140 },
        };
      }

      return {
        _sum: { totalCost: 0 },
      };
    });
    prisma.inboundRecord.groupBy.mockResolvedValue([
      {
        damageHandling: 'supplier_claim',
        _sum: { damagedQuantity: 9, damageTotalCost: 90 },
      },
      {
        damageHandling: 'internal_loss',
        _sum: { damagedQuantity: 5, damageTotalCost: 50 },
      },
    ]);
    prisma.manualDamageLedger.aggregate.mockResolvedValue({
      _sum: { damagedQuantity: 4, referenceAmount: 36 },
    });
    prisma.manualDamageLedger.groupBy.mockImplementation(async (args: any) => {
      const by = args?.by?.[0];
      if (by === 'damageCategory') {
        return [
          {
            damageCategory: 'damage',
            _sum: { damagedQuantity: 1, referenceAmount: 9 },
          },
          {
            damageCategory: 'loss',
            _sum: { damagedQuantity: 3, referenceAmount: 27 },
          },
        ];
      }
      if (by === 'damageHandling') {
        return [
          {
            damageHandling: 'supplier_claim',
            _sum: { damagedQuantity: 2, referenceAmount: 18 },
          },
          {
            damageHandling: 'internal_loss',
            _sum: { damagedQuantity: 2, referenceAmount: 18 },
          },
        ];
      }
      return [];
    });

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
    expect(prisma.manualDamageLedger.groupBy).toHaveBeenCalledTimes(2);
    expect(report.purchaseDamage.totalQuantity).toBe(18);
    expect(report.purchaseDamage.totalAmount).toBe(176);
    expect(report.purchaseDamage.manualDamage.quantity).toBe(4);
    expect(report.purchaseDamage.manualDamage.amount).toBe(36);
    expect(report.purchaseDamage.supplierClaim.quantity).toBe(9);
    expect(report.purchaseDamage.internalLoss.amount).toBe(50);
    expect(report.purchaseDamage.manualDamageByCategory.damage.quantity).toBe(1);
    expect(report.purchaseDamage.manualDamageByCategory.loss.amount).toBe(27);
    expect(
      report.purchaseDamage.manualDamageByHandling.supplierClaim.quantity
    ).toBe(2);
    expect(
      report.purchaseDamage.manualDamageByHandling.internalLoss.amount
    ).toBe(18);
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
