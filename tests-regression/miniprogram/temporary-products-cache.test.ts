jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any, _options?: { permissions?: string[] }) =>
    async (request: any, context?: any) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: 'admin-user',
          role: 'admin',
          permissions: ['products:create', 'products:edit'],
        },
      }),
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/services/miniprogram-catalog-service', () => ({
  invalidateMiniProgramCatalogCache: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };
const { invalidateMiniProgramCatalogCache } = jest.requireMock(
  '@/lib/services/miniprogram-catalog-service'
) as {
  invalidateMiniProgramCatalogCache: jest.Mock;
};

function createWriteBody(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: 'supplier-1',
    code: 'EXT-001',
    name: '外采罗马柱',
    specification: '600x600mm',
    unit: '片',
    piecesPerUnit: 1,
    showInMiniProgram: true,
    ...overrides,
  };
}

function createTemporaryProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'temp-product-1',
    supplierId: 'supplier-1',
    code: 'EXT-001',
    name: '外采罗马柱',
    specification: '600x600mm',
    weight: null,
    unit: '片',
    piecesPerUnit: 1,
    description: null,
    thumbnailUrl: null,
    images: null,
    showInMiniProgram: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: new Date('2026-05-20T10:00:00.000Z'),
    updatedAt: new Date('2026-05-20T10:00:00.000Z'),
    latestCostPrice: null,
    latestSalePrice: null,
    priceUpdatedAt: null,
    priceRemarks: null,
    supplier: {
      id: 'supplier-1',
      name: '供应商A',
      supplierCode: 'SUP-001',
    },
    creator: {
      id: 'admin-user',
      name: '管理员',
    },
    _count: {
      salesOrderItems: 0,
      factoryShipmentOrderItems: 0,
    },
    ...overrides,
  };
}

function createRequest(body: unknown) {
  return {
    json: async () => body,
  } as any;
}

describe('外采产品写入后的小程序目录缓存失效', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }

    Object.assign(prisma, {
      temporaryProduct: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      temporaryProductPriceHistory: {
        create: jest.fn(),
      },
    });
  });

  test('POST：创建外采产品成功后清理小程序目录运行时缓存', async () => {
    prisma.temporaryProduct.create.mockResolvedValue(createTemporaryProduct());
    const { POST } = await import('@/app/api/temporary-products/route');

    const response = await POST(createRequest(createWriteBody()));

    expect(response.status).toBe(201);
    expect(invalidateMiniProgramCatalogCache).toHaveBeenCalledTimes(1);
  });

  test('PUT：更新外采产品成功后清理小程序目录运行时缓存', async () => {
    prisma.temporaryProduct.findUnique.mockResolvedValue({
      id: 'temp-product-1',
      latestCostPrice: null,
      latestSalePrice: null,
      priceRemarks: null,
      priceUpdatedAt: null,
    });
    prisma.temporaryProduct.update.mockResolvedValue(
      createTemporaryProduct({
        name: '外采罗马柱更新',
      })
    );
    const { PUT } = await import('@/app/api/temporary-products/[id]/route');

    const response = await PUT(createRequest(createWriteBody()), {
      params: { id: 'temp-product-1' },
    });

    expect(response.status).toBe(200);
    expect(invalidateMiniProgramCatalogCache).toHaveBeenCalledTimes(1);
  });
});
