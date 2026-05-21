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
  resolveParams: async (params: Record<string, string>) => params,
  withErrorHandling:
    (handler: any) =>
    async (request: any, context: any) =>
      handler(request, context),
}));

let mockAuthUser = {
  id: 'warehouse-1',
  email: '',
  username: 'warehouse',
  name: '仓库员',
  role: 'warehouse',
  status: 'active',
};

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context?: any) =>
      handler(request, {
        ...(context ?? {}),
        user: mockAuthUser,
      }),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  invalidateInventoryCache: jest.fn(async () => undefined),
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: {
    READ: 'READ',
    WRITE: 'WRITE',
  },
  withRateLimit:
    () =>
    (handler: any) =>
      handler,
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

const RECORD_ID = '11111111-1111-4111-8111-111111111111';

function createExistingOpeningBalanceRecord() {
  return {
    id: RECORD_ID,
    reason: 'opening_balance',
    quantity: 130,
    unitCost: 8.88,
    totalCost: 1154.4,
    productId: 'product-1',
    variantId: 'variant-1',
    batchNumber: 'BATCH-001',
    openingImportBatchId: 'OBI-TEST-001',
  };
}

describe('/api/inventory/inbound/[id] 期初批次权限回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = {
      id: 'warehouse-1',
      email: '',
      username: 'warehouse',
      name: '仓库员',
      role: 'warehouse',
      status: 'active',
    };
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
  });

  test('PUT：仅有 inventory:adjust 的仓库角色不能迁移期初批次', async () => {
    Object.assign(prisma, {
      inboundRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createExistingOpeningBalanceRecord()),
      },
      $transaction: jest.fn(),
    });

    const { PUT } = await import('@/app/api/inventory/inbound/[id]/route');
    const response = await PUT(
      {
        json: async () => ({ batchNumber: 'BATCH-002' }),
      } as any,
      { params: { id: RECORD_ID } } as any
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '权限不足：需要 inventory:opening_balance 权限',
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('PUT：未改批次时仍允许普通库存调整流程进入事务', async () => {
    const tx = {
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inventory-1', quantity: 130, reservedQuantity: 0 },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      inventoryCostQueue: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'queue-1', remainingQty: 130 },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      inboundRecord: {
        update: jest.fn().mockResolvedValue({
          id: RECORD_ID,
          recordNumber: 'RK20260406001',
          productId: 'product-1',
          quantity: 131,
          reason: 'opening_balance',
          remarks: null,
          userId: 'warehouse-1',
          openingImportBatchId: 'OBI-TEST-001',
          createdAt: new Date('2026-04-06T10:00:00.000Z'),
          updatedAt: new Date('2026-04-06T11:00:00.000Z'),
          product: {
            id: 'product-1',
            code: 'P-001',
            name: '测试瓷砖',
            specification: '800x800mm',
            unit: 'piece',
          },
          user: {
            id: 'warehouse-1',
            name: '仓库员',
            username: 'warehouse',
          },
        }),
      },
    };

    Object.assign(prisma, {
      inboundRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createExistingOpeningBalanceRecord()),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });

    const { PUT } = await import('@/app/api/inventory/inbound/[id]/route');
    const response = await PUT(
      {
        json: async () => ({ quantity: 131 }),
      } as any,
      { params: { id: RECORD_ID } } as any
    );

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.inboundRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 131 }),
      })
    );
  });
});
