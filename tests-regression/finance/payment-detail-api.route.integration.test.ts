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
    (handler: any, _options?: { permissions?: string[] }) =>
    async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: ['finance:view', 'finance:manage'],
      };
      return handler(request, { ...(context ?? {}), user });
    },
}));

jest.mock('@/lib/cache/finance-cache', () => ({
  clearCacheAfterPayment: jest.fn(async () => undefined),
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

jest.mock('@/lib/events', () => ({
  publishFinanceEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn(async () => undefined),
}));

jest.mock('@/lib/validations/payment', () => ({
  updatePaymentRecordSchema: { safeParse: jest.fn() },
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

function createPlaceholderRecord() {
  return {
    id: 'payment-auto-1',
    paymentNumber: 'SK-AUTO-001',
    paymentAmount: 100,
    actualPaymentAmount: 0,
    roundingAmount: 0,
    appliedAmount: 0,
    paymentMethod: 'cash',
    paymentDate: new Date('2026-04-05T11:00:00.000Z'),
    status: 'pending',
    paymentType: 'order_payment',
    remarks: '系统自动生成：销售订单 SO-0001 确认应收',
    receiptNumber: null,
    bankInfo: null,
    salesOrderId: 'so-1',
    customerId: 'cust-1',
    userId: 'user-1',
    createdAt: new Date('2026-04-05T11:00:00.000Z'),
    updatedAt: new Date('2026-04-05T11:00:00.000Z'),
    customer: {
      id: 'cust-1',
      name: '客户A',
      phone: '13800138000',
      email: 'customer@example.com',
      address: '测试地址',
    },
    salesOrder: {
      id: 'so-1',
      orderNumber: 'SO-0001',
      totalAmount: 100,
      status: 'confirmed',
      createdAt: new Date('2026-04-01T08:00:00.000Z'),
    },
    user: {
      id: 'user-1',
      name: '管理员',
      email: 'admin@example.com',
    },
    prepaymentUsages: [],
  };
}

describe('/api/payments/[id] 详情与防误操作回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      paymentRecord: {
        findUnique: jest.fn(),
        aggregate: jest.fn(),
      },
      prepaymentUsage: {
        aggregate: jest.fn(),
      },
    });
  });

  test('GET：系统应收建账详情应返回标记，并排除占位记录污染订单已收汇总', async () => {
    prisma.paymentRecord.findUnique.mockResolvedValue(
      createPlaceholderRecord()
    );
    prisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { paymentAmount: 30 },
    });
    prisma.prepaymentUsage.aggregate.mockResolvedValue({
      _sum: { appliedAmount: 15 },
    });

    const { GET } = await import('@/app/api/payments/[id]/route');
    const response = await GET(
      {
        nextUrl: new URL('http://localhost/api/payments/payment-auto-1'),
      } as any,
      { params: { id: 'payment-auto-1' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'payment-auto-1',
          paymentNumber: 'SK-AUTO-001',
          isSystemReceivableConfirmation: true,
          actualPaymentAmount: 0,
          salesOrder: expect.objectContaining({
            id: 'so-1',
            paidAmount: 45,
            remainingAmount: 55,
          }),
        }),
      })
    );

    expect(prisma.paymentRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          salesOrderId: 'so-1',
          status: 'confirmed',
          NOT: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                remarks: expect.objectContaining({
                  startsWith: '系统自动生成：销售订单',
                }),
              }),
              expect.objectContaining({
                remarks: expect.objectContaining({
                  contains: '确认应收',
                }),
              }),
            ]),
          }),
        }),
      })
    );
  });

  test('PUT：系统应收建账记录不允许手工修改', async () => {
    prisma.paymentRecord.findUnique.mockResolvedValue(
      createPlaceholderRecord()
    );

    const { PUT } = await import('@/app/api/payments/[id]/route');
    const response = await PUT(
      { json: async () => ({ remarks: '手工修改' }) } as any,
      { params: { id: 'payment-auto-1' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '系统应收建账记录不允许手工修改',
      })
    );
  });

  test('DELETE：系统应收建账记录不允许手工删除', async () => {
    prisma.paymentRecord.findUnique.mockResolvedValue(
      createPlaceholderRecord()
    );

    const { DELETE } = await import('@/app/api/payments/[id]/route');
    const response = await DELETE(
      {} as any,
      { params: { id: 'payment-auto-1' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '系统应收建账记录不允许手工删除',
      })
    );
  });

  test('POST /confirm：系统应收建账记录不能手工确认收款', async () => {
    prisma.paymentRecord.findUnique.mockResolvedValue(
      createPlaceholderRecord()
    );
    prisma.$transaction = jest.fn();

    const { POST } = await import('@/app/api/payments/[id]/confirm/route');
    const response = await POST(
      { bodyUsed: false, json: async () => ({}) } as any,
      { params: { id: 'payment-auto-1' }, user: { id: 'test-user' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '系统应收建账记录不能手工确认收款',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('POST /cancel：系统应收建账记录不能手工取消', async () => {
    prisma.paymentRecord.findUnique.mockResolvedValue(
      createPlaceholderRecord()
    );
    prisma.paymentRecord.update = jest.fn();

    const { POST } = await import('@/app/api/payments/[id]/cancel/route');
    const response = await POST(
      { bodyUsed: false, json: async () => ({}) } as any,
      { params: { id: 'payment-auto-1' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '系统应收建账记录不能手工取消',
      })
    );
    expect(prisma.paymentRecord.update).not.toHaveBeenCalled();
  });
});
