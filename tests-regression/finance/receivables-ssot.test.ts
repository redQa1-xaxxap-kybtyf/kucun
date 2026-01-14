import {
  calculatePaymentStatus,
  createSummaryReceivables,
  transformToReceivable,
} from '@/lib/services/receivables-helpers';

describe('receivables SSoT regression', () => {
  it('calculatePaymentStatus 使用金额比较而非比例阈值', () => {
    const orderDate = new Date('2025-01-01T00:00:00Z');

    expect(calculatePaymentStatus(999.99, 1000, orderDate, 0)).toBe('partial');
    expect(calculatePaymentStatus(1000, 1000, orderDate, 0)).toBe('paid');
  });

  it('预收冲抵会影响已付/剩余/状态（汇总 + 明细）', () => {
    const orders = [
      {
        id: 'o-prepay-1',
        orderNumber: 'SO-PREPAY-1',
        customerId: 'c-1',
        totalAmount: 100,
        roundingAdjustment: 0,
        createdAt: new Date('2025-01-10T00:00:00Z'),
      },
    ];

    const summary = createSummaryReceivables(orders as any, {
      'o-prepay-1': {
        confirmed: { actual: 0, rounding: 0 },
        pending: { actual: 0, rounding: 0 },
        prepaymentApplied: 30,
      },
    });

    expect(summary[0].paidAmount).toBe(30);
    expect(summary[0].remainingAmount).toBe(70);
    expect(summary[0].paymentStatus).toBe('partial');

    const detail = transformToReceivable({
      id: 'o-prepay-2',
      orderNumber: 'SO-PREPAY-2',
      customerId: 'c-1',
      totalAmount: 100,
      roundingAdjustment: 0,
      createdAt: new Date('2025-01-11T00:00:00Z'),
      customer: { id: 'c-1', name: '客户A', phone: null },
      payments: [],
      prepaymentUsages: [{ appliedAmount: 50 }],
    } as any);

    expect(detail.paidAmount).toBe(50);
    expect(detail.remainingAmount).toBe(50);
    expect(detail.paymentStatus).toBe('partial');
  });
});

