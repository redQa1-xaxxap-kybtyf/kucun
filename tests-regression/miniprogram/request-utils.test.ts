type WxRequestOptions = {
  url: string;
  method?: string;
  data?: unknown;
  timeout?: number;
  header?: Record<string, string>;
  success: (response: {
    statusCode: number;
    data: { success: boolean; data?: unknown; error?: string };
  }) => void;
  fail: (error: { errMsg?: string }) => void;
};

declare global {
  var wx: {
    getStorageSync: jest.Mock;
    removeStorageSync: jest.Mock;
    request: jest.Mock;
    reLaunch: jest.Mock;
    showToast: jest.Mock;
    setStorageSync: jest.Mock;
  };
}

function setupWxMock(
  responseHandlers?: Array<(options: WxRequestOptions) => void>,
  initialStorage?: Record<string, unknown>
) {
  const handlers = Array.isArray(responseHandlers)
    ? responseHandlers.slice()
    : [];
  const storage = { ...(initialStorage || {}) };

  global.wx = {
    getStorageSync: jest.fn((key: string) =>
      Object.prototype.hasOwnProperty.call(storage, key)
        ? storage[key]
        : key === 'mini_admin_token'
          ? 'mock-admin-token'
          : ''
    ),
    removeStorageSync: jest.fn((key: string) => {
      delete storage[key];
    }),
    request: jest.fn((options: WxRequestOptions) => {
      const handler = handlers.shift();
      if (typeof handler === 'function') {
        handler(options);
        return;
      }

      options.success({
        statusCode: 200,
        data: { success: true, data: { ok: true } },
      });
    }),
    reLaunch: jest.fn(),
    showToast: jest.fn(),
    setStorageSync: jest.fn((key: string, value: unknown) => {
      storage[key] = value;
    }),
  };
}

function loadRequest() {
  jest.resetModules();
  return require('../../erpxcx/utils/request').request;
}

function loadProducts() {
  jest.resetModules();
  return require('../../erpxcx/utils/products');
}

function loadCatalog() {
  jest.resetModules();
  return require('../../erpxcx/utils/catalog');
}

function loadGoodsRequests() {
  jest.resetModules();
  return require('../../erpxcx/utils/goods-requests');
}

describe('小程序请求封装', () => {
  afterEach(() => {
    delete global.wx;
  });

  test('公开 GET 不携带管理员 token，并使用短超时', async () => {
    setupWxMock();
    const request = loadRequest();

    await expect(
      request({ url: '/api/miniprogram/catalog' })
    ).resolves.toEqual({ ok: true });

    const call = global.wx.request.mock.calls[0][0];
    expect(global.wx.getStorageSync).not.toHaveBeenCalledWith(
      'mini_admin_token'
    );
    expect(call.method).toBe('GET');
    expect(call.timeout).toBe(10000);
    expect(call.header).toEqual(
      expect.objectContaining({ 'x-client-from': 'mini-program' })
    );
    expect(call.header.Authorization).toBeUndefined();
    expect(call.header['x-mini-token']).toBeUndefined();
  });

  test('认证请求显式携带管理员 token，并使用管理端超时', async () => {
    setupWxMock();
    const request = loadRequest();

    await request({ url: '/api/profile', requireAuth: true });

    const call = global.wx.request.mock.calls[0][0];
    expect(global.wx.getStorageSync).toHaveBeenCalledWith('mini_admin_token');
    expect(call.timeout).toBe(20000);
    expect(call.header.Authorization).toBe('Bearer mock-admin-token');
    expect(call.header['x-mini-token']).toBe('mock-admin-token');
  });

  test('公开 GET 服务端错误时默认重试一次', async () => {
    setupWxMock([
      options =>
        options.success({
          statusCode: 502,
          data: { success: false, error: 'bad gateway' },
        }),
      options =>
        options.success({
          statusCode: 200,
          data: { success: true, data: { recovered: true } },
        }),
    ]);
    const request = loadRequest();

    await expect(
      request({ url: '/api/miniprogram/catalog' })
    ).resolves.toEqual({ recovered: true });
    expect(global.wx.request).toHaveBeenCalledTimes(2);
  });

  test('公开 GET 收到 401 不清理管理员登录态', async () => {
    setupWxMock([
      options =>
        options.success({
          statusCode: 401,
          data: { success: false, error: 'unauthorized' },
        }),
    ]);
    const request = loadRequest();

    await expect(request({ url: '/api/miniprogram/catalog' })).rejects.toThrow(
      'unauthorized'
    );

    expect(global.wx.removeStorageSync).not.toHaveBeenCalled();
    expect(global.wx.reLaunch).not.toHaveBeenCalled();
  });

  test('公开报货提交不携带管理员 token', async () => {
    setupWxMock();
    const { submitGoodsRequest } = loadGoodsRequests();

    await expect(
      submitGoodsRequest({
        customerPhone: '13800000000',
        items: [
          {
            productSource: 'own',
            productId: '11111111-1111-4111-8111-111111111111',
            productCode: 'OWN-001',
            productName: '雅士白罗马柱',
            unit: '片',
            quantity: 20,
          },
        ],
      })
    ).resolves.toEqual({ ok: true });

    const call = global.wx.request.mock.calls[0][0];
    expect(global.wx.getStorageSync).not.toHaveBeenCalledWith(
      'mini_admin_token'
    );
    expect(call.url).toContain('/api/miniprogram/goods-requests');
    expect(call.method).toBe('POST');
    expect(call.timeout).toBe(20000);
    expect(call.header).toEqual(
      expect.objectContaining({ 'x-client-from': 'mini-program' })
    );
    expect(call.header.Authorization).toBeUndefined();
    expect(call.header['x-mini-token']).toBeUndefined();
  });

  test('认证请求收到 401 清理登录态并跳转登录页', async () => {
    setupWxMock([
      options =>
        options.success({
          statusCode: 401,
          data: { success: false, error: 'token expired' },
        }),
    ]);
    const request = loadRequest();

    await expect(
      request({ url: '/api/profile', requireAuth: true })
    ).rejects.toThrow('登录状态已失效，请重新登录');

    expect(global.wx.removeStorageSync).toHaveBeenCalledWith(
      'mini_admin_token'
    );
    expect(global.wx.removeStorageSync).toHaveBeenCalledWith(
      'mini_admin_user'
    );
    expect(global.wx.removeStorageSync).toHaveBeenCalledWith(
      'mini_admin_expires_at'
    );
    expect(global.wx.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/admin/login' })
    );
  });

  test('管理端分类列表显式走认证请求', async () => {
    setupWxMock();
    const { getCategories } = loadProducts();

    await expect(getCategories()).resolves.toEqual([]);

    const call = global.wx.request.mock.calls[0][0];
    expect(call.url).toContain('/api/categories?');
    expect(call.header['x-client-from']).toBeUndefined();
    expect(call.header.Authorization).toBe('Bearer mock-admin-token');
    expect(call.header['x-mini-token']).toBe('mock-admin-token');
  });

  test('目录缓存命中后的后台刷新按 cache key 去重', async () => {
    const cacheKey = 'mini_catalog_response_cache:catalog%7C%7C';
    setupWxMock(
      [
        () => {
          // 后台刷新保持挂起，用于验证第二次缓存命中不会重复发起请求。
        },
      ],
      {
        [cacheKey]: {
          version: 'v1',
          cachedAt: Date.now(),
          data: { groups: [{ id: 'cached-group' }] },
        },
      }
    );
    const { getCatalog } = loadCatalog();

    await expect(getCatalog()).resolves.toEqual({
      groups: [{ id: 'cached-group' }],
    });
    await expect(getCatalog()).resolves.toEqual({
      groups: [{ id: 'cached-group' }],
    });

    expect(global.wx.request).toHaveBeenCalledTimes(1);
  });
});
