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

jest.mock('@/lib/api/middleware', () => ({
  resolveParams: async (params: any) => params ?? {},
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: { READ: 'READ', WRITE: 'WRITE' },
  withRateLimit: jest.fn(() => (handler: any) => handler),
}));

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
}));

jest.mock('@/lib/env', () => ({
  env: {
    EXPENSE_TO_PAYABLE_ENABLED: false,
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

jest.mock('@/lib/cache/finance-cache', () => ({
  clearCacheAfterPaymentOut: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/expense-payable-integration', () => ({
  syncExpensePaymentStatusFromPayable: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn(async () => undefined),
}));

jest.mock('@/lib/validations/payable', () => ({
  updatePaymentOutRecordSchema: {
    safeParse: jest.fn(),
  },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

describe('/api/finance/payments-out/[id]（端点级回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

  const { updatePaymentOutRecordSchema } = jest.requireMock(
    '@/lib/validations/payable'
  ) as {
    updatePaymentOutRecordSchema: { safeParse: jest.Mock };
  };

  const { clearCacheAfterPaymentOut } = jest.requireMock(
    '@/lib/cache/finance-cache'
  ) as { clearCacheAfterPaymentOut: jest.Mock };

  const { recordPartnerTransaction } = jest.requireMock(
    '@/lib/services/partner-ledger-service'
  ) as { recordPartnerTransaction: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      paymentOutRecord: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    });
  });

  test('PUT：数据验证失败应返回 400，且不触发缓存失效', async () => {
    updatePaymentOutRecordSchema.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ path: ['paymentAmount'], message: 'bad' }] },
    });

    const { PUT } = await import('@/app/api/finance/payments-out/[id]/route');
    const response = await PUT(
      { json: async () => ({ paymentAmount: 'bad' }) } as any,
      { params: { id: 'pay-1' } } as any
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

    expect(prisma.paymentOutRecord.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('PUT：付款记录不存在应返回 404，且不触发缓存失效', async () => {
    updatePaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: { id: 'pay-missing', paymentAmount: 1 },
    });
    prisma.paymentOutRecord.findUnique.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/finance/payments-out/[id]/route');
    const response = await PUT(
      { json: async () => ({ paymentAmount: 1 }) } as any,
      { params: { id: 'pay-missing' } } as any
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '付款记录不存在',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('PUT：已作废付款记录不能修改（400），且不触发缓存失效', async () => {
    updatePaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: { id: 'pay-1', paymentAmount: 1 },
    });
    prisma.paymentOutRecord.findUnique.mockResolvedValue({
      id: 'pay-1',
      paymentAmount: 10,
      actualPaymentAmount: 10,
      status: 'confirmed',
      payableRecordId: 'payable-1',
      supplierId: 'sup-1',
      paymentNumber: 'POUT-001',
      voidedAt: new Date('2026-01-01T00:00:00.000Z'),
      paymentDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const { PUT } = await import('@/app/api/finance/payments-out/[id]/route');
    const response = await PUT(
      { json: async () => ({ paymentAmount: 1 }) } as any,
      { params: { id: 'pay-1' } } as any
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '已作废的付款记录不能修改',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('PUT：修改付款金额成功应写差额流水并触发缓存失效', async () => {
    updatePaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        id: 'pay-1',
        paymentAmount: 70,
        actualPaymentAmount: 70,
        roundingAmount: 0,
        paymentDate: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    prisma.paymentOutRecord.findUnique.mockResolvedValue({
      id: 'pay-1',
      paymentAmount: 50,
      actualPaymentAmount: 50,
      status: 'confirmed',
      payableRecordId: 'payable-1',
      supplierId: 'sup-1',
      paymentNumber: 'POUT-001',
      voidedAt: null,
      paymentDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const tx = {
      payableRecord: {
        findUnique: jest.fn(async () => ({
          id: 'payable-1',
          payableAmount: 100,
          paidAmount: 50,
        })),
        update: jest.fn(async () => ({})),
      },
      paymentOutRecord: {
        update: jest.fn(async () => ({
          id: 'pay-1',
          paymentNumber: 'POUT-001',
          payableRecordId: 'payable-1',
          supplierId: 'sup-1',
          userId: 'test-user',
          paymentMethod: 'bank_transfer',
          paymentAmount: 70,
          actualPaymentAmount: 70,
          roundingAmount: 0,
          paymentDate: new Date('2026-01-02T00:00:00.000Z'),
          status: 'confirmed',
          remarks: null,
          voucherNumber: null,
          bankInfo: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          payableRecord: {
            id: 'payable-1',
            payableNumber: 'PAY-001',
            payableAmount: 100,
            remainingAmount: 30,
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

    const { PUT } = await import('@/app/api/finance/payments-out/[id]/route');
    const response = await PUT(
      {
        json: async () => ({
          paymentAmount: 70,
          paymentDate: '2026-01-02T00:00:00.000Z',
        }),
      } as any,
      { params: { id: 'pay-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'pay-1',
        paymentNumber: 'POUT-001',
        paymentAmount: 70,
        status: 'confirmed',
      })
    );

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'sup-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'payment_out',
        amount: 20,
        referenceId: expect.any(String),
        referenceNumber: 'POUT-001',
      }),
      tx
    );

    expect(clearCacheAfterPaymentOut).toHaveBeenCalledTimes(1);
  });

  test('PUT：抹零更新时，应按 paymentAmount 调整应付，按 actualPaymentAmount 差额写供应商往来账', async () => {
    updatePaymentOutRecordSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        id: 'pay-2',
        paymentAmount: 55,
        actualPaymentAmount: 54,
        roundingAmount: 1,
        paymentDate: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    prisma.paymentOutRecord.findUnique.mockResolvedValue({
      id: 'pay-2',
      paymentAmount: 50,
      actualPaymentAmount: 50,
      status: 'confirmed',
      payableRecordId: 'payable-1',
      supplierId: 'sup-1',
      paymentNumber: 'POUT-002',
      voidedAt: null,
      paymentDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const tx = {
      payableRecord: {
        findUnique: jest.fn(async () => ({
          id: 'payable-1',
          payableAmount: 100,
          paidAmount: 50,
        })),
        update: jest.fn(async () => ({})),
      },
      paymentOutRecord: {
        update: jest.fn(async () => ({
          id: 'pay-2',
          paymentNumber: 'POUT-002',
          payableRecordId: 'payable-1',
          supplierId: 'sup-1',
          userId: 'test-user',
          paymentMethod: 'bank_transfer',
          paymentAmount: 55,
          actualPaymentAmount: 54,
          roundingAmount: 1,
          paymentDate: new Date('2026-01-02T00:00:00.000Z'),
          status: 'confirmed',
          remarks: null,
          voucherNumber: null,
          bankInfo: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          payableRecord: {
            id: 'payable-1',
            payableNumber: 'PAY-001',
            payableAmount: 100,
            remainingAmount: 45,
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

    const { PUT } = await import('@/app/api/finance/payments-out/[id]/route');
    const response = await PUT(
      {
        json: async () => ({
          paymentAmount: 55,
          actualPaymentAmount: 54,
          roundingAmount: 1,
          paymentDate: '2026-01-02T00:00:00.000Z',
        }),
      } as any,
      { params: { id: 'pay-2' } } as any
    );

    expect(response.status).toBe(200);
    expect(tx.payableRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 55,
          remainingAmount: 45,
        }),
      })
    );

    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'sup-1',
        transactionType: 'payment_out',
        amount: 4,
        referenceNumber: 'POUT-002',
        metadata: expect.objectContaining({
          paymentAmount: 55,
          actualPaymentAmount: 54,
          roundingAmount: 1,
        }),
      }),
      tx
    );
  });

  test('DELETE：付款记录不存在应返回 404，且不触发缓存失效', async () => {
    prisma.paymentOutRecord.findUnique.mockResolvedValue(null);

    const { DELETE } = await import(
      '@/app/api/finance/payments-out/[id]/route'
    );
    const response = await DELETE(
      {} as any,
      { params: { id: 'pay-missing' } } as any
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '付款记录不存在',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('DELETE：重复作废应返回 200 且不再写入变更/不再触发缓存失效', async () => {
    prisma.paymentOutRecord.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'cancelled',
      paymentAmount: 50,
      actualPaymentAmount: 50,
      payableRecordId: 'payable-1',
      supplierId: 'sup-1',
      paymentNumber: 'POUT-001',
      voidedAt: new Date('2026-01-03T00:00:00.000Z'),
      paymentDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const { DELETE } = await import(
      '@/app/api/finance/payments-out/[id]/route'
    );
    const response = await DELETE(
      { json: async () => ({ voidReason: 'again' }) } as any,
      { params: { id: 'pay-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        message: '付款记录已作废',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
    expect(clearCacheAfterPaymentOut).not.toHaveBeenCalled();
  });

  test('DELETE：作废成功应回滚应付并写入反向流水，且触发缓存失效', async () => {
    prisma.paymentOutRecord.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'confirmed',
      paymentAmount: 50,
      actualPaymentAmount: 50,
      payableRecordId: 'payable-1',
      supplierId: 'sup-1',
      paymentNumber: 'POUT-001',
      voidedAt: null,
      paymentDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const tx = {
      payableRecord: {
        findUnique: jest.fn(async () => ({
          id: 'payable-1',
          payableAmount: 100,
          paidAmount: 50,
        })),
        update: jest.fn(async () => ({})),
      },
      paymentOutRecord: {
        update: jest.fn(async () => ({})),
      },
      supplier: {
        findUnique: jest.fn(async () => ({ id: 'sup-1', name: '供应商A' })),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { DELETE } = await import(
      '@/app/api/finance/payments-out/[id]/route'
    );
    const response = await DELETE(
      { json: async () => ({ voidReason: 'wrong' }) } as any,
      { params: { id: 'pay-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        message: '付款记录作废成功',
      })
    );

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'sup-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'payment_out_reversal',
        amount: 50,
        referenceId: 'pay-1',
        referenceNumber: 'POUT-001',
      }),
      tx
    );

    expect(clearCacheAfterPaymentOut).toHaveBeenCalledTimes(1);
  });
});
