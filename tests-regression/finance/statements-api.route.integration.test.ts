jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      public readonly body: unknown,
      public readonly status: number
    ) {}

    async json() {
      return this.body;
    }
  }

  return {
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: { FINANCE_READ: 'FINANCE_READ', WRITE: 'WRITE' },
  withRateLimit: jest.fn(() => (handler: any) => handler),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/finance-statistics-cached', () => ({
  getStatementsList: jest.fn(),
}));

describe('/api/finance/statements（集成回归）', () => {
  const { getStatementsList } = jest.requireMock(
    '@/lib/services/finance-statistics-cached'
  ) as {
    getStatementsList: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('分页参数越界应返回 400（page<=0）', async () => {
    const { GET } = await import('@/app/api/finance/statements/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/statements?page=0'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('页码必须大于0'),
      })
    );
    expect(getStatementsList).not.toHaveBeenCalled();
  });

  test('分页参数越界应返回 400（limit<=0）', async () => {
    const { GET } = await import('@/app/api/finance/statements/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/statements?limit=0'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('每页数量必须大于0'),
      })
    );
    expect(getStatementsList).not.toHaveBeenCalled();
  });

  test('分页参数越界应返回 400（limit 超过 MAX_PAGE_SIZE）', async () => {
    const { GET } = await import('@/app/api/finance/statements/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/statements?limit=101'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('每页数量不能超过100'),
      })
    );
    expect(getStatementsList).not.toHaveBeenCalled();
  });

  test('参数合法应调用 getStatementsList 并返回 statements 列表', async () => {
    getStatementsList.mockResolvedValue({
      data: [{ entityId: 'ent-1', entityName: '供应商A' }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
      summary: {
        totalCustomers: 0,
        totalSuppliers: 1,
        totalReceivable: 0,
        totalPayable: 50,
      },
    });

    const { GET } = await import('@/app/api/finance/statements/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/statements?page=2&limit=10&search=%20foo%20&type=supplier&sortBy=entityName&sortOrder=asc&startDate=2026-01-01&endDate=2026-01-31'
      ),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          statements: [{ entityId: 'ent-1', entityName: '供应商A' }],
          pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
          summary: expect.objectContaining({
            totalCustomers: 0,
            totalSuppliers: 1,
            totalReceivable: 0,
            totalPayable: 50,
          }),
        }),
      })
    );

    expect(getStatementsList).toHaveBeenCalledTimes(1);
    expect(getStatementsList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        search: 'foo',
        type: 'supplier',
        sortBy: 'entityName',
        sortOrder: 'asc',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    );
  });

  test('未提供分页参数时应使用默认值（page=1, limit=20）', async () => {
    getStatementsList.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      summary: {
        totalCustomers: 0,
        totalSuppliers: 0,
        totalReceivable: 0,
        totalPayable: 0,
      },
    });

    const { GET } = await import('@/app/api/finance/statements/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/statements'),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    expect(getStatementsList).toHaveBeenCalledTimes(1);
    expect(getStatementsList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        search: undefined,
        type: 'all',
        sortBy: 'totalAmount',
        sortOrder: 'desc',
        startDate: undefined,
        endDate: undefined,
      })
    );
  });
});
