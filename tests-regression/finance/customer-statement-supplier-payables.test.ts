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
    payableRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('customer-statement-service supplier(payables) side', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-001',
      name: '测试客户',
      phone: '13800000000',
      address: null,
    });

    prisma.supplier.findFirst.mockResolvedValue({ id: 'supplier-001' });

    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, roundingAdjustment: 0 },
    });
    prisma.factoryShipmentOrder.aggregate.mockResolvedValue({
      _sum: { receivableAmount: 0 },
    });
    prisma.returnOrder.aggregate.mockResolvedValue({
      _sum: { refundAmount: 0 },
    });
    prisma.paymentRecord.groupBy.mockResolvedValue([]);
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { processedAmount: 0, refundAmount: 0 },
    });
    prisma.refundRecord.findMany.mockResolvedValue([]);

    prisma.salesOrder.findMany.mockResolvedValue([]);
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);
    prisma.returnOrder.findMany.mockResolvedValue([]);
    prisma.paymentRecord.findMany.mockResolvedValue([]);

    prisma.payableRecord.aggregate.mockImplementation(({ where }: any) => {
      const createdAt = where?.createdAt;
      const isPeriod = Boolean(createdAt?.gte);
      return Promise.resolve({
        _sum: { payableAmount: isPeriod ? 100 : 0 },
      });
    });

    prisma.paymentOutRecord.aggregate.mockImplementation(({ where }: any) => {
      const paymentDate = where?.paymentDate;
      const isPeriod = Boolean(paymentDate?.gte);
      if (!isPeriod) {
        return Promise.resolve({ _sum: { paymentAmount: 0 } });
      }

      if (where?.payableRecordId?.not === null) {
        return Promise.resolve({ _sum: { paymentAmount: 60 } });
      }

      if (where?.payableRecordId === null) {
        return Promise.resolve({ _sum: { paymentAmount: 10 } });
      }

      return Promise.resolve({ _sum: { paymentAmount: 0 } });
    });

    prisma.payableRecord.findMany.mockResolvedValue([
      {
        id: 'payable-001',
        payableNumber: 'PAY-001',
        payableAmount: 100,
        createdAt: new Date('2025-01-10'),
        sourceType: 'purchase_order',
        sourceNumber: 'PO-001',
        status: 'pending',
      },
    ]);

    prisma.paymentOutRecord.findMany.mockResolvedValue([
      {
        id: 'pout-001',
        payableRecordId: 'payable-001',
        paymentNumber: 'POUT-001',
        paymentAmount: 60,
        paymentDate: new Date('2025-01-11'),
        paymentMethod: 'bank_transfer',
        status: 'confirmed',
      },
      {
        id: 'pout-002',
        payableRecordId: null,
        paymentNumber: 'POUT-002',
        paymentAmount: 10,
        paymentDate: new Date('2025-01-12'),
        paymentMethod: 'bank_transfer',
        status: 'confirmed',
      },
    ]);
  });

  test('采购应付 100，付款 60，预付款 10 => payableBalance=30，closingBalance=-30', async () => {
    const detail = await getCustomerStatementDetail(
      'customer-001',
      '2025-01-01',
      '2025-01-31'
    );

    expect(detail.summary.payables.purchaseAmount).toBe(100);
    expect(detail.summary.payables.paymentPaid).toBe(60);
    expect(detail.summary.payables.prepaymentPaid).toBe(10);
    expect(detail.summary.payables.payableBalance).toBe(30);
    expect(detail.summary.netBalance).toBe(-30);
    expect(detail.closingBalance).toBe(-30);

    expect(detail.transactions.map(tx => tx.transactionType)).toEqual(
      expect.arrayContaining([
        'purchase_order',
        'payment_out',
        'prepayment_out',
      ])
    );
  });
});
