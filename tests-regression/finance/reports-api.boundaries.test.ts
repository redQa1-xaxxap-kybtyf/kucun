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
        permissions: ['finance:view'],
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

jest.mock('@/lib/services/monthly-report-service', () => ({
  getMonthlyReport: jest.fn().mockResolvedValue({ kind: 'monthly-report' }),
}));

jest.mock('@/lib/services/annual-report-service', () => ({
  getAnnualReport: jest.fn().mockResolvedValue({ kind: 'annual-report' }),
}));

jest.mock('@/lib/services/profit-loss-service', () => ({
  getProfitLossAnalysis: jest
    .fn()
    .mockResolvedValue({ kind: 'profit-loss-analysis' }),
}));

describe('财务报表 API：参数/缓存多边界（集成回归）', () => {
  const VALIDATION_ERROR_MESSAGE = '提交内容有误，请检查后重试';
  const { getOrSetJSON, buildCacheKey } = jest.requireMock('@/lib/cache') as {
    getOrSetJSON: jest.Mock;
    buildCacheKey: jest.Mock;
  };
  const { getMonthlyReport } = jest.requireMock(
    '@/lib/services/monthly-report-service'
  ) as { getMonthlyReport: jest.Mock };
  const { getAnnualReport } = jest.requireMock(
    '@/lib/services/annual-report-service'
  ) as { getAnnualReport: jest.Mock };
  const { getProfitLossAnalysis } = jest.requireMock(
    '@/lib/services/profit-loss-service'
  ) as { getProfitLossAnalysis: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    getOrSetJSON.mockImplementation(async (_key: string, fn: any) => fn());
  });

  const expectValidationFailure = (body: unknown) => {
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: VALIDATION_ERROR_MESSAGE,
        details: expect.any(Array),
      })
    );
  };

  test('GET /api/finance/reports/monthly：月份越界应返回 400', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2025&month=13'
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/monthly：forceRefresh=true 应绕过缓存', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2025&month=1&forceRefresh=true'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getOrSetJSON).not.toHaveBeenCalled();
    expect(getMonthlyReport).toHaveBeenCalledTimes(1);
    expect(getMonthlyReport).toHaveBeenCalledWith(2025, 1, true);

    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { kind: 'monthly-report' },
      })
    );
  });

  test('GET /api/finance/reports/monthly：regenerate=true 也应绕过缓存', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2025&month=1&regenerate=true'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getOrSetJSON).not.toHaveBeenCalled();
    expect(getMonthlyReport).toHaveBeenCalledWith(2025, 1, true);
  });

  test('GET /api/finance/reports/monthly：未来月份应返回 400', async () => {
    const year = new Date().getFullYear() + 1;
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        `http://localhost/api/finance/reports/monthly?year=${year}&month=1`
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/monthly：默认走缓存，并透传 includeComparison=false', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2025&month=1&includeComparison=false'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(buildCacheKey).toHaveBeenCalledWith('finance:reports:monthly', {
      year: 2025,
      month: 1,
      includeComparison: false,
    });
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getMonthlyReport).toHaveBeenCalledWith(2025, 1, false);
  });

  test('GET /api/finance/reports/monthly：未传 includeComparison 时默认 true', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2025&month=1'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(buildCacheKey).toHaveBeenCalledWith('finance:reports:monthly', {
      year: 2025,
      month: 1,
      includeComparison: true,
    });
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getMonthlyReport).toHaveBeenCalledWith(2025, 1, true);
  });

  test('GET /api/finance/reports/annual：未来年份应返回 400', async () => {
    const nextYear = new Date().getFullYear() + 1;
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL(
        `http://localhost/api/finance/reports/annual?year=${nextYear}`
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/annual：forceRefresh=true 应绕过缓存', async () => {
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/annual?year=2025&forceRefresh=true'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getOrSetJSON).not.toHaveBeenCalled();
    expect(getAnnualReport).toHaveBeenCalledTimes(1);
    expect(getAnnualReport).toHaveBeenCalledWith(2025, true);
  });

  test('GET /api/finance/reports/annual：regenerate=true 也应绕过缓存', async () => {
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/annual?year=2025&regenerate=true'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getOrSetJSON).not.toHaveBeenCalled();
    expect(getAnnualReport).toHaveBeenCalledWith(2025, true);
  });

  test('GET /api/finance/reports/annual：默认走缓存，未传 includeYearOverYear 时默认 true', async () => {
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/reports/annual?year=2025'),
    } as any);

    expect(response.status).toBe(200);
    expect(buildCacheKey).toHaveBeenCalledWith('finance:reports:annual', {
      year: 2025,
      includeYearOverYear: true,
    });
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getAnnualReport).toHaveBeenCalledWith(2025, true);
  });

  test('GET /api/finance/reports/annual：透传 includeYearOverYear=false', async () => {
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/annual?year=2025&includeYearOverYear=false'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(buildCacheKey).toHaveBeenCalledWith('finance:reports:annual', {
      year: 2025,
      includeYearOverYear: false,
    });
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getAnnualReport).toHaveBeenCalledWith(2025, false);
  });

  test('GET /api/finance/reports/profit-loss：查询范围超过 1 年应返回 400', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2024-01-01&endDate=2025-02-01&groupBy=day'
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/profit-loss：groupBy 非法应返回 400', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-01-01&endDate=2025-01-02&groupBy=year'
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/profit-loss：开始日期晚于结束日期应返回 400', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-01-02&endDate=2025-01-01&groupBy=day'
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/profit-loss：日期格式非法应返回 400', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-1-1&endDate=2025-01-01&groupBy=day'
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/profit-loss：结束日期未来应返回 400', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const future = `${yyyy}-${mm}-${dd}`;

    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        `http://localhost/api/finance/reports/profit-loss?startDate=2025-01-01&endDate=${future}&groupBy=day`
      ),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expectValidationFailure(body);
  });

  test('GET /api/finance/reports/profit-loss：省略 groupBy/includeComparison 时使用默认值', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-01-01&endDate=2025-01-01'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getProfitLossAnalysis).toHaveBeenCalledWith(
      '2025-01-01',
      '2025-01-01',
      'day',
      false
    );
  });

  test('GET /api/finance/reports/profit-loss：默认走缓存并透传 includeComparison', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-01-01&endDate=2025-01-01&groupBy=day&includeComparison=true'
      ),
    } as any);

    expect(response.status).toBe(200);
    expect(getOrSetJSON).toHaveBeenCalledTimes(1);
    expect(getProfitLossAnalysis).toHaveBeenCalledTimes(1);
    expect(getProfitLossAnalysis).toHaveBeenCalledWith(
      '2025-01-01',
      '2025-01-01',
      'day',
      true
    );
  });
});
