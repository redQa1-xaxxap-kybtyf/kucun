import { getCustomerStatementDetail } from '@/lib/services/customer-statement-service';

jest.mock('@/lib/db', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    salesOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    factoryShipmentOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    returnOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRecord: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    refundRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('customer-statement-service refund sign', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  const mockZeroAggregates = () => {
    prisma.factoryShipmentOrder.aggregate.mockResolvedValue({
      _sum: { receivableAmount: 0 },
    });
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);

    prisma.returnOrder.aggregate.mockResolvedValue({
      _sum: { refundAmount: 0 },
    });
    prisma.returnOrder.findMany.mockResolvedValue([]);

    prisma.refundRecord.findMany.mockResolvedValue([]);
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { processedAmount: 0, refundAmount: 0 },
    });
    prisma.paymentOutRecord.findMany.mockResolvedValue([]);
    prisma.paymentOutRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 0 },
    });
    prisma.supplier.findFirst.mockResolvedValue(null);

    prisma.salesOrder.findMany.mockResolvedValue([]);
    prisma.paymentRecord.findMany.mockResolvedValue([]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-001',
      name: '测试客户',
      phone: null,
      address: null,
    });
    mockZeroAggregates();
  });

  test('sale=100, payment_in=100, refund=10 => closingBalance=10（退款冲回已收款）', async () => {
    // openingBalance(before startDate) 与 period summary 复用同一批 aggregate mock；
    // 这里按 where 的时间过滤区分，避免把当期数据算进期初导致 closingBalance 偏移。
    prisma.salesOrder.aggregate.mockImplementation(({ where }: any) => {
      const createdAt = where?.createdAt;
      const isOpening = Boolean(createdAt?.lte) && !createdAt?.gte;
      return Promise.resolve({
        _sum: { totalAmount: isOpening ? 0 : 100, roundingAdjustment: 0 },
      });
    });

    prisma.paymentRecord.groupBy.mockImplementation(({ where }: any) => {
      const paymentDate = where?.paymentDate;
      const isOpening = Boolean(paymentDate?.lte) && !paymentDate?.gte;
      if (isOpening) return Promise.resolve([]);
      return Promise.resolve([
        {
          paymentType: 'order_payment',
          _sum: { paymentAmount: 100 },
        },
      ]);
    });

    prisma.refundRecord.findMany.mockResolvedValue([
      {
        id: 'refund-001',
        refundNumber: 'RF-001',
        refundAmount: 10,
        processedAmount: 10,
        remainingAmount: 0,
        refundDate: new Date('2025-01-03'),
        refundMethod: 'cash',
        refundType: 'return_refund',
        status: 'completed',
        returnOrderId: null,
      },
    ]);

    const detail = await getCustomerStatementDetail(
      'customer-001',
      '2025-01-01',
      '2025-01-31'
    );

    expect(detail.summary.receivables.receivableBalance).toBe(10);
    expect(detail.closingBalance).toBe(10);

    const refundTx = detail.transactions.find(
      tx => tx.transactionType === 'refund_out'
    );
    expect(refundTx).toEqual(
      expect.objectContaining({
        debitAmount: 10,
        creditAmount: 0,
        status: 'completed',
      })
    );
  });
});
