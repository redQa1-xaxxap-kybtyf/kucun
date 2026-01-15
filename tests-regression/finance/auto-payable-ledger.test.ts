import { ensurePurchaseOrderPayable } from '@/lib/services/purchase-order-payable';

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePayableNumber: jest.fn().mockResolvedValue('PAY-0001'),
}));

describe('purchase-order-payable auto payable ledger', () => {
  const { recordPartnerTransaction } = jest.requireMock(
    '@/lib/services/partner-ledger-service'
  ) as { recordPartnerTransaction: jest.Mock };

  const { generatePayableNumber } = jest.requireMock(
    '@/lib/utils/payment-number-generator'
  ) as { generatePayableNumber: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('自动生成 payable 后写 supplier purchase 流水（referenceId=payableRecord.id）', async () => {
    const createdAt = new Date('2025-01-05T00:00:00.000Z');
    const dueDate = new Date('2025-02-04T00:00:00.000Z');

    generatePayableNumber.mockResolvedValue('PAY-0001');

    const tx = {
      payableRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'payable-001',
          createdAt,
          dueDate,
        }),
      },
      purchaseOrderItem: {
        groupBy: jest.fn().mockResolvedValue([
          { supplierId: 'supplier-001', _sum: { totalPrice: 100 } },
        ]),
      },
      expenseRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    } as any;

    await ensurePurchaseOrderPayable(tx, {
      id: 'purchase-001',
      supplierId: 'supplier-001',
      userId: 'user-001',
      orderNumber: 'PO-001',
      totalAmount: 100,
      expenseAmount: 0,
    });

    expect(tx.payableRecord.create).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);

    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'supplier-001',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount: 100,
        referenceId: 'payable-001',
        referenceNumber: 'PAY-0001',
        occurredAt: createdAt,
        dueDate,
        metadata: expect.objectContaining({
          sourceType: 'purchase_order',
          sourceId: 'purchase-001',
          payableRecordId: 'payable-001',
        }),
      }),
      tx
    );
  });
});

