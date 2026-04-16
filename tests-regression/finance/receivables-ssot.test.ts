import {
  buildWhereConditions,
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
        orderDate: new Date('2025-01-09T00:00:00Z'),
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
    expect(summary[0].orderDate).toBe('2025-01-09T00:00:00.000Z');

    const detail = transformToReceivable({
      id: 'o-prepay-2',
      orderNumber: 'SO-PREPAY-2',
      customerId: 'c-1',
      totalAmount: 100,
      roundingAdjustment: 0,
      orderDate: new Date('2025-01-08T00:00:00Z'),
      createdAt: new Date('2025-01-11T00:00:00Z'),
      customer: { id: 'c-1', name: '客户A', phone: null },
      payments: [],
      prepaymentUsages: [{ appliedAmount: 50 }],
    } as any);

    expect(detail.paidAmount).toBe(50);
    expect(detail.remainingAmount).toBe(50);
    expect(detail.paymentStatus).toBe('partial');
    expect(detail.orderDate).toBe('2025-01-08T00:00:00.000Z');
  });

  it('系统自动确认应收占位记录不应计入真实收款口径', () => {
    const detail = transformToReceivable({
      id: 'o-auto-1',
      orderNumber: 'SO-AUTO-1',
      customerId: 'c-1',
      totalAmount: 100,
      roundingAdjustment: -2,
      createdAt: new Date('2025-01-12T00:00:00Z'),
      customer: { id: 'c-1', name: '客户A', phone: null },
      payments: [
        {
          actualPaymentAmount: 0,
          roundingAmount: -2,
          paymentDate: new Date('2025-01-15T00:00:00Z'),
          status: 'confirmed',
          remarks: '系统自动生成：销售订单 SO-AUTO-1 确认应收',
        },
        {
          actualPaymentAmount: 40,
          roundingAmount: 0,
          paymentDate: new Date('2025-01-13T00:00:00Z'),
          status: 'confirmed',
          remarks: '首笔实收',
        },
        {
          actualPaymentAmount: 10,
          roundingAmount: 0,
          paymentDate: new Date('2025-01-14T00:00:00Z'),
          status: 'pending',
          remarks: '待确认实收',
        },
      ],
      prepaymentUsages: [],
    } as any);

    expect(detail.paidAmount).toBe(40);
    expect(detail.paymentRoundingAmount).toBe(0);
    expect(detail.pendingAmount).toBe(10);
    expect(detail.remainingAmount).toBe(58);
    expect(detail.paymentStatus).toBe('pending');
    expect(detail.lastPaymentDate).toBe('2025-01-14T00:00:00.000Z');
  });

  it('免费样品单不应进入应收口径', () => {
    const where = buildWhereConditions({});

    expect(where).toMatchObject({
      status: { in: ['confirmed', 'shipped', 'completed'] },
      NOT: {
        AND: [
          { isSampleOrder: true },
          {
            sampleSettlementType: 'FREE',
          },
        ],
      },
    });

    const summary = createSummaryReceivables(
      [
        {
          id: 'o-sample-1',
          orderNumber: 'SO-SAMPLE-1',
          customerId: 'c-1',
          isSampleOrder: true,
          sampleSettlementType: 'FREE',
          totalAmount: 100,
          roundingAdjustment: 0,
          orderDate: new Date('2025-01-09T00:00:00Z'),
          createdAt: new Date('2025-01-10T00:00:00Z'),
        },
      ] as any,
      {}
    );

    expect(summary[0].remainingAmount).toBe(0);
    expect(summary[0].paymentStatus).toBe('paid');

    const detail = transformToReceivable({
      id: 'o-sample-2',
      orderNumber: 'SO-SAMPLE-2',
      customerId: 'c-1',
      isSampleOrder: true,
      sampleSettlementType: 'FREE',
      totalAmount: 100,
      roundingAdjustment: 0,
      orderDate: new Date('2025-01-08T00:00:00Z'),
      createdAt: new Date('2025-01-11T00:00:00Z'),
      customer: { id: 'c-1', name: '客户A', phone: null },
      payments: [],
      prepaymentUsages: [],
    } as any);

    expect(detail.remainingAmount).toBe(0);
    expect(detail.paymentStatus).toBe('paid');
  });
});
