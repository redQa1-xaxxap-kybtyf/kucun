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
  withAuth: (handler: any, _options?: { permissions?: string[] }) => async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: ['finance:view', 'finance:manage'],
      };
      return handler(request, { ...(context ?? {}), user });
    },
  requireAuth: jest.fn(() => ({
    id: 'test-user',
    role: 'admin',
    permissions: [],
  })),
  errorResponse: (message: string, status = 400) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ success: false, error: message }, { status });
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('/api/refunds（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      refundRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      salesOrder: {
        findUnique: jest.fn(),
      },
    });
  });

  test('GET /api/refunds：非法查询参数应返回 400', async () => {
    const { GET } = await import('@/app/api/refunds/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/refunds?status=not-a-status'),
      url: 'http://localhost/api/refunds?status=not-a-status',
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '查询参数验证失败',
        details: expect.any(Array),
      })
    );
    expect(prisma.refundRecord.findMany).not.toHaveBeenCalled();
  });

  test('GET /api/refunds：应解析参数并调用 findMany + count', async () => {
    (prisma.refundRecord.findMany as jest.Mock).mockResolvedValue([
      { id: 'refund-1', refundNumber: 'RF-1' },
    ]);
    (prisma.refundRecord.count as jest.Mock).mockResolvedValue(1);

    const { GET } = await import('@/app/api/refunds/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/refunds?page=2&limit=5&search=foo&status=pending&refundType=full_refund&refundMethod=cash&customerId=cust-1&salesOrderId=so-1&startDate=2026-01-01&endDate=2026-01-31'
      ),
      url: 'http://localhost/api/refunds',
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          refunds: expect.any(Array),
          pagination: expect.objectContaining({
            page: 2,
            limit: 5,
            total: 1,
          }),
        }),
      })
    );

    expect(prisma.refundRecord.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.refundRecord.count).toHaveBeenCalledTimes(1);

    const [findManyArgs] = (prisma.refundRecord.findMany as jest.Mock).mock
      .calls[0] as [Record<string, unknown>];
    expect(findManyArgs).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          refundType: 'full_refund',
          refundMethod: 'cash',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          OR: expect.any(Array),
          refundDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        orderBy: [{ refundDate: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 5,
      })
    );
  });

  test('POST /api/refunds：数据验证失败应返回 400', async () => {
    const { POST } = await import('@/app/api/refunds/route');
    const response = await POST({
      json: async () => ({
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        refundType: 'full_refund',
        refundMethod: 'cash',
        refundAmount: -1,
        refundDate: '2026-01-01',
        reason: 'bad',
      }),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '数据验证失败',
        details: expect.any(Array),
      })
    );
    expect(prisma.salesOrder.findUnique).not.toHaveBeenCalled();
  });

  test('POST /api/refunds：销售订单不存在应返回 404', async () => {
    (prisma.salesOrder.findUnique as jest.Mock).mockResolvedValue(null);

    const { POST } = await import('@/app/api/refunds/route');
    const response = await POST({
      json: async () => ({
        salesOrderId: 'so-404',
        customerId: 'cust-1',
        refundType: 'full_refund',
        refundMethod: 'cash',
        refundAmount: 10,
        refundDate: '2026-01-01',
        reason: 'ok',
      }),
    } as any);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '销售订单不存在',
      })
    );
    expect(prisma.refundRecord.create).not.toHaveBeenCalled();
  });

  test('POST /api/refunds：客户与订单不匹配应返回 400', async () => {
    (prisma.salesOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'so-1',
      customerId: 'cust-x',
      totalAmount: 100,
      status: 'completed',
    });

    const { POST } = await import('@/app/api/refunds/route');
    const response = await POST({
      json: async () => ({
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        refundType: 'full_refund',
        refundMethod: 'cash',
        refundAmount: 10,
        refundDate: '2026-01-01',
        reason: 'ok',
      }),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '客户信息与订单不匹配',
      })
    );
    expect(prisma.refundRecord.create).not.toHaveBeenCalled();
  });

  test('POST /api/refunds：创建成功应写入 remainingAmount/refundNumber/userId', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    (prisma.salesOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'so-1',
      customerId: 'cust-1',
      totalAmount: 100,
      status: 'completed',
    });

    (prisma.refundRecord.create as jest.Mock).mockImplementation(
      async (args: any) => ({
        id: 'refund-1',
        ...args.data,
        customer: { id: 'cust-1', name: '客户A', phone: null },
        salesOrder: {
          id: 'so-1',
          orderNumber: 'SO-0001',
          totalAmount: 100,
          status: 'completed',
        },
        user: { id: 'test-user', name: 'Admin' },
      })
    );

    const { returnRefundConfig } = await import('@/lib/env');
    const { POST } = await import('@/app/api/refunds/route');
    const response = await POST({
      json: async () => ({
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        refundType: 'full_refund',
        refundMethod: 'cash',
        refundAmount: 10,
        refundDate: '2026-01-01T00:00:00.000Z',
        reason: 'ok',
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        message: '退款记录创建成功',
        data: expect.objectContaining({
          id: 'refund-1',
          salesOrderId: 'so-1',
          customerId: 'cust-1',
          userId: 'test-user',
          refundAmount: 10,
          remainingAmount: 10,
        }),
      })
    );

    expect(prisma.refundRecord.create).toHaveBeenCalledTimes(1);
    const [createArgs] = (prisma.refundRecord.create as jest.Mock).mock
      .calls[0];
    expect(createArgs).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          refundNumber: `${returnRefundConfig.refundOrderPrefix}1700000000000`,
          userId: 'test-user',
          remainingAmount: 10,
          refundDate: expect.any(Date),
        }),
      })
    );

    nowSpy.mockRestore();
  });

  test('GET /api/refunds/[id]：不存在应返回 404', async () => {
    (prisma.refundRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/refunds/[id]/route');
    const response = await GET(
      {} as any,
      { params: Promise.resolve({ id: 'refund-missing' }) } as any
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '退款记录不存在',
      })
    );
  });
});
