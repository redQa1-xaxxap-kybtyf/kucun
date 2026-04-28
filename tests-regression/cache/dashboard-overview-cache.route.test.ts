jest.mock('@/lib/cache', () => ({
  buildCacheKey: jest.fn(
    (prefix: string, parts: Record<string, unknown>) =>
      `${prefix}:${JSON.stringify(parts)}`
  ),
  getOrSetWithLock: jest.fn(async (_key: string, fn: () => Promise<unknown>) =>
    fn()
  ),
  CACHE_STRATEGY: {
    aggregateData: {
      redisTTL: 600,
    },
  },
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any, _options?: { permissions?: string[] }) =>
    async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: ['dashboard:view'],
      };
      return handler(request, { ...(context ?? {}), user });
    },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('dashboard overview cache route', () => {
  const { buildCacheKey, getOrSetWithLock } = jest.requireMock('@/lib/cache') as {
    buildCacheKey: jest.Mock;
    getOrSetWithLock: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getOrSetWithLock.mockResolvedValue({
      sales: { totalRevenue: 1000 },
      inventory: { totalProducts: 10 },
      returns: { totalReturns: 1 },
      customers: { totalCustomers: 5 },
    });
  });

  test('GET /api/dashboard/overview：合法参数应使用 getOrSetWithLock 走缓存', async () => {
    const { GET } = await import('@/app/api/dashboard/overview/route');

    const response = await GET({
      url: 'http://localhost/api/dashboard/overview?timeRange=30d',
    } as any);

    expect(response.status).toBe(200);
    expect(buildCacheKey).toHaveBeenCalledWith('dashboard:overview', {
      timeRange: '30d',
    });
    expect(getOrSetWithLock).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sales: expect.any(Object),
          inventory: expect.any(Object),
        }),
        _cached: true,
      })
    );
  });

  test('GET /api/dashboard/overview：非法参数应返回 400，且不进入缓存逻辑', async () => {
    const { GET } = await import('@/app/api/dashboard/overview/route');

    const response = await GET({
      url: 'http://localhost/api/dashboard/overview?timeRange=bad-range',
    } as any);

    expect(response.status).toBe(400);
    expect(getOrSetWithLock).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '请求内容有误，请稍后重试',
        details: expect.any(Array),
      })
    );
  });
});
