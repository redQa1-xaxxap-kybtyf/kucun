import { jest } from '@jest/globals';

import { revalidateFinance } from '@/lib/cache/revalidate';
import { CacheTags } from '@/lib/cache/tags';
import * as financeCached from '@/lib/services/finance-statistics-cached';

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/redis/redis-pubsub', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
}));

jest.mock('@/lib/redis/redis-client', () => ({
  redis: {
    scanDel: jest.fn().mockResolvedValue(0),
  },
}));

describe('revalidateFinance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('receivables 级联时会删除 statements 列表缓存', async () => {
    const invalidateSpy = jest.spyOn(
      financeCached,
      'invalidateStatementsCache'
    );

    await revalidateFinance('receivables');

    const { redis } = await import('@/lib/redis/redis-client');

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(redis.scanDel).toHaveBeenCalledWith(
      `${CacheTags.Finance.receivables}*`
    );
    expect(redis.scanDel).toHaveBeenCalledWith(
      `${CacheTags.Finance.statementsList}*`
    );
  });
});
