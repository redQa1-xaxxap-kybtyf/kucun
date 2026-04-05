import { SalesOrderExportService } from '@/lib/services/sales-order-export-service';

describe('sales-order-export-service（收款文案回归）', () => {
  test('订单摘要应输出“已收金额”而不是“已付金额”', () => {
    const summary = (SalesOrderExportService as any).prepareOrderSummaryData({
      orderNumber: 'SO-001',
      customer: {
        name: '客户A',
        phone: '13800000000',
      },
      status: 'confirmed',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      shippedAt: new Date('2026-01-02T00:00:00.000Z'),
      items: [{ quantity: 10 }],
      totalAmount: 100,
      roundingAdjustment: 0,
      isSampleOrder: false,
      sampleSettlementType: null,
      paymentRecords: [
        {
          status: 'confirmed',
          paymentAmount: 60,
        },
      ],
      prepaymentUsages: [
        {
          appliedAmount: 20,
        },
      ],
      prepaymentTotalApplied: 20,
      remarks: '测试订单',
    });

    expect(summary).toEqual(
      expect.objectContaining({
        订单号: 'SO-001',
        客户名称: '客户A',
        已收金额: 80,
        未付金额: 20,
      })
    );
    expect('已付金额' in summary).toBe(false);
  });
});
