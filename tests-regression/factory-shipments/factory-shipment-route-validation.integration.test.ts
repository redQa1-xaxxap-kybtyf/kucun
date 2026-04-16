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

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/utils/idempotency', () => ({
  withIdempotency: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    factoryShipmentOrder: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('/api/factory-shipments/[id] PUT（端点级回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      factoryShipmentOrder: {
        findUnique: jest.Mock;
      };
      $transaction: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.factoryShipmentOrder.findUnique.mockResolvedValue({
      id: 'fs-1',
      status: 'draft',
      userId: 'user-1',
      depositAmount: null,
      items: [],
    });
  });

  test('PUT：校验失败时应返回 422 友好错误，并阻止进入事务', async () => {
    const { PUT } = await import('@/app/api/factory-shipments/[id]/route');

    const response = await PUT(
      {
        json: async () => ({
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
          items: [
            {
              productId: '22222222-2222-4222-8222-222222222222',
              supplierId: 'supplier-1',
              productCode: 'P-001',
              batchNumber: 'B001',
              quantity: 10,
              unitPrice: 12,
              displayName: '自用砖A',
              unit: 'sheet',
            },
            {
              productId: '22222222-2222-4222-8222-222222222222',
              supplierId: 'supplier-1',
              productCode: 'P-001',
              batchNumber: 'B001',
              quantity: 5,
              unitPrice: 12,
              displayName: '自用砖A',
              unit: 'sheet',
            },
          ],
        }),
      } as any,
      {
        params: Promise.resolve({ id: 'fs-1' }),
      } as any
    );

    expect(response.status).toBe(422);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '提交内容有误，请检查后重试',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: 'items.0.displayName',
            message: '同一供应商下相同产品和批次不能重复录入',
          }),
          expect.objectContaining({
            path: 'items.1.batchNumber',
            message: '同一供应商下相同产品和批次不能重复录入',
          }),
        ]),
      })
    );

    expect(prisma.factoryShipmentOrder.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
