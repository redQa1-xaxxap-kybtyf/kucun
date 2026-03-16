const mockCacheStore = new Map<string, unknown>();

const mockReportState = {
  annual: { version: 'before-approval', totalExpenses: 100 },
  monthly: { version: 'before-approval', totalExpenses: 100 },
  profitLoss: { version: 'before-approval', totalExpenses: 100 },
};

const mockApprovedExpense = {
  id: '11111111-1111-4111-8111-111111111111',
  expenseNumber: 'EXP-TEST-001',
  expenseType: 'other',
  expenseName: '测试费用',
  expenseAmount: 200,
  expenseDate: '2026-03-16T00:00:00.000Z',
  status: 'approved',
  userId: 'finance-admin',
  userName: 'Finance Admin',
  createdAt: '2026-03-16T00:00:00.000Z',
  updatedAt: '2026-03-16T00:00:00.000Z',
  approvedById: 'finance-admin',
  approvedAt: '2026-03-16T00:00:00.000Z',
};

function matchesPattern(key: string, pattern: string) {
  const regex = new RegExp(
    `^${pattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`
  );
  return regex.test(key);
}

jest.mock('@/lib/cache', () => ({
  buildCacheKey: jest.fn(
    (prefix: string, parts: Record<string, unknown>) =>
      `${prefix}:${JSON.stringify(parts)}`
  ),
  getOrSetJSON: jest.fn(async (key: string, fn: () => Promise<unknown>) => {
    if (mockCacheStore.has(key)) {
      return mockCacheStore.get(key);
    }

    const result = await fn();
    mockCacheStore.set(key, result);
    return result;
  }),
}));

jest.mock('@/lib/redis/redis-client', () => ({
  redis: {
    scanDel: jest.fn(async (pattern: string) => {
      let deletedCount = 0;
      for (const key of Array.from(mockCacheStore.keys())) {
        if (matchesPattern(key, pattern)) {
          mockCacheStore.delete(key);
          deletedCount += 1;
        }
      }
      return deletedCount;
    }),
  },
}));

jest.mock('@/lib/auth/api-helpers', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    withAuth:
      (handler: any, _options?: { permissions?: string[] }) =>
      async (request: any, context?: any) =>
        handler(request, {
          ...(context ?? {}),
          user: {
            id: 'finance-admin',
            role: 'admin',
            permissions: ['finance:view', 'finance:manage'],
          },
        }),
    successResponse: (data: unknown, status = 200, message?: string) =>
      NextResponse.json(
        {
          success: true,
          data,
          ...(message ? { message } : {}),
        },
        { status }
      ),
    errorResponse: (message: string, status = 400) =>
      NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status }
      ),
  };
});

jest.mock('@/lib/services/monthly-report-service', () => ({
  getMonthlyReport: jest.fn(async () => ({ ...mockReportState.monthly })),
}));

jest.mock('@/lib/services/annual-report-service', () => ({
  getAnnualReport: jest.fn(async () => ({ ...mockReportState.annual })),
}));

jest.mock('@/lib/services/profit-loss-service', () => ({
  getProfitLossAnalysis: jest.fn(async () => ({ ...mockReportState.profitLoss })),
}));

jest.mock('@/lib/services/expense-service', () => ({
  approveExpenseRecord: jest.fn(async () => ({ ...mockApprovedExpense })),
}));

jest.mock('@/lib/utils/console-logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('费用审核后报表接口应立即同步最新数据', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheStore.clear();

    mockReportState.monthly = {
      version: 'before-approval',
      totalExpenses: 100,
    };
    mockReportState.annual = {
      version: 'before-approval',
      totalExpenses: 100,
    };
    mockReportState.profitLoss = {
      version: 'before-approval',
      totalExpenses: 100,
    };
  });

  test('POST /api/finance/expenses/[id]/approve 后，月报/年报/盈亏缓存应清空，后续 GET 立即返回新值', async () => {
    const { GET: getMonthlyReportRoute } = await import(
      '@/app/api/finance/reports/monthly/route'
    );
    const { GET: getAnnualReportRoute } = await import(
      '@/app/api/finance/reports/annual/route'
    );
    const { GET: getProfitLossRoute } = await import(
      '@/app/api/finance/reports/profit-loss/route'
    );
    const { POST: approveExpenseRoute } = await import(
      '@/app/api/finance/expenses/[id]/approve/route'
    );

    const monthlyRequest = {
      nextUrl: new URL(
        'http://localhost/api/finance/reports/monthly?year=2026&month=3&includeComparison=true'
      ),
    } as any;
    const annualRequest = {
      nextUrl: new URL(
        'http://localhost/api/finance/reports/annual?year=2026&includeYearOverYear=true'
      ),
    } as any;
    const profitLossRequest = {
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2026-03-01&endDate=2026-03-16&groupBy=day&includeComparison=false'
      ),
    } as any;

    const firstMonthlyResponse = await getMonthlyReportRoute(monthlyRequest);
    const firstAnnualResponse = await getAnnualReportRoute(annualRequest);
    const firstProfitLossResponse = await getProfitLossRoute(profitLossRequest);

    expect((await firstMonthlyResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );
    expect((await firstAnnualResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );
    expect((await firstProfitLossResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );

    mockReportState.monthly = {
      version: 'after-approval',
      totalExpenses: 300,
    };
    mockReportState.annual = {
      version: 'after-approval',
      totalExpenses: 300,
    };
    mockReportState.profitLoss = {
      version: 'after-approval',
      totalExpenses: 300,
    };

    const cachedMonthlyResponse = await getMonthlyReportRoute(monthlyRequest);
    const cachedAnnualResponse = await getAnnualReportRoute(annualRequest);
    const cachedProfitLossResponse =
      await getProfitLossRoute(profitLossRequest);

    expect((await cachedMonthlyResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );
    expect((await cachedAnnualResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );
    expect((await cachedProfitLossResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'before-approval', totalExpenses: 100 })
    );

    const approveResponse = await approveExpenseRoute(
      {
        method: 'POST',
        nextUrl: new URL(
          'http://localhost/api/finance/expenses/11111111-1111-4111-8111-111111111111/approve'
        ),
      } as any,
      {
        params: { id: '11111111-1111-4111-8111-111111111111' },
      } as any
    );

    expect(approveResponse.status).toBe(200);

    const { redis } = jest.requireMock('@/lib/redis/redis-client') as {
      redis: { scanDel: jest.Mock };
    };
    expect(redis.scanDel).toHaveBeenCalledWith('finance:reports:monthly*');
    expect(redis.scanDel).toHaveBeenCalledWith('finance:reports:annual*');
    expect(redis.scanDel).toHaveBeenCalledWith('finance:reports:profit-loss*');

    const refreshedMonthlyResponse = await getMonthlyReportRoute(monthlyRequest);
    const refreshedAnnualResponse = await getAnnualReportRoute(annualRequest);
    const refreshedProfitLossResponse =
      await getProfitLossRoute(profitLossRequest);

    expect((await refreshedMonthlyResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'after-approval', totalExpenses: 300 })
    );
    expect((await refreshedAnnualResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'after-approval', totalExpenses: 300 })
    );
    expect((await refreshedProfitLossResponse.json()).data).toEqual(
      expect.objectContaining({ version: 'after-approval', totalExpenses: 300 })
    );

    const {
      getMonthlyReport,
    } = jest.requireMock('@/lib/services/monthly-report-service') as {
      getMonthlyReport: jest.Mock;
    };
    const { getAnnualReport } = jest.requireMock(
      '@/lib/services/annual-report-service'
    ) as {
      getAnnualReport: jest.Mock;
    };
    const { getProfitLossAnalysis } = jest.requireMock(
      '@/lib/services/profit-loss-service'
    ) as {
      getProfitLossAnalysis: jest.Mock;
    };

    expect(getMonthlyReport).toHaveBeenCalledTimes(2);
    expect(getAnnualReport).toHaveBeenCalledTimes(2);
    expect(getProfitLossAnalysis).toHaveBeenCalledTimes(2);
  });
});
