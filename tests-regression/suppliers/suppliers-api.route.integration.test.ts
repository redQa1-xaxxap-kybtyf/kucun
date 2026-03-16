jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any, _options?: { permissions?: string[] }) => async (request: any, context?: any) => {
      const user = {
        id: 'test-user',
        role: 'admin',
        permissions: [
          'suppliers:view',
          'suppliers:create',
          'suppliers:edit',
          'suppliers:delete',
        ],
      };
      return handler(request, { ...(context ?? {}), user });
    },
}));

jest.mock('@/lib/services/supplier-service', () => ({
  getSuppliers: jest.fn(),
  createSupplier: jest.fn(),
  ensureSupplierCanBeDeactivated: jest.fn(),
  ensureSupplierCanBeDeleted: jest.fn(),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

describe('/api/suppliers（集成回归）', () => {
  const supplierService = jest.requireMock(
    '@/lib/services/supplier-service'
  ) as {
    getSuppliers: jest.Mock;
    createSupplier: jest.Mock;
    ensureSupplierCanBeDeactivated: jest.Mock;
    ensureSupplierCanBeDeleted: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }
    Object.assign(prisma, {
      supplier: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    });
  });

  test('GET /api/suppliers：应解析参数并调用 getSuppliers', async () => {
    supplierService.getSuppliers.mockResolvedValue({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });

    const { GET } = await import('@/app/api/suppliers/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/suppliers?page=2&limit=10&search=foo&sortBy=name&sortOrder=asc'
      ),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        pagination: expect.objectContaining({ page: 2, limit: 10 }),
      })
    );

    expect(supplierService.getSuppliers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        search: 'foo',
        sortBy: 'name',
        sortOrder: 'asc',
      })
    );
  });

  test('POST /api/suppliers：服务层报错应映射为 400', async () => {
    supplierService.createSupplier.mockRejectedValue(
      new Error('供应商名称已存在')
    );

    const { POST } = await import('@/app/api/suppliers/route');
    const response = await POST({
      json: async () => ({ name: '供应商A' }),
    } as any);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: '供应商名称已存在',
      })
    );
  });

  test('PUT /api/suppliers/[id]：停用前校验失败应返回 400（业务错误不应变成 500）', async () => {
    (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      id: 'sup-1',
      name: '供应商A',
      status: 'active',
    });

    supplierService.ensureSupplierCanBeDeactivated.mockRejectedValue(
      new Error('供应商 "供应商A" 有 1 个进行中的发货订单，无法停用')
    );

    const { PUT } = await import('@/app/api/suppliers/[id]/route');
    const response = await PUT(
      {
        json: async () => ({ status: 'inactive' }),
      } as any,
      { params: { id: 'sup-1' } } as any
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('无法停用'),
      })
    );
    expect(
      supplierService.ensureSupplierCanBeDeactivated
    ).toHaveBeenCalledTimes(1);
  });

  test('DELETE /api/suppliers/[id]：删除前校验失败应返回 400（业务错误不应变成 500）', async () => {
    (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      id: 'sup-1',
      name: '供应商A',
    });

    supplierService.ensureSupplierCanBeDeleted.mockRejectedValue(
      new Error('供应商 "供应商A" 有 1 笔应付账款记录，无法删除')
    );

    const { DELETE } = await import('@/app/api/suppliers/[id]/route');
    const response = await DELETE(
      {} as any,
      { params: { id: 'sup-1' } } as any
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('无法删除'),
      })
    );
    expect(supplierService.ensureSupplierCanBeDeleted).toHaveBeenCalledTimes(1);
  });
});
