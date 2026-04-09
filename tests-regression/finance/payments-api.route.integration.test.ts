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

jest.mock('@/lib/db/transaction-options', () => ({
  getStandardTransactionOptions: jest.fn(() => ({})),
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

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(async () => 'production'),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentNumber: jest.fn(async () => 'SK-TEST-0001'),
}));

jest.mock('@/lib/utils/sample-order', () => ({
  shouldCreateReceivableForOrder: jest.fn(() => true),
}));

jest.mock('@/lib/validations/payment', () => ({
  createPaymentRecordSchema: { safeParse: jest.fn() },
  paymentRecordQuerySchema: { safeParse: jest.fn() },
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('/api/payments（端点级回归）', () => {
  const { createPaymentRecordSchema } = jest.requireMock(
    '@/lib/validations/payment'
  ) as {
    createPaymentRecordSchema: { safeParse: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      salesOrder: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    });
  });

  test('POST：系统自动确认应收占位记录不应阻止真实收款创建', async () => {
    createPaymentRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        paymentType: 'order_payment',
        paymentMethod: 'cash',
        paymentAmount: 100,
        actualPaymentAmount: 100,
        roundingAmount: 0,
        paymentDate: '2026-04-06',
        remarks: '',
        receiptNumber: '',
        bankInfo: '',
      },
    });

    prisma.salesOrder.findUnique.mockResolvedValue({
      id: 'so-1',
      customerId: 'cust-1',
      totalAmount: 100,
      roundingAdjustment: 0,
      status: 'completed',
      isSampleOrder: false,
      sampleSettlementType: 'FREE',
      payments: [],
      prepaymentUsages: [],
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        paymentRecord: {
          create: jest.fn(async (args: any) => ({
            id: 'payment-1',
            ...args.data,
            appliedAmount: 0,
            customer: { id: 'cust-1', name: '客户A', phone: '13800138000' },
            salesOrder: {
              id: 'so-1',
              orderNumber: 'SO-0001',
              totalAmount: 100,
              status: 'completed',
            },
            user: { id: 'test-user', name: '管理员' },
          })),
        },
      })
    );

    const { POST } = await import('@/app/api/payments/route');
    const response = await POST({
      json: async () => ({
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        paymentType: 'order_payment',
        paymentMethod: 'cash',
        paymentAmount: 100,
        actualPaymentAmount: 100,
        roundingAmount: 0,
        paymentDate: '2026-04-06',
        remarks: '',
        receiptNumber: '',
        bankInfo: '',
      }),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          paymentNumber: 'SK-TEST-0001',
          salesOrderId: 'so-1',
          customerId: 'cust-1',
        }),
      })
    );

    expect(prisma.salesOrder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'so-1' },
        select: expect.objectContaining({
          payments: expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ['confirmed', 'applied'] },
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
          }),
        }),
      })
    );
  });
});
