import {
  getAnnualSampleMetrics,
  getSampleMetrics,
} from '@/lib/services/report-sample-helpers';

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: {
    salesOrder: {
      findMany: jest.Mock;
    };
  };
};

describe('report-sample-helpers metrics regression', () => {
  const visibility = { systemMode: 'production' } as any;
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const endDate = new Date('2026-01-31T23:59:59.999Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getSampleMetrics：应按分页累计样品统计并去重客户', async () => {
    prisma.salesOrder.findMany.mockImplementation(
      async (args?: { cursor?: { id: string } }) => {
        if (!args?.cursor?.id) {
          return [
            {
              id: 'sample-001',
              customerId: 'customer-a',
              totalAmount: 60,
              costAmount: 30,
              customer: { name: '甲客户' },
              items: [{ quantity: 3 }],
            },
            {
              id: 'sample-002',
              customerId: 'customer-a',
              totalAmount: 0,
              costAmount: 15,
              customer: { name: '甲客户' },
              items: [{ quantity: 2 }],
            },
          ];
        }

        if (args.cursor.id === 'sample-002') {
          return [
            {
              id: 'sample-003',
              customerId: 'customer-b',
              totalAmount: 100,
              costAmount: 70,
              customer: { name: '乙客户' },
              items: [{ quantity: 5 }],
            },
          ];
        }

        return [];
      }
    );

    const summary = await getSampleMetrics(startDate, endDate, visibility);

    expect(summary).toEqual({
      orderCount: 3,
      customerCount: 2,
      sampleQuantity: 10,
      sampleRevenue: 160,
      sampleCost: 115,
    });
    expect(prisma.salesOrder.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSampleOrder: true,
          status: { in: ['confirmed', 'shipped', 'completed'] },
        }),
      })
    );
  });

  test('getAnnualSampleMetrics：应按数量优先、金额次序返回样品客户榜', async () => {
    prisma.salesOrder.findMany.mockImplementation(
      async (args?: { cursor?: { id: string } }) => {
        if (args?.cursor?.id) {
          return [];
        }

        return [
          {
            id: 'sample-101',
            customerId: 'customer-a',
            totalAmount: 80,
            costAmount: 50,
            customer: { name: '甲客户' },
            items: [{ quantity: 5 }],
          },
          {
            id: 'sample-102',
            customerId: 'customer-b',
            totalAmount: 120,
            costAmount: 72,
            customer: { name: '乙客户' },
            items: [{ quantity: 5 }],
          },
          {
            id: 'sample-103',
            customerId: 'customer-c',
            totalAmount: 30,
            costAmount: 20,
            customer: { name: '丙客户' },
            items: [{ quantity: 8 }],
          },
        ];
      }
    );

    const annual = await getAnnualSampleMetrics(
      startDate,
      endDate,
      visibility,
      2
    );

    expect(annual.orderCount).toBe(3);
    expect(annual.customerCount).toBe(3);
    expect(annual.sampleQuantity).toBe(18);
    expect(annual.sampleRevenue).toBe(230);
    expect(annual.topCustomers).toHaveLength(2);
    expect(annual.topCustomers.map(item => item.customerName)).toEqual([
      '丙客户',
      '乙客户',
    ]);
    expect(annual.topCustomers[0]).toEqual(
      expect.objectContaining({
        sampleQuantity: 8,
        sampleRevenue: 30,
      })
    );
    expect(annual.topCustomers[1]).toEqual(
      expect.objectContaining({
        sampleQuantity: 5,
        sampleRevenue: 120,
      })
    );
  });
});
