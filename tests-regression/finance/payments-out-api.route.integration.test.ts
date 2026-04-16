type MockResponseBody = Record<string, unknown>;

class MockResponse {
  constructor(
    public readonly body: MockResponseBody,
    public readonly status: number
  ) {}

  async json() {
    return this.body;
  }
}

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) => {
      const user = {
        id: 'test-user',
        name: 'Test Admin',
        role: 'admin',
        permissions: ['finance:view', 'finance:manage'],
      };
      return handler(request, { ...context, user });
    },
  successResponse: (data: unknown, status = 200, message?: string) =>
    new MockResponse(
      {
        success: true,
        data,
        ...(message ? { message } : {}),
      },
      status
    ),
  errorResponse: (message: string, status = 400) =>
    new MockResponse({ success: false, error: message }, status),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/cache/finance-cache', () => ({
  clearCacheAfterPaymentOut: jest.fn(async () => undefined),
}));

jest.mock('@/lib/utils/idempotency', () => ({
  withIdempotency: jest.fn(
    async (
      _key: string,
      _type: string,
      _entityId: string,
      _userId: string,
      _meta: unknown,
      fn: () => Promise<unknown>
    ) => await fn()
  ),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentOutNumber: jest.fn(async () => 'POUT-0001'),
}));

jest.mock('@/lib/db/transaction-options', () => ({
  getStandardTransactionOptions: jest.fn(() => ({})),
}));

jest.mock('@/lib/env', () => ({
  env: {
    EXPENSE_TO_PAYABLE_ENABLED: false,
  },
}));

jest.mock('@/lib/services/expense-payable-integration', () => ({
  updateExpensePaymentStatusAfterPayment: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn(async () => undefined),
}));

jest.mock('@/lib/validations/payable', () => ({
  createPaymentOutRecordSchema: { safeParse: jest.fn() },
  paymentOutRecordQuerySchema: { safeParse: jest.fn() },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

describe('/api/finance/payments-out（端点级回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  const { clearCacheAfterPaymentOut } = jest.requireMock(
    '@/lib/cache/finance-cache'
  ) as { clearCacheAfterPaymentOut: jest.Mock };

  const { createPaymentOutRecordSchema, paymentOutRecordQuerySchema } =
    jest.requireMock('@/lib/validations/payable') as {
      createPaymentOutRecordSchema: { safeParse: jest.Mock };
      paymentOutRecordQuerySchema: { safeParse: jest.Mock };
    };

  const { generatePaymentOutNumber } = jest.requireMock(
    '@/lib/utils/payment-number-generator'
  ) as { generatePaymentOutNumber: jest.Mock };

  const { recordPartnerTransaction } = jest.requireMock(
    '@/lib/services/partner-ledger-service'
  ) as { recordPartnerTransaction: jest.Mock };

  const { withIdempotency } = jest.requireMock('@/lib/utils/idempotency') as {
    withIdempotency: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      paymentOutRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      supplier: {
        findUnique: jest.fn(),
      },
      payableRecord: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    });
  });

  test('GET：分页参数非法应返回 400（page<=0）', async () => {
    const { GET } = await import('@/app/api/finance/payments-out/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/payments-out?page=0'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('页码必须大于0'),
      })
    );
    expect(prisma.paymentOutRecord.findMany).not.toHaveBeenCalled();
  });

  test('GET：分页参数非法应返回 400（limit 超过 maxLimit=50000）', async () => {
    const { GET } = await import('@/app/api/finance/payments-out/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/payments-out?limit=50001'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('每页数量不能超过50000'),
      })
    );
    expect(prisma.paymentOutRecord.findMany).not.toHaveBeenCalled();
  });

  test('GET：查询参数验证失败应返回更友好的 400 提示', async () => {
    paymentOutRecordQuerySchema.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'bad query' }] },
    });

    const { GET } = await import('@/app/api/finance/payments-out/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/finance/payments-out'),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('查询条件有误： bad query'),
      })
    );
    expect(prisma.paymentOutRecord.findMany).not.toHaveBeenCalled();
  });

  test('GET：参数合法应调用 findMany/count 并返回分页数据', async () => {
    paymentOutRecordQuerySchema.safeParse.mockReturnValue({
      success: true,
      data: {
        page: 2,
        limit: 10,
        search: 'foo',
        payableRecordId: 'payable-1',
        supplierId: 'sup-1',
        status: 'confirmed',
        paymentMethod: 'bank_transfer',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        sortBy: 'paymentDate',
        sortOrder: 'asc',
      },
    });

    prisma.paymentOutRecord.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        paymentNumber: 'POUT-0001',
        payableRecordId: null,
        supplierId: 'sup-1',
        userId: 'test-user',
        paymentMethod: 'bank_transfer',
        paymentAmount: 50,
        paymentDate: new Date('2026-01-02T00:00:00.000Z'),
        status: 'confirmed',
        remarks: null,
        voucherNumber: null,
        bankInfo: null,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        payableRecord: null,
        supplier: { id: 'sup-1', name: '供应商A', phone: null, address: null },
        user: { id: 'test-user', name: 'Admin', email: 'a@example.com' },
      },
    ]);
    prisma.paymentOutRecord.count.mockResolvedValue(1);

    const { GET } = await import('@/app/api/finance/payments-out/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/finance/payments-out?page=2&limit=10&search=foo&supplierId=sup-1&payableRecordId=payable-1&status=confirmed&paymentMethod=bank_transfer&startDate=2026-01-01&endDate=2026-01-31&sortBy=paymentDate&sortOrder=asc'
      ),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          data: expect.any(Array),
          pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
        }),
      })
    );

    expect(prisma.paymentOutRecord.findMany).toHaveBeenCalledTimes(1);
    const [findManyArgs] = prisma.paymentOutRecord.findMany.mock.calls[0] as [
      Record<string, any>,
    ];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.orderBy).toEqual([
      { paymentDate: 'asc' },
      { id: 'desc' },
    ]);
    expect(findManyArgs.where).toEqual(
      expect.objectContaining({
        payableRecordId: 'payable-1',
        supplierId: 'sup-1',
        status: 'confirmed',
        paymentMethod: 'bank_transfer',
        paymentDate: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
        OR: expect.any(Array),
      })
    );
  });

  test('POST：数据验证失败应返回 400', async () => {
    createPaymentOutRecordSchema.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'bad body' }] },
    });

    const { POST } = await import('@/app/api/finance/payments-out/route');
    const response = await POST(
      { json: async () => ({}) } as any,
      {
        user: { id: 'test-user' },
      } as any
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('数据验证失败: bad body'),
      })
    );
    expect(prisma.supplier.findUnique).not.toHaveBeenCalled();
  });

  test('POST：供应商不存在应返回 404', async () => {
    createPaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        idempotencyKey: 'idem-1',
        supplierId: 'sup-missing',
        payableRecordId: null,
        paymentMethod: 'bank_transfer',
        paymentAmount: 1,
        actualPaymentAmount: 1,
        roundingAmount: 0,
        paymentDate: '2026-01-01',
        remarks: null,
        voucherNumber: null,
        bankInfo: null,
      },
    });
    prisma.supplier.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/finance/payments-out/route');
    const response = await POST(
      { json: async () => ({}) } as any,
      {
        user: { id: 'test-user' },
      } as any
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '供应商不存在',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('POST：创建成功应强制 status=confirmed，写入往来账，并触发缓存失效', async () => {
    createPaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        idempotencyKey: 'idem-1',
        supplierId: 'sup-1',
        payableRecordId: null,
        paymentMethod: 'bank_transfer',
        paymentAmount: 50,
        actualPaymentAmount: 50,
        roundingAmount: 0,
        paymentDate: '2026-01-01',
        remarks: 'test',
        voucherNumber: null,
        bankInfo: null,
      },
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      name: '供应商A',
      status: 'active',
    });

    const tx = {
      paymentOutRecord: {
        create: jest.fn(async (args: any) => ({
          id: 'pay-1',
          ...args.data,
          supplier: {
            id: 'sup-1',
            name: '供应商A',
            phone: null,
            address: null,
          },
          user: { id: 'test-user', name: 'Admin', email: 'a@example.com' },
          payableRecord: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        })),
        findUnique: jest.fn(async () => ({
          id: 'pay-1',
          paymentNumber: 'POUT-0001',
          payableRecordId: null,
          supplierId: 'sup-1',
          userId: 'test-user',
          paymentMethod: 'bank_transfer',
          paymentAmount: 50,
          actualPaymentAmount: 50,
          roundingAmount: 0,
          paymentDate: new Date('2026-01-01T00:00:00.000Z'),
          status: 'confirmed',
          remarks: 'test',
          voucherNumber: null,
          bankInfo: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          payableRecord: null,
          supplier: {
            id: 'sup-1',
            name: '供应商A',
            phone: null,
            address: null,
          },
          user: { id: 'test-user', name: 'Admin', email: 'a@example.com' },
        })),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { POST } = await import('@/app/api/finance/payments-out/route');
    const response = await POST(
      { json: async () => ({}) } as any,
      {
        user: { id: 'test-user' },
      } as any
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('付款记录创建成功');
    expect(body.data).toEqual(expect.objectContaining({ id: 'pay-1' }));

    expect(generatePaymentOutNumber).toHaveBeenCalledTimes(1);
    expect(withIdempotency).toHaveBeenCalledTimes(1);

    expect(tx.paymentOutRecord.create).toHaveBeenCalledTimes(1);
    const [createArgs] = tx.paymentOutRecord.create.mock.calls[0] as [any];
    expect(createArgs.data.status).toBe('confirmed');
    expect(createArgs.data.userId).toBe('test-user');
    expect(createArgs.data.paymentNumber).toBe('POUT-0001');
    expect(createArgs.data.paymentDate).toEqual(expect.any(Date));

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'sup-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'payment_out',
        amount: 50,
        referenceId: 'pay-1',
        referenceNumber: 'POUT-0001',
      }),
      tx
    );

    expect(clearCacheAfterPaymentOut).toHaveBeenCalledTimes(1);
  });

  test('POST：带抹零创建成功时，应按记账金额核销应付，按实际付款金额写供应商往来账', async () => {
    createPaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        idempotencyKey: 'idem-2',
        supplierId: 'sup-1',
        payableRecordId: 'payable-1',
        paymentMethod: 'bank_transfer',
        paymentAmount: 50,
        actualPaymentAmount: 49.5,
        roundingAmount: 0.5,
        paymentDate: '2026-01-01',
        remarks: 'rounding',
        voucherNumber: null,
        bankInfo: null,
      },
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      name: '供应商A',
      status: 'active',
    });
    prisma.payableRecord.findUnique.mockResolvedValue({
      id: 'payable-1',
      payableAmount: 100,
      paidAmount: 0,
      remainingAmount: 50,
      status: 'pending',
    });

    const tx = {
      payableRecord: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(async () => ({
          status: 'paid',
          paidAmount: 50,
          remainingAmount: 0,
        })),
        update: jest.fn(async () => ({})),
      },
      paymentOutRecord: {
        create: jest.fn(async (args: any) => ({
          id: 'pay-2',
          ...args.data,
          supplier: {
            id: 'sup-1',
            name: '供应商A',
            phone: null,
            address: null,
          },
          user: { id: 'test-user', name: 'Admin', email: 'a@example.com' },
          payableRecord: {
            id: 'payable-1',
            payableNumber: 'PAY-001',
            payableAmount: 100,
            remainingAmount: 0,
          },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        })),
        findUnique: jest.fn(async () => ({
          id: 'pay-2',
          paymentNumber: 'POUT-0002',
          payableRecordId: 'payable-1',
          supplierId: 'sup-1',
          userId: 'test-user',
          paymentMethod: 'bank_transfer',
          paymentAmount: 50,
          actualPaymentAmount: 49.5,
          roundingAmount: 0.5,
          paymentDate: new Date('2026-01-01T00:00:00.000Z'),
          status: 'confirmed',
          remarks: 'rounding',
          voucherNumber: null,
          bankInfo: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          payableRecord: {
            id: 'payable-1',
            payableNumber: 'PAY-001',
            payableAmount: 100,
            remainingAmount: 0,
          },
          supplier: {
            id: 'sup-1',
            name: '供应商A',
            phone: null,
            address: null,
          },
          user: { id: 'test-user', name: 'Admin', email: 'a@example.com' },
        })),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { POST } = await import('@/app/api/finance/payments-out/route');
    const response = await POST(
      { json: async () => ({}) } as any,
      {
        user: { id: 'test-user' },
      } as any
    );

    expect(response.status).toBe(201);
    expect(tx.payableRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: { increment: 50 },
          remainingAmount: { decrement: 50 },
        }),
      })
    );

    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'sup-1',
        transactionType: 'payment_out',
        amount: 49.5,
        metadata: expect.objectContaining({
          paymentAmount: 50,
          actualPaymentAmount: 49.5,
          roundingAmount: 0.5,
        }),
      }),
      tx
    );
  });
});
