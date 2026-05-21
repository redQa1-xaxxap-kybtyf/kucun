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

const { clearCacheAfterPayment } = jest.requireMock(
  '@/lib/cache/finance-cache'
) as { clearCacheAfterPayment: jest.Mock };

const { publishFinanceEvent } = jest.requireMock('@/lib/events') as {
  publishFinanceEvent: jest.Mock;
};

const { recordPartnerTransaction } = jest.requireMock(
  '@/lib/services/partner-ledger-service'
) as { recordPartnerTransaction: jest.Mock };

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

type PaymentStore = {
  paymentsById: Map<string, any>;
  salesOrdersById: Map<string, any>;
};

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clone(item);
  }
  return out as T;
}

function decoratePayment(row: any, store: PaymentStore) {
  const salesOrder = row.salesOrderId
    ? store.salesOrdersById.get(row.salesOrderId)
    : null;
  return {
    ...clone(row),
    customer: {
      id: row.customerId,
      name: '客户A',
      phone: '13800138000',
    },
    salesOrder: salesOrder
      ? {
          id: salesOrder.id,
          orderNumber: salesOrder.orderNumber,
          totalAmount: salesOrder.totalAmount,
          status: salesOrder.status,
        }
      : null,
    user: {
      id: row.userId,
      name: '管理员',
    },
    prepaymentUsages: row.prepaymentUsages ?? [],
  };
}

function createInMemoryPaymentPrisma(seed: {
  payments: any[];
  salesOrders: any[];
}) {
  const store: PaymentStore = {
    paymentsById: new Map(seed.payments.map(row => [row.id, clone(row)])),
    salesOrdersById: new Map(
      seed.salesOrders.map(row => [row.id, clone(row)])
    ),
  };

  const snapshotStore = () => ({
    paymentsById: new Map(
      Array.from(store.paymentsById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    salesOrdersById: new Map(
      Array.from(store.salesOrdersById.entries()).map(([k, v]) => [
        k,
        clone(v),
      ])
    ),
  });

  const restoreSnapshot = (snapshot: ReturnType<typeof snapshotStore>) => {
    store.paymentsById.clear();
    for (const [key, value] of snapshot.paymentsById.entries()) {
      store.paymentsById.set(key, clone(value));
    }
    store.salesOrdersById.clear();
    for (const [key, value] of snapshot.salesOrdersById.entries()) {
      store.salesOrdersById.set(key, clone(value));
    }
  };

  const tx = {
    paymentRecord: {
      findUnique: jest.fn(async (args: any) => {
        const row = store.paymentsById.get(args?.where?.id);
        return row ? decoratePayment(row, store) : null;
      }),
      update: jest.fn(async (args: any) => {
        const row = store.paymentsById.get(args?.where?.id);
        if (!row) throw new Error('NotFound');
        const updated = {
          ...row,
          ...(args?.data ?? {}),
          updatedAt: new Date(),
        };
        store.paymentsById.set(row.id, clone(updated));
        return decoratePayment(updated, store);
      }),
      updateMany: jest.fn(async (args: any) => {
        const row = store.paymentsById.get(args?.where?.id);
        if (!row) return { count: 0 };
        const allowedStatuses = args?.where?.status?.in as string[] | undefined;
        const expectedStatus = args?.where?.status as string | undefined;
        if (Array.isArray(allowedStatuses) && !allowedStatuses.includes(row.status)) {
          return { count: 0 };
        }
        if (typeof expectedStatus === 'string' && row.status !== expectedStatus) {
          return { count: 0 };
        }
        const updated = {
          ...row,
          ...(args?.data ?? {}),
          updatedAt: new Date(),
        };
        store.paymentsById.set(row.id, clone(updated));
        return { count: 1 };
      }),
      aggregate: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const statuses = where.status?.in as string[] | undefined;
        const salesOrderId = where.salesOrderId as string | undefined;
        let sum = 0;
        for (const row of store.paymentsById.values()) {
          if (salesOrderId && row.salesOrderId !== salesOrderId) continue;
          if (Array.isArray(statuses) && !statuses.includes(row.status)) {
            continue;
          }
          if (
            row.remarks?.startsWith?.('系统自动生成：销售订单') &&
            row.remarks?.includes?.('确认应收')
          ) {
            continue;
          }
          sum += Number(row.paymentAmount ?? 0);
        }
        return { _sum: { paymentAmount: sum } };
      }),
    },
    salesOrder: {
      findUnique: jest.fn(async (args: any) => {
        const row = store.salesOrdersById.get(args?.where?.id);
        if (!row) return null;
        return {
          ...clone(row),
          prepaymentUsages: row.prepaymentUsages ?? [],
        };
      }),
      update: jest.fn(async (args: any) => {
        const row = store.salesOrdersById.get(args?.where?.id);
        if (!row) throw new Error('NotFound');
        const updated = {
          ...row,
          ...(args?.data ?? {}),
          updatedAt: new Date(),
        };
        store.salesOrdersById.set(row.id, clone(updated));
        return clone(updated);
      }),
    },
  };

  const memPrisma: any = {
    ...tx,
    $transaction: jest.fn(async (fn: any) => {
      const snapshot = snapshotStore();
      try {
        return await fn(tx);
      } catch (error) {
        restoreSnapshot(snapshot);
        throw error;
      }
    }),
  };

  return { prisma: memPrisma, store, tx };
}

function resetPaymentPrisma(seed: Parameters<typeof createInMemoryPaymentPrisma>[0]) {
  const { prisma: memPrisma, store, tx } = createInMemoryPaymentPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { store, tx };
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
    recordPartnerTransaction.mockResolvedValue(undefined);
    clearCacheAfterPayment.mockResolvedValue(undefined);
    publishFinanceEvent.mockResolvedValue(undefined);
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

  test('POST /confirm：往来账写入失败时应回滚确认状态和订单已收金额', async () => {
    recordPartnerTransaction.mockRejectedValueOnce(new Error('ledger fail'));
    const { store } = resetPaymentPrisma({
      payments: [
        {
          id: 'payment-confirm-1',
          paymentNumber: 'SK-001',
          paymentAmount: 100,
          actualPaymentAmount: 100,
          roundingAmount: 0,
          appliedAmount: 0,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-04-05T11:00:00.000Z'),
          status: 'pending',
          paymentType: 'order_payment',
          remarks: null,
          salesOrderId: 'so-confirm-1',
          customerId: 'cust-1',
          userId: 'user-1',
        },
      ],
      salesOrders: [
        {
          id: 'so-confirm-1',
          orderNumber: 'SO-001',
          totalAmount: 100,
          roundingAdjustment: 0,
          isSampleOrder: false,
          sampleSettlementType: null,
          status: 'confirmed',
          paidAmount: 0,
          prepaymentUsages: [],
        },
      ],
    });

    const { POST } = await import('@/app/api/payments/[id]/confirm/route');
    const response = await POST(
      { bodyUsed: false, json: async () => ({ notes: '到账' }) } as any,
      { params: { id: 'payment-confirm-1' } } as any
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '确认收款记录失败',
      })
    );
    expect(store.paymentsById.get('payment-confirm-1')?.status).toBe('pending');
    expect(store.salesOrdersById.get('so-confirm-1')?.paidAmount).toBe(0);
    expect(clearCacheAfterPayment).not.toHaveBeenCalled();
    expect(publishFinanceEvent).not.toHaveBeenCalled();
  });

  test('POST /cancel：冲销往来账写入失败时应回滚取消状态和订单已收金额', async () => {
    recordPartnerTransaction.mockRejectedValueOnce(new Error('ledger fail'));
    const { store } = resetPaymentPrisma({
      payments: [
        {
          id: 'payment-cancel-1',
          paymentNumber: 'SK-002',
          paymentAmount: 100,
          actualPaymentAmount: 100,
          roundingAmount: 0,
          appliedAmount: 0,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-04-05T11:00:00.000Z'),
          status: 'confirmed',
          paymentType: 'order_payment',
          remarks: null,
          salesOrderId: 'so-cancel-1',
          customerId: 'cust-1',
          userId: 'user-1',
          prepaymentUsages: [],
        },
      ],
      salesOrders: [
        {
          id: 'so-cancel-1',
          orderNumber: 'SO-002',
          totalAmount: 100,
          roundingAdjustment: 0,
          isSampleOrder: false,
          sampleSettlementType: null,
          status: 'confirmed',
          paidAmount: 100,
          prepaymentUsages: [],
        },
      ],
    });

    const { POST } = await import('@/app/api/payments/[id]/cancel/route');
    const response = await POST(
      { bodyUsed: false, json: async () => ({ notes: '冲销' }) } as any,
      { params: { id: 'payment-cancel-1' } } as any
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '取消收款记录失败',
      })
    );
    expect(store.paymentsById.get('payment-cancel-1')?.status).toBe(
      'confirmed'
    );
    expect(store.salesOrdersById.get('so-cancel-1')?.paidAmount).toBe(100);
    expect(clearCacheAfterPayment).not.toHaveBeenCalled();
    expect(publishFinanceEvent).not.toHaveBeenCalled();
  });
});
