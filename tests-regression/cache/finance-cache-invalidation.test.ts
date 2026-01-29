jest.mock('@/lib/cache/revalidate', () => ({
  revalidateFinance: jest.fn(async () => undefined),
  revalidateSalesOrders: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/finance-statistics-cached', () => ({
  invalidateStatementsCache: jest.fn(async () => undefined),
  invalidateFinanceSummaryCache: jest.fn(async () => undefined),
}));

jest.mock('@/lib/redis/redis-client', () => ({
  redis: {
    scanDel: jest.fn(async () => 0),
  },
}));

jest.mock('@/lib/utils/console-logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  clearCacheAfterPayment,
  clearCacheAfterPaymentOut,
  clearCacheAfterRefund,
} from '@/lib/cache/finance-cache';

describe('finance-cache invalidation', () => {
  const { revalidateFinance, revalidateSalesOrders } = jest.requireMock(
    '@/lib/cache/revalidate'
  ) as {
    revalidateFinance: jest.Mock;
    revalidateSalesOrders: jest.Mock;
  };

  const { invalidateStatementsCache, invalidateFinanceSummaryCache } =
    jest.requireMock('@/lib/services/finance-statistics-cached') as {
      invalidateStatementsCache: jest.Mock;
      invalidateFinanceSummaryCache: jest.Mock;
    };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clearCacheAfterPayment：应失效 receivables + statements/summary + salesOrders', async () => {
    await clearCacheAfterPayment();

    expect(revalidateFinance).toHaveBeenCalledWith('receivables');
    expect(invalidateStatementsCache).toHaveBeenCalledTimes(1);
    expect(invalidateFinanceSummaryCache).toHaveBeenCalledTimes(1);
    expect(revalidateSalesOrders).toHaveBeenCalledTimes(1);
  });

  it('clearCacheAfterPaymentOut：应失效 payables + payments + statements/summary', async () => {
    await clearCacheAfterPaymentOut();

    expect(revalidateFinance).toHaveBeenCalledWith('payables');
    expect(revalidateFinance).toHaveBeenCalledWith('payments');
    expect(invalidateStatementsCache).toHaveBeenCalledTimes(1);
    expect(invalidateFinanceSummaryCache).toHaveBeenCalledTimes(1);
  });

  it('clearCacheAfterRefund：应失效 refunds + statements/summary', async () => {
    await clearCacheAfterRefund();

    expect(revalidateFinance).toHaveBeenCalledWith('refunds');
    expect(invalidateStatementsCache).toHaveBeenCalledTimes(1);
    expect(invalidateFinanceSummaryCache).toHaveBeenCalledTimes(1);
  });
});
