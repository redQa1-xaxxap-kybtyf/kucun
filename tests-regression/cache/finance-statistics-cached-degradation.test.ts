jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/redis/redis-client', () => ({
  redis: {
    getJson: jest.fn(async () => null),
    setJson: jest.fn(async () => undefined),
    scanDel: jest.fn(async () => 0),
    getMemoryCacheStats: jest.fn(),
  },
}));

jest.mock('@/lib/services/finance-statistics', () => ({
  getStatementsList: jest.fn(),
  getFinanceSummary: jest.fn(),
}));

import {
  getFinanceSummary,
  getStatementsList,
} from '@/lib/services/finance-statistics-cached';

describe('finance-statistics-cached degradation', () => {
  const { redis } = jest.requireMock('@/lib/redis/redis-client') as {
    redis: {
      getJson: jest.Mock;
      setJson: jest.Mock;
    };
  };

  const financeService = jest.requireMock(
    '@/lib/services/finance-statistics'
  ) as {
    getStatementsList: jest.Mock;
    getFinanceSummary: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getStatementsList：缓存命中应直接返回，不回源/不写缓存', async () => {
    const cached = {
      data: [{ entityId: 'ent-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      summary: {
        totalCustomers: 0,
        totalSuppliers: 1,
        totalReceivable: 0,
        totalPayable: 0,
      },
    };

    redis.getJson.mockResolvedValue(cached);

    const result = await getStatementsList({ page: 1, limit: 20 } as any);
    expect(result).toBe(cached);

    expect(financeService.getStatementsList).not.toHaveBeenCalled();
    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('getStatementsList：缓存未命中应回源并写入缓存', async () => {
    redis.getJson.mockResolvedValue(null);
    financeService.getStatementsList.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      summary: {
        totalCustomers: 0,
        totalSuppliers: 0,
        totalReceivable: 0,
        totalPayable: 0,
      },
    });

    const result = await getStatementsList({ page: 1, limit: 20 } as any);
    expect(result.pagination.page).toBe(1);

    expect(financeService.getStatementsList).toHaveBeenCalledTimes(1);
    expect(redis.setJson).toHaveBeenCalledTimes(1);

    const [cacheKey, payload, ttl] = (redis.setJson as jest.Mock).mock
      .calls[0] as [string, unknown, number];
    expect(cacheKey).toContain('finance:statements:list:');
    expect(payload).toEqual(result);
    expect(ttl).toBe(300);
  });

  it('getStatementsList：Redis 读取失败应降级回源，不影响正确性', async () => {
    redis.getJson.mockRejectedValue(new Error('redis down'));
    financeService.getStatementsList.mockResolvedValue({
      data: [{ entityId: 'ent-2' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      summary: {
        totalCustomers: 1,
        totalSuppliers: 0,
        totalReceivable: 1,
        totalPayable: 0,
      },
    });

    const result = await getStatementsList({ page: 1, limit: 20 } as any);
    expect(result.data).toEqual([{ entityId: 'ent-2' }]);
    expect(financeService.getStatementsList).toHaveBeenCalledTimes(1);
  });

  it('getStatementsList：Redis 写入失败不应阻塞返回', async () => {
    redis.getJson.mockResolvedValue(null);
    redis.setJson.mockRejectedValue(new Error('redis write down'));
    financeService.getStatementsList.mockResolvedValue({
      data: [{ entityId: 'ent-3' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      summary: {
        totalCustomers: 1,
        totalSuppliers: 0,
        totalReceivable: 1,
        totalPayable: 0,
      },
    });

    const result = await getStatementsList({ page: 1, limit: 20 } as any);
    expect(result.data).toEqual([{ entityId: 'ent-3' }]);
    expect(financeService.getStatementsList).toHaveBeenCalledTimes(1);
  });

  it('getFinanceSummary：Redis 读取失败应降级回源', async () => {
    redis.getJson.mockRejectedValue(new Error('redis down'));
    financeService.getFinanceSummary.mockResolvedValue({
      totalCustomers: 1,
      totalSuppliers: 2,
      totalReceivable: 10,
      totalPayable: 20,
    });

    const result = await getFinanceSummary();
    expect(result.totalCustomers).toBe(1);
    expect(financeService.getFinanceSummary).toHaveBeenCalledTimes(1);
  });
});
