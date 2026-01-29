import { ApiError } from '@/lib/api/errors';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/cache/product-cache', () => ({
  invalidateProductCache: jest.fn(async () => {}),
}));

jest.mock('@/lib/services/qiniu-upload', () => ({
  extractQiniuKeysFromUrls: jest.fn(async () => []),
  deleteFromQiniu: jest.fn(async () => {}),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('products handlers（集成回归）', () => {
  const { revalidatePath } = jest.requireMock('next/cache') as {
    revalidatePath: jest.Mock;
  };

  const { invalidateProductCache } = jest.requireMock(
    '@/lib/cache/product-cache'
  ) as {
    invalidateProductCache: jest.Mock;
  };

  const { extractQiniuKeysFromUrls, deleteFromQiniu } = jest.requireMock(
    '@/lib/services/qiniu-upload'
  ) as {
    extractQiniuKeysFromUrls: jest.Mock;
    deleteFromQiniu: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
      },
      productVariant: {
        deleteMany: jest.fn(),
      },
    });
  });

  test('updateProduct：产品不存在应返回 404 ApiError', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const { updateProduct } = await import('@/lib/api/handlers/products');
    try {
      await updateProduct('prod-1', { specification: '600x600' } as any);
      throw new Error('expected updateProduct to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        statusCode: 404,
        message: '产品未找到',
      });
    }
  });

  test('updateProduct：变更分类但分类不存在应返回 400', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'prod-1',
      code: 'P-001',
      name: '产品A',
      categoryId: null,
    });
    (prisma.category.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const { updateProduct } = await import('@/lib/api/handlers/products');
    await expect(
      updateProduct('prod-1', {
        specification: '600x600',
        categoryId: 'cat-missing',
      } as any)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '指定的分类不存在',
    });
  });

  test('updateProduct：变更编码但被占用应返回 400', async () => {
    (prisma.product.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'prod-1',
        code: 'P-001',
        name: '产品A',
        categoryId: null,
      })
      .mockResolvedValueOnce({
        id: 'prod-2',
        code: 'P-002',
        name: '产品B',
      });

    const { updateProduct } = await import('@/lib/api/handlers/products');
    await expect(
      updateProduct('prod-1', {
        specification: '600x600',
        code: 'P-002',
      } as any)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '产品编码已被其他产品使用',
    });
  });

  test('updateProduct：应构建 updateData、触发 revalidatePath，并失效产品缓存', async () => {
    (prisma.product.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'prod-1',
        code: 'P-001',
        name: '产品A',
        categoryId: 'cat-1',
      })
      .mockResolvedValueOnce(null);

    (prisma.product.update as jest.Mock).mockResolvedValueOnce({
      id: 'prod-1',
      code: 'P-001-NEW',
      name: '产品A-新',
      specification: '600x600',
      unit: 'sheet',
      piecesPerUnit: 10,
      weight: 12.5,
      thickness: 8.0,
      status: 'inactive',
      categoryId: null,
      description: null,
      thumbnailUrl: null,
      images: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      category: null,
      variants: [],
      _count: {
        variants: 0,
        inventory: 0,
        salesOrderItems: 0,
        inboundRecords: 0,
      },
    });

    const { updateProduct } = await import('@/lib/api/handlers/products');
    const result = await updateProduct('prod-1', {
      code: 'P-001-NEW',
      name: '产品A-新',
      specification: '600x600',
      piecesPerUnit: 10,
      weight: 12.5,
      thickness: 8,
      status: 'inactive',
      categoryId: 'uncategorized',
      description: '   ',
      thumbnailUrl: '   ',
      images: [],
    } as any);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: expect.objectContaining({
          code: 'P-001-NEW',
          name: '产品A-新',
          specification: '600x600',
          piecesPerUnit: 10,
          weight: 12.5,
          thickness: 8,
          status: 'inactive',
          description: null,
          thumbnailUrl: null,
          images: null,
          category: { disconnect: true },
        }),
      })
    );

    expect(revalidatePath).toHaveBeenCalledWith('/products', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/products/prod-1', 'page');
    expect(invalidateProductCache).toHaveBeenCalledWith('prod-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'prod-1',
        code: 'P-001-NEW',
        name: '产品A-新',
        categoryId: null,
        status: 'inactive',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      })
    );
  });

  test('deleteProduct：存在关联库存/销售/入库记录应阻止删除并返回 400', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'prod-1',
      thumbnailUrl: null,
      images: null,
      _count: {
        variants: 0,
        inventory: 1,
        salesOrderItems: 2,
        inboundRecords: 3,
      },
    });

    const { deleteProduct } = await import('@/lib/api/handlers/products');
    await expect(deleteProduct('prod-1')).rejects.toMatchObject({
      statusCode: 400,
      message: '该产品存在关联的库存、销售订单或入库记录，无法删除',
      details: {
        counts: {
          inventory: 1,
          salesOrderItems: 2,
          inboundRecords: 3,
        },
      },
    });

    expect(prisma.product.delete).not.toHaveBeenCalled();
    expect(prisma.productVariant.deleteMany).not.toHaveBeenCalled();
  });

  test('deleteProduct：应先删变体、删产品、revalidatePath、失效缓存，并清理七牛图片', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'prod-1',
      thumbnailUrl: 'https://cdn.example.com/thumb.png',
      images: JSON.stringify([
        { url: 'https://cdn.example.com/a.png', type: 'main' },
        { url: 'https://cdn.example.com/b.png', type: 'effect' },
      ]),
      _count: {
        variants: 2,
        inventory: 0,
        salesOrderItems: 0,
        inboundRecords: 0,
      },
    });

    extractQiniuKeysFromUrls.mockResolvedValueOnce(['k1', 'k2']);

    const { deleteProduct } = await import('@/lib/api/handlers/products');
    const result = await deleteProduct('prod-1');

    expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod-1' },
    });
    expect(extractQiniuKeysFromUrls).toHaveBeenCalledWith(
      expect.arrayContaining([
        'https://cdn.example.com/thumb.png',
        'https://cdn.example.com/a.png',
        'https://cdn.example.com/b.png',
      ])
    );
    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/products', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/products/prod-1', 'page');
    expect(invalidateProductCache).toHaveBeenCalledWith('prod-1');

    expect(deleteFromQiniu).toHaveBeenCalledTimes(2);
    expect(deleteFromQiniu).toHaveBeenCalledWith('k1');
    expect(deleteFromQiniu).toHaveBeenCalledWith('k2');

    expect(result).toEqual({ success: true, message: '产品删除成功' });
  });
});
