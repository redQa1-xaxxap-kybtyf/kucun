import {
  getDefaultPaymentTerm,
  getPaymentStatusText,
} from '@/lib/utils/payment-terms';

describe('payment-terms utility（口径回归）', () => {
  test('客户账期工具在已完成场景应返回“已收款”而不是“已付款”', () => {
    const term = getDefaultPaymentTerm();
    const dueDate = new Date('2026-04-01T00:00:00.000Z');

    expect(getPaymentStatusText(dueDate, term, true)).toBe('已收款');
  });
});
