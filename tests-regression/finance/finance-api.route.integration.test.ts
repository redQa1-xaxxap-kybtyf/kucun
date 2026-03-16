jest.mock('@/lib/cache', () => ({
  buildCacheKey: jest.fn((prefix: string, parts: Record<string, unknown>) => `${prefix}:${JSON.stringify(parts)}`),
  getOrSetJSON: jest.fn(async (_key: string, fn: () => Promise<unknown>) =>
    fn()
  ),
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any, _options?: { permissions?: string[] }) => async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: ['finance:view', 'finance:manage'],
      };
      return handler(request, { ...(context ?? {}), user });
    },
}));

jest.mock('@/lib/utils/console-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/services/finance-statistics', () => ({
  getFinanceOverview: jest.fn(),
  getFinanceStatistics: jest.fn(),
}));

describe('/api/finance（集成回归）', () => {
  const { buildCacheKey, getOrSetJSON } = jest.requireMock('@/lib/cache') as {
    buildCacheKey: jest.Mock;
    getOrSetJSON: jest.Mock;
  };

  const { getFinanceOverview, getFinanceStatistics } = jest.requireMock(
    '@/lib/services/finance-statistics'
  ) as {
    getFinanceOverview: jest.Mock;
    getFinanceStatistics: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getOrSetJSON.mockImplementation(async (_key: string, fn: any) => fn());
  });

  test('GET /api/finance：应走缓存并返回 overview 数据', async () => {
    getFinanceOverview.mockResolvedValue({ kind: 'overview' });

    const { GET } = await import('@/app/api/finance/route');
    const response = await GET({} as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { kind: 'overview' },
      })
    );

    expect(buildCacheKey).toHaveBeenCalledWith('finance:overview', {});
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getFinanceOverview).toHaveBeenCalledTimes(1);
  });

  test('GET /api/finance：服务异常应返回 500', async () => {
    getFinanceOverview.mockRejectedValue(new Error('boom'));

    const { GET } = await import('@/app/api/finance/route');
    const response = await GET({} as any);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'boom',
      })
    );
  });

  test('POST /api/finance：参数越界应返回 400（startDate > endDate）', async () => {
    const { POST } = await import('@/app/api/finance/route');
    const response = await POST({
      json: async () => ({
        startDate: '2026-01-31',
        endDate: '2026-01-01',
      }),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '参数验证失败',
        details: expect.any(Array),
      })
    );
    expect(getFinanceStatistics).not.toHaveBeenCalled();
  });

  test('POST /api/finance：参数合法应走缓存并调用 getFinanceStatistics', async () => {
    getFinanceStatistics.mockResolvedValue({ kind: 'statistics' });

    const { POST } = await import('@/app/api/finance/route');
    const response = await POST({
      json: async () => ({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        customerId: 'cust-1',
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { kind: 'statistics' },
      })
    );

    expect(getFinanceStatistics).toHaveBeenCalledTimes(1);
    expect(getFinanceStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        customerId: 'cust-1',
        includeRefunds: true,
        includeStatements: true,
      })
    );

    expect(buildCacheKey).toHaveBeenCalledWith(
      'finance:statistics',
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        customerId: 'cust-1',
      })
    );
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
  });
});
