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
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) =>
      handler(request, {
        ...context,
        user: {
          id: 'user-1',
          name: '测试管理员',
          permissions: ['returns:edit'],
        },
      }),
}));

jest.mock('@/lib/cache', () => ({
  revalidateProducts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  invalidateInventoryCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/idempotency', () => ({
  withIdempotency: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    returnOrder: {
      findUnique: jest.fn(),
    },
  },
}));

describe('/api/return-orders/[id]/status（端点级回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      returnOrder: {
        findUnique: jest.Mock;
      };
    };
  };

  const { withIdempotency } = jest.requireMock('@/lib/utils/idempotency') as {
    withIdempotency: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('PATCH：请求体不是合法 JSON 时应返回 400，且不进入数据库查询', async () => {
    const { PATCH } = await import('@/app/api/return-orders/[id]/status/route');

    const response = await PATCH(
      {
        text: async () => '{bad json',
      } as any,
      {
        params: Promise.resolve({ id: 'return-1' }),
      } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '请求体不是合法的 JSON',
    });
    expect(prisma.returnOrder.findUnique).not.toHaveBeenCalled();
    expect(withIdempotency).not.toHaveBeenCalled();
  });

  test('PATCH：空请求体应返回 400 验证错误，且不进入数据库查询', async () => {
    const { PATCH } = await import('@/app/api/return-orders/[id]/status/route');

    const response = await PATCH(
      {
        text: async () => '',
      } as any,
      {
        params: Promise.resolve({ id: 'return-1' }),
      } as any
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '数据验证失败',
        details: expect.any(Array),
      })
    );
    expect(prisma.returnOrder.findUnique).not.toHaveBeenCalled();
    expect(withIdempotency).not.toHaveBeenCalled();
  });
});
