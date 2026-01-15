jest.mock('@/lib/cache', () => ({
  buildCacheKey: jest.fn(() => 'cache-key'),
  getOrSetJSON: jest.fn(),
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any, options?: { permissions?: string[] }) => {
    return async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'user',
        permissions: [] as string[],
      };
      const required = options?.permissions ?? [];
      const hasAll = required.every(permission => user.permissions.includes(permission));
      if (!hasAll) {
        return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handler(request, { ...(context ?? {}), user });
    };
  },
}));

describe('API permissions regression', () => {
  test('GET /api/finance/reports/monthly 无权限返回 403', async () => {
    const { GET } = await import('@/app/api/finance/reports/monthly/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/reports/monthly?year=2025&month=1'),
    } as any);
    expect(response.status).toBe(403);
  });

  test('GET /api/finance/reports/annual 无权限返回 403', async () => {
    const { GET } = await import('@/app/api/finance/reports/annual/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/reports/annual?year=2025'),
    } as any);
    expect(response.status).toBe(403);
  });

  test('GET /api/finance/reports/profit-loss 无权限返回 403', async () => {
    const { GET } = await import('@/app/api/finance/reports/profit-loss/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/reports/profit-loss?startDate=2025-01-01&endDate=2025-01-31&groupBy=day&includeComparison=false'
      ),
    } as any);
    expect(response.status).toBe(403);
  });

  test('GET /api/factory-shipments 无权限返回 403', async () => {
    const { GET } = await import('@/app/api/factory-shipments/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/factory-shipments?page=1&limit=10'),
    } as any);
    expect(response.status).toBe(403);
  });

  test('PATCH /api/factory-shipments/[id]/status 无权限返回 403', async () => {
    const { PATCH } = await import('@/app/api/factory-shipments/[id]/status/route');
    const response = await PATCH(
      {
        json: async () => ({ status: 'shipped' }),
      } as any,
      { params: Promise.resolve({ id: 'ship-001' }) } as any
    );
    expect(response.status).toBe(403);
  });
});

