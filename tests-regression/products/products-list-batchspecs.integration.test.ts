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
      {
        productId: 'p1',
        variantId: null,
        batchNumber: null,
        _sum: { quantity: 10 },
      },
    ]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(['p1']);
    expect(result.size).toBe(0);
    expect(prisma.batchSpecification.findMany).not.toHaveBeenCalled();
  });

  test('getProductsBatchSpecifications：应按产品+变体+批次聚合并匹配批次规格', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        _sum: { quantity: 5 },
      },
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B2',
        _sum: { quantity: 3 },
      },
      {
        productId: 'p2',
        variantId: null,
        batchNumber: 'B1',
        _sum: { quantity: 7 },
      },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        piecesPerUnit: 2,
        weight: 1.1,
        variant: null,
      },
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B2',
        piecesPerUnit: 4,
        weight: null,
        variant: null,
      },
      {
        productId: 'p2',
        variantId: null,
        batchNumber: 'B1',
        piecesPerUnit: 6,
        weight: 2.2,
        variant: null,
      },
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
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        _sum: { quantity: 5 },
      },
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B2',
        _sum: { quantity: 3 },
      },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B2',
        piecesPerUnit: 4,
        weight: null,
        variant: null,
      },
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

  test('getProductsBatchSpecifications：批次规格缺失但产品存在默认装箱数时，应回退生成批次规格', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        _sum: { quantity: 5 },
      },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(
      ['p1'],
      new Map([
        [
          'p1',
          {
            piecesPerUnit: 8,
            weight: 12.5,
          },
        ],
      ])
    );

    expect(result.get('p1')).toEqual([
      {
        batchNumber: 'B1',
        piecesPerUnit: 8,
        quantity: 5,
        weight: 12.5,
      },
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('getProductsBatchSpecifications：同产品同批次不同色号应保留独立规格', async () => {
    (prisma.inventory.groupBy as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: 'v-red',
        batchNumber: 'B1',
        _sum: { quantity: 5 },
      },
      {
        productId: 'p1',
        variantId: 'v-blue',
        batchNumber: 'B1',
        _sum: { quantity: 7 },
      },
    ]);

    (prisma.batchSpecification.findMany as jest.Mock).mockResolvedValueOnce([
      {
        productId: 'p1',
        variantId: 'v-red',
        batchNumber: 'B1',
        piecesPerUnit: 2,
        weight: 1.1,
        variant: { colorCode: 'RED', colorName: '红色' },
      },
      {
        productId: 'p1',
        variantId: 'v-blue',
        batchNumber: 'B1',
        piecesPerUnit: 4,
        weight: 1.4,
        variant: { colorCode: 'BLUE', colorName: '蓝色' },
      },
    ]);

    const { getProductsBatchSpecifications } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = await getProductsBatchSpecifications(['p1']);

    expect(result.get('p1')).toEqual(
      expect.arrayContaining([
        {
          batchNumber: 'B1',
          variantId: 'v-red',
          colorCode: 'RED',
          colorName: '红色',
          piecesPerUnit: 2,
          quantity: 5,
          weight: 1.1,
        },
        {
          batchNumber: 'B1',
          variantId: 'v-blue',
          colorCode: 'BLUE',
          colorName: '蓝色',
          piecesPerUnit: 4,
          quantity: 7,
          weight: 1.4,
        },
      ])
    );
  });

  test('formatProductList：应透传批次总量/预留/可用数量，供销售开单按批次判断可卖库存', async () => {
    const { formatProductList } = await import(
      '@/lib/api/handlers/products-list'
    );

    const result = formatProductList({
      products: [
        {
          id: 'p1',
          code: 'P1',
          name: '产品1',
          specification: '800x800',
          unit: 'sheet',
          piecesPerUnit: 4,
          weight: null,
          thickness: null,
          status: 'active',
          categoryId: null,
          description: null,
          thumbnailUrl: null,
          images: null,
          category: null,
          createdAt: new Date('2026-04-03T00:00:00.000Z'),
          updatedAt: new Date('2026-04-03T00:00:00.000Z'),
        },
      ],
      inventoryMap: new Map([
        [
          'p1',
          {
            totalQuantity: 20,
            reservedQuantity: 6,
            availableQuantity: 14,
            batches: [
              {
                batchNumber: 'B1',
                quantity: 12,
                reservedQuantity: 5,
                availableQuantity: 7,
              },
              {
                batchNumber: 'B2',
                quantity: 8,
                reservedQuantity: 1,
                availableQuantity: 7,
              },
            ],
          },
        ],
      ]),
      includeInventory: true,
      includeStatistics: false,
    });

    expect(result[0]?.inventory).toEqual({
      totalQuantity: 20,
      reservedQuantity: 6,
      availableQuantity: 14,
      batches: [
        {
          batchNumber: 'B1',
          quantity: 12,
          reservedQuantity: 5,
          availableQuantity: 7,
          piecesPerUnit: undefined,
          weight: undefined,
        },
        {
          batchNumber: 'B2',
          quantity: 8,
          reservedQuantity: 1,
          availableQuantity: 7,
          piecesPerUnit: undefined,
          weight: undefined,
        },
      ],
    });
  });
});
