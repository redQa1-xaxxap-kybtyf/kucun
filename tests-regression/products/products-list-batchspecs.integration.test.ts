jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('products-list 批次规格（集成回归）', () => {
  const { logger } = jest.requireMock('@/lib/logger') as {
    logger: { warn: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      inventory: {
        groupBy: jest.fn(),
      },
      batchSpecification: {
        findMany: jest.fn(),
      },
    });
  });

  test('getProductsBatchSpecifications：productIds 为空应直接返回空 Map', async () => {
    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(prisma.inventory.groupBy).not.toHaveBeenCalled();
    expect(prisma.batchSpecification.findMany).not.toHaveBeenCalled();
  });

  test('getProductsBatchSpecifications：无有效批次对（batchNumber 全为 null）应返回空 Map', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      { productId: 'p1', batchNumber: null, _sum: { quantity: 10 } },
    ]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(['p1']);
    expect(result.size).toBe(0);
    expect(prisma.batchSpecification.findMany).not.toHaveBeenCalled();
  });

  test('getProductsBatchSpecifications：应按产品+批次聚合并匹配批次规格', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      { productId: 'p1', batchNumber: 'B1', _sum: { quantity: 5 } },
      { productId: 'p1', batchNumber: 'B2', _sum: { quantity: 3 } },
      { productId: 'p2', batchNumber: 'B1', _sum: { quantity: 7 } },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([
      { productId: 'p1', batchNumber: 'B1', piecesPerUnit: 2, weight: 1.1 },
      { productId: 'p1', batchNumber: 'B2', piecesPerUnit: 4, weight: null },
      { productId: 'p2', batchNumber: 'B1', piecesPerUnit: 6, weight: 2.2 },
    ]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(['p1', 'p2']);
    expect(result.get('p1')).toEqual(
      expect.arrayContaining([
        {
          batchNumber: 'B1',
          piecesPerUnit: 2,
          quantity: 5,
          weight: 1.1,
        },
        {
          batchNumber: 'B2',
          piecesPerUnit: 4,
          quantity: 3,
          weight: null,
        },
      ])
    );
    expect(result.get('p2')).toEqual([
      {
        batchNumber: 'B1',
        piecesPerUnit: 6,
        quantity: 7,
        weight: 2.2,
      },
    ]);
  });

  test('getProductsBatchSpecifications：批次规格缺失应 warn 并跳过该批次', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      { productId: 'p1', batchNumber: 'B1', _sum: { quantity: 5 } },
      { productId: 'p1', batchNumber: 'B2', _sum: { quantity: 3 } },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([
      { productId: 'p1', batchNumber: 'B2', piecesPerUnit: 4, weight: null },
    ]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(['p1']);
    expect(result.get('p1')).toEqual([
      {
        batchNumber: 'B2',
        piecesPerUnit: 4,
        quantity: 3,
        weight: null,
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      'api:products-list',
      '批次没有批次规格记录',
      expect.objectContaining({ productId: 'p1', batchNumber: 'B1' })
    );
  });
});
