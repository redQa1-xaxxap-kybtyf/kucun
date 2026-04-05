jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

import { getSalesOrders } from '@/lib/api/handlers/sales-orders/list';
import { prisma } from '@/lib/db';
import { getSystemMode } from '@/lib/services/system-mode-service';

describe('sales order pending filter', () => {
  const createSalesOrderRecord = (
    status: 'draft' | 'confirmed' | 'shipped' | 'completed' | 'cancelled',
    id: string
  ) => ({
    id,
    orderNumber: `SO-${id}`,
    customerId: 'cust-1',
    userId: 'user-1',
    status,
    orderType: 'NORMAL',
    transferMode: 'SUPPLIER_ONLY',
    isSampleOrder: false,
    sampleSettlementType: 'FREE',
    supplierId: null,
    costAmount: 0,
    expenseAmount: 0,
    profitAmount: 0,
    itemsAmount: 0,
    additionalFees: 0,
    totalAmount: 0,
    paidAmount: 0,
    roundingAdjustment: 0,
    prepaymentAmount: 0,
    remarks: null,
    shippedAt: null,
    createdAt: new Date('2026-03-19T08:00:00.000Z'),
    updatedAt: new Date('2026-03-19T08:00:00.000Z'),
    customer: {
      id: 'cust-1',
      name: '测试客户',
      phone: null,
      address: null,
    },
    user: {
      id: 'user-1',
      name: '测试业务员',
    },
    items: [],
    payments: [],
    returnOrders: [],
    _count: {
      items: 0,
    },
  });

  const prismaMock = prisma as unknown as {
    salesOrder: {
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    product: {
      findMany: jest.Mock;
    };
  };

  const getSystemModeMock = getSystemMode as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getSystemModeMock.mockResolvedValue('production');
    prismaMock.salesOrder.findMany.mockResolvedValue([]);
    prismaMock.salesOrder.count.mockResolvedValue(0);
    prismaMock.salesOrder.groupBy.mockResolvedValue([]);
    prismaMock.product.findMany.mockResolvedValue([]);
  });

  it('maps pending list filter to draft and confirmed sales orders', async () => {
    prismaMock.salesOrder.groupBy.mockResolvedValue([
      { status: 'draft', _count: { _all: 2 } },
      { status: 'confirmed', _count: { _all: 1 } },
    ]);

    await getSalesOrders({
      page: 1,
      limit: 20,
      status: 'pending',
    });

    expect(prismaMock.salesOrder.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: {
            in: ['draft', 'confirmed'],
          },
        }),
      })
    );

    expect(prismaMock.salesOrder.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'draft',
        }),
      })
    );

    expect(prismaMock.salesOrder.findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'confirmed',
        }),
      })
    );

    expect(prismaMock.salesOrder.count).not.toHaveBeenCalled();
  });

  it('keeps actionable orders ahead of completed ones on the default first page', async () => {
    prismaMock.salesOrder.groupBy.mockResolvedValue([
      { status: 'confirmed', _count: { _all: 1 } },
      { status: 'shipped', _count: { _all: 1 } },
      { status: 'completed', _count: { _all: 5 } },
    ]);
    prismaMock.salesOrder.findMany
      .mockResolvedValueOnce([createSalesOrderRecord('confirmed', 'confirmed-1')])
      .mockResolvedValueOnce([createSalesOrderRecord('shipped', 'shipped-1')]);

    await getSalesOrders({
      page: 1,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(prismaMock.salesOrder.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.salesOrder.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'confirmed',
        }),
      })
    );
    expect(prismaMock.salesOrder.findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'shipped',
        }),
      })
    );
  });

  it('keeps draft orders ahead of confirmed orders on the default first page', async () => {
    prismaMock.salesOrder.groupBy.mockResolvedValue([
      { status: 'draft', _count: { _all: 1 } },
      { status: 'confirmed', _count: { _all: 2 } },
      { status: 'completed', _count: { _all: 5 } },
    ]);
    prismaMock.salesOrder.findMany
      .mockResolvedValueOnce([createSalesOrderRecord('draft', 'draft-1')])
      .mockResolvedValueOnce([createSalesOrderRecord('confirmed', 'confirmed-1')]);

    const result = await getSalesOrders({
      page: 1,
      limit: 2,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(prismaMock.salesOrder.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.salesOrder.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'draft',
        }),
      })
    );
    expect(prismaMock.salesOrder.findMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dataTag: 'prod',
          voidedAt: null,
          status: 'confirmed',
        }),
      })
    );
    expect(result.data.map(order => order.status)).toEqual([
      'draft',
      'confirmed',
    ]);
  });
});
