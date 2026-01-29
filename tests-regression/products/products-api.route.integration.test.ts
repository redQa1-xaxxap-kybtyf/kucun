jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/api/products-server', () => ({
  getProductsForServer: jest.fn(),
}));

jest.mock('@/lib/api/handlers/products', () => ({
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  getCachedProductInventorySummary: jest.fn(),
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any, _options?: { permissions?: string[] }) => {
    return async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: [
          'products:view',
          'products:create',
          'products:edit',
          'products:delete',
        ],
      };
      return handler(request, { ...(context ?? {}), user });
    };
  },
  successResponse: (data: any, status: number = 200, message?: string) => {
    return {
      status,
      json: async () => ({
        success: true,
        data,
        ...(message ? { message } : {}),
      }),
    } as any;
  },
}));

describe('/api/products（集成回归）', () => {
  const { getProductsForServer } = jest.requireMock(
    '@/lib/api/products-server'
  ) as {
    getProductsForServer: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/products：分页参数非法应返回 400（strict）', async () => {
    const { GET } = await import('@/app/api/products/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/products?page=0&limit=10'),
      headers: new Headers({ 'x-client-from': 'mini-program' }),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('页码必须大于0'),
      })
    );
  });

  test('GET /api/products：mini-program 免登录应直接调用 getProductsForServer', async () => {
    getProductsForServer.mockResolvedValueOnce({
      data: [{ id: 'p1', code: 'P1', name: 'Prod', unit: 'sheet' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const { GET } = await import('@/app/api/products/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/products?page=1&limit=10'),
      headers: new Headers({ 'x-client-from': 'mini-program' }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          data: expect.any(Array),
          pagination: expect.any(Object),
        }),
      })
    );

    expect(getProductsForServer).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
      })
    );
  });
});

describe('/api/products/[id]（集成回归）', () => {
  const { getProductById, updateProduct, deleteProduct } = jest.requireMock(
    '@/lib/api/handlers/products'
  ) as {
    getProductById: jest.Mock;
    updateProduct: jest.Mock;
    deleteProduct: jest.Mock;
  };

  const { getCachedProductInventorySummary } = jest.requireMock(
    '@/lib/cache/inventory-cache'
  ) as {
    getCachedProductInventorySummary: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/products/[id]：includeInventory=false 不应查询库存汇总', async () => {
    getProductById.mockResolvedValueOnce({
      id: 'prod-1',
      code: 'P1',
      name: 'Prod',
      unit: 'sheet',
      piecesPerUnit: 1,
      status: 'active',
      images: [],
      category: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const { GET } = await import('@/app/api/products/[id]/route');
    const response = await GET(
      {
        nextUrl: new URL('http://localhost/api/products/prod-1'),
        headers: new Headers({ 'x-client-from': 'mini-program' }),
      } as any,
      { params: { id: 'prod-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'prod-1' }),
      })
    );
    expect(getCachedProductInventorySummary).not.toHaveBeenCalled();
  });

  test('GET /api/products/[id]：includeInventory=true 应附带库存汇总', async () => {
    getProductById.mockResolvedValueOnce({
      id: 'prod-1',
      code: 'P1',
      name: 'Prod',
      unit: 'sheet',
      piecesPerUnit: 1,
      status: 'active',
      images: [],
      category: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    getCachedProductInventorySummary.mockResolvedValueOnce({
      totalQuantity: 10,
      reservedQuantity: 2,
      availableQuantity: 8,
    });

    const { GET } = await import('@/app/api/products/[id]/route');
    const response = await GET(
      {
        nextUrl: new URL(
          'http://localhost/api/products/prod-1?includeInventory=true'
        ),
        headers: new Headers({
          'x-client-from': 'mini-program',
          'x-user-role': 'admin',
        }),
      } as any,
      { params: { id: 'prod-1' } } as any
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'prod-1',
          inventory: expect.objectContaining({
            totalQuantity: 10,
            reservedQuantity: 2,
            availableQuantity: 8,
            stockStatus: 'low_stock',
          }),
        }),
      })
    );
    expect(getCachedProductInventorySummary).toHaveBeenCalledWith('prod-1');
  });

  test('PUT /api/products/[id]：应校验并调用 updateProduct', async () => {
    updateProduct.mockResolvedValueOnce({ id: 'prod-1', code: 'P1' });

    const { PUT } = await import('@/app/api/products/[id]/route');
    const response = await PUT(
      {
        json: async () => ({ specification: '600x600' }),
      } as any,
      { params: { id: 'prod-1' } } as any
    );

    expect(updateProduct).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({ specification: '600x600' })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { id: 'prod-1', code: 'P1' },
        message: '产品更新成功',
      })
    );
  });

  test('DELETE /api/products/[id]：应调用 deleteProduct', async () => {
    deleteProduct.mockResolvedValueOnce({ success: true });

    const { DELETE } = await import('@/app/api/products/[id]/route');
    const response = await DELETE(
      {} as any,
      { params: { id: 'prod-1' } } as any
    );

    expect(deleteProduct).toHaveBeenCalledWith('prod-1');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: { success: true },
        message: '产品删除成功',
      })
    );
  });
});
