import {
  PAYABLE_STATUS_LABELS,
  PAYMENT_OUT_STATUS_LABELS,
} from '@/lib/types/payable';

describe('financial terminology labels（防回归）', () => {
  test('应付款状态展示应使用付款语义', () => {
    expect(PAYABLE_STATUS_LABELS.pending).toBe('待付款');
    expect(PAYABLE_STATUS_LABELS.partial).toBe('部分付款');
    expect(PAYABLE_STATUS_LABELS.paid).toBe('已付款');
  });

  test('付款记录状态展示应使用付款进度语义', () => {
    expect(PAYMENT_OUT_STATUS_LABELS.pending).toBe('待确认付款');
    expect(PAYMENT_OUT_STATUS_LABELS.confirmed).toBe('已完成付款');
    expect(PAYMENT_OUT_STATUS_LABELS.cancelled).toBe('已作废');
  });
});
