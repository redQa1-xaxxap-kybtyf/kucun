import { NextRequest } from 'next/server';

jest.mock('@/lib/services/miniprogram-catalog-service', () => ({
  getMiniProgramCatalog: jest.fn(),
  getMiniProgramProduct: jest.fn(),
  getMiniProgramProductGroup: jest.fn(),
}));

const {
  getMiniProgramCatalog,
  getMiniProgramProduct,
  getMiniProgramProductGroup,
} = jest.requireMock('@/lib/services/miniprogram-catalog-service') as {
  getMiniProgramCatalog: jest.Mock;
  getMiniProgramProduct: jest.Mock;
  getMiniProgramProductGroup: jest.Mock;
};

function createRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('小程序公开目录路由缓存控制', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMiniProgramCatalog.mockResolvedValue({
      groups: [],
      products: [{ id: 'product-1', quantity: 12, unitCost: 5 }],
    });
    getMiniProgramProductGroup.mockResolvedValue({
      id: 'group-1',
      products: [{ id: 'product-1', reservedQuantity: 2 }],
    });
    getMiniProgramProduct.mockResolvedValue({
      id: 'product-1',
      totalCost: 100,
      relatedGroups: [],
    });
  });

  test('目录列表忽略客户端 _t 参数，不触发服务端强制刷新', async () => {
    const { GET } = await import('@/app/api/miniprogram/catalog/route');

    const response = await GET(
      createRequest('/api/miniprogram/catalog?_t=123&page=2')
    );

    expect(response.status).toBe(200);
    expect(getMiniProgramCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2' }),
      expect.not.objectContaining({ forceFresh: true })
    );
    expect(await response.json()).toEqual({
      success: true,
      data: { groups: [], products: [{ id: 'product-1' }] },
    });
  });

  test('产品组详情忽略客户端 _t 参数，不触发服务端强制刷新', async () => {
    const { GET } = await import('@/app/api/miniprogram/groups/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/groups/group-1?_t=123&pageSize=12'),
      { params: { id: 'group-1' } }
    );

    expect(response.status).toBe(200);
    expect(getMiniProgramProductGroup).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ pageSize: '12' }),
      expect.not.objectContaining({ forceFresh: true })
    );
    expect(await response.json()).toEqual({
      success: true,
      data: { id: 'group-1', products: [{ id: 'product-1' }] },
    });
  });

  test('产品详情忽略客户端 _t 参数，不触发服务端强制刷新', async () => {
    const { GET } = await import('@/app/api/miniprogram/products/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/products/product-1?_t=123'),
      { params: { id: 'product-1' } }
    );

    expect(response.status).toBe(200);
    expect(getMiniProgramProduct).toHaveBeenCalledWith(
      'product-1',
      expect.not.objectContaining({ forceFresh: true })
    );
    expect(await response.json()).toEqual({
      success: true,
      data: { id: 'product-1', relatedGroups: [] },
    });
  });

  test('目录列表拒绝非法分页参数', async () => {
    const { GET } = await import('@/app/api/miniprogram/catalog/route');

    const response = await GET(
      createRequest('/api/miniprogram/catalog?page=abc')
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramCatalog).not.toHaveBeenCalled();
  });

  test('目录列表拒绝超出上限的分页参数', async () => {
    const { GET } = await import('@/app/api/miniprogram/catalog/route');

    const response = await GET(
      createRequest('/api/miniprogram/catalog?page=501&pageSize=61')
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramCatalog).not.toHaveBeenCalled();
  });

  test('产品组详情限制搜索词长度', async () => {
    const { GET } = await import('@/app/api/miniprogram/groups/[id]/route');
    const search = 'x'.repeat(121);

    const response = await GET(
      createRequest(
        `/api/miniprogram/groups/group-1?search=${encodeURIComponent(search)}`
      ),
      { params: { id: 'group-1' } }
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramProductGroup).not.toHaveBeenCalled();
  });

  test('产品组详情拒绝无法解码的路由参数', async () => {
    const { GET } = await import('@/app/api/miniprogram/groups/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/groups/%E0%A4%A'),
      { params: { id: '%E0%A4%A' } }
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramProductGroup).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      success: false,
      error: '产品组参数不正确',
    });
  });

  test('产品组详情拒绝超出上限的分页参数', async () => {
    const { GET } = await import('@/app/api/miniprogram/groups/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/groups/group-1?page=1&pageSize=61'),
      { params: { id: 'group-1' } }
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramProductGroup).not.toHaveBeenCalled();
  });

  test('产品详情拒绝无法解码的路由参数', async () => {
    const { GET } = await import('@/app/api/miniprogram/products/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/products/%E0%A4%A'),
      { params: { id: '%E0%A4%A' } }
    );

    expect(response.status).toBe(400);
    expect(getMiniProgramProduct).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      success: false,
      error: '产品参数不正确',
    });
  });

  test('公开接口设置小程序公共缓存头', async () => {
    const { GET } = await import('@/app/api/miniprogram/products/[id]/route');

    const response = await GET(
      createRequest('/api/miniprogram/products/product-1'),
      { params: { id: 'product-1' } }
    );

    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Vary')).toBe('x-client-from');
  });
});
