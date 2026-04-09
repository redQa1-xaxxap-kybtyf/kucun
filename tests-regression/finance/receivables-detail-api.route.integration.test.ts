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

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: {
    READ: 'READ',
  },
  withRateLimit:
    (_type: string) =>
    (handler: any) =>
    (request: any, context?: any) =>
      handler(request, context),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('/api/finance/receivables/[id]（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      salesOrder: {
        findUnique: jest.fn(),
      },
    });
  });

  test('GET：销售订单不存在时应返回 404', async () => {
    (prisma.salesOrder.findUnique as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/finance/receivables/[id]/route');
    const response = await GET(
      {
        nextUrl: new URL('http://localhost/api/finance/receivables/order-404'),
      } as any,
      { params: { id: 'order-404' } } as any
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '应收记录不存在',
      })
    );
  });

  test('GET：应返回应收详情并拆分抹零与预收冲抵字段', async () => {
    (prisma.salesOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'so-1',
      orderNumber: 'SO-0001',
      customerId: 'cust-1',
      userId: 'user-1',
      status: 'confirmed',
      isSampleOrder: false,
      sampleSettlementType: 'FREE',
      totalAmount: 100,
      roundingAdjustment: -2,
      remarks: '订单备注',
      createdAt: new Date('2026-04-01T08:00:00.000Z'),
      updatedAt: new Date('2026-04-05T09:30:00.000Z'),
      customer: {
        id: 'cust-1',
        name: '客户A',
        phone: '13800138000',
        extendedInfo: JSON.stringify({
          contactPerson: '张三',
          paymentTerms: '15天',
        }),
      },
      user: {
        id: 'user-1',
        name: '管理员',
      },
      payments: [
        {
          id: 'payment-auto-confirmation',
          paymentNumber: 'SK-AUTO-001',
          actualPaymentAmount: 0,
          roundingAmount: -2,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-04-05T11:00:00.000Z'),
          status: 'confirmed',
          remarks: '系统自动生成：销售订单 SO-0001 确认应收',
          createdAt: new Date('2026-04-05T11:00:00.000Z'),
        },
        {
          id: 'payment-confirmed',
          paymentNumber: 'PAY-001',
          actualPaymentAmount: 30,
          roundingAmount: -1,
          paymentMethod: 'bank_transfer',
          paymentDate: new Date('2026-04-02T10:00:00.000Z'),
          status: 'confirmed',
          remarks: '首笔收款',
          createdAt: new Date('2026-04-02T10:00:00.000Z'),
        },
        {
          id: 'payment-pending',
          paymentNumber: 'PAY-002',
          actualPaymentAmount: 20,
          roundingAmount: 0,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-04-03T10:00:00.000Z'),
          status: 'pending',
          remarks: '待确认收款',
          createdAt: new Date('2026-04-03T10:00:00.000Z'),
        },
      ],
      prepaymentUsages: [
        {
          id: 'usage-1',
          appliedAmount: 15,
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          paymentRecord: {
            paymentNumber: 'PRE-001',
            paymentMethod: 'alipay',
            paymentDate: new Date('2026-03-31T10:00:00.000Z'),
            status: 'confirmed',
            remarks: '预收冲抵',
          },
        },
      ],
    });

    const { GET } = await import('@/app/api/finance/receivables/[id]/route');
    const response = await GET(
      { nextUrl: new URL('http://localhost/api/finance/receivables/so-1') } as any,
      { params: { id: 'so-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'so-1',
          receivableNumber: 'SO-0001',
          receivableAmount: 98,
          receivedAmount: 30,
          prepaymentApplied: 15,
          paymentRoundingAmount: -1,
          pendingAmount: 20,
          remainingAmount: 54,
          status: 'pending',
          paymentTerms: '15天',
          receivableConfirmation: expect.objectContaining({
            paymentNumber: 'SK-AUTO-001',
            status: 'confirmed',
          }),
          customer: expect.objectContaining({
            contactPerson: '张三',
          }),
          paymentRecords: expect.arrayContaining([
            expect.objectContaining({
              paymentNumber: 'PAY-001',
              sourceType: 'payment',
              amount: 30,
              roundingAmount: -1,
              status: 'confirmed',
            }),
            expect.objectContaining({
              paymentNumber: 'PRE-001',
              sourceType: 'prepayment',
              amount: 15,
              status: 'applied',
            }),
          ]),
        }),
      })
    );

    expect(body.data.paymentRecords).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentNumber: 'SK-AUTO-001',
        }),
      ])
    );
  });
});
