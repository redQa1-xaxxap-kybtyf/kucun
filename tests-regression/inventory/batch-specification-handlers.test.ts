jest.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    batchSpecification: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('batch-specification handlers', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      product: { findUnique: jest.Mock };
      productVariant: { findUnique: jest.Mock };
      batchSpecification: {
        upsert: jest.Mock;
        findFirst: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      status: 'active',
    });
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      status: 'active',
    });
  });

  test('upsertBatchSpecification：应使用产品+变体+批次唯一键', async () => {
    prisma.batchSpecification.upsert.mockResolvedValue({
      id: 'spec-1',
      productId: 'product-1',
      variantId: 'variant-1',
      batchNumber: 'BATCH-001',
      piecesPerUnit: 12,
      weight: 3.2,
      thickness: null,
      createdAt: new Date('2026-03-18T10:00:00.000Z'),
      updatedAt: new Date('2026-03-18T10:00:00.000Z'),
      product: {
        id: 'product-1',
        name: '测试产品',
        code: 'P001',
        unit: 'sheet',
        specification: '800x800',
        piecesPerUnit: 6,
        status: 'active',
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T10:00:00.000Z'),
      },
      variant: {
        id: 'variant-1',
        colorCode: 'RED',
        colorName: '红色',
        sku: 'SKU-RED',
      },
    });

    const { upsertBatchSpecification } = await import(
      '@/lib/api/batch-specification-handlers'
    );

    const result = await upsertBatchSpecification({
      productId: 'product-1',
      variantId: 'variant-1',
      batchNumber: 'BATCH-001',
      piecesPerUnit: 12,
      weight: 3.2,
    });

    expect(prisma.batchSpecification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId_variantKey_batchNumber: {
            productId: 'product-1',
            variantKey: 'variant-1',
            batchNumber: 'BATCH-001',
          },
        },
        create: expect.objectContaining({
          productId: 'product-1',
          variantId: 'variant-1',
          variantKey: 'variant-1',
          batchNumber: 'BATCH-001',
        }),
      })
    );
    expect(result.variantId).toBe('variant-1');
    expect(result.variant?.colorCode).toBe('RED');
  });

  test('getBatchSpecificationByProductAndBatch：应优先查变体并兼容通用批次规格回退', async () => {
    prisma.batchSpecification.findFirst.mockResolvedValue(null);

    const { getBatchSpecificationByProductAndBatch } = await import(
      '@/lib/api/batch-specification-handlers'
    );

    await getBatchSpecificationByProductAndBatch(
      'product-1',
      'BATCH-001',
      'variant-1'
    );

    expect(prisma.batchSpecification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: 'product-1',
          batchNumber: 'BATCH-001',
          OR: [{ variantKey: 'variant-1' }, { variantKey: '' }],
        },
      })
    );
  });
});
