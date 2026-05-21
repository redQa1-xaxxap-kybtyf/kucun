import { NextRequest } from 'next/server';

import { getAuthVerificationHeaderValue } from '@/lib/auth/trusted-headers';

const mockPrisma: any = {};
const mockBcryptCompare = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  compare: mockBcryptCompare,
  default: {
    compare: mockBcryptCompare,
  },
}));

jest.mock('next-auth/jwt', () => ({
  decode: jest.fn(),
  encode: jest.fn(async () => 'mock-mini-token'),
  getToken: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/services/login-log-service', () => ({
  checkLoginLimit: jest.fn(async () => ({ allowed: true })),
  logLoginFailure: jest.fn(),
  logLoginSuccess: jest.fn(),
}));

jest.mock('@/lib/services/user-session-service', () => ({
  getMaxConcurrentSessionsForRole: jest.fn(() => 3),
  registerUserSession: jest.fn(),
  validateAndTouchUserSession: jest.fn(async () => ({ valid: true })),
}));

jest.mock('@/lib/services/miniprogram-catalog-service', () => ({
  getMiniProgramCatalogSettings: jest.fn(),
  updateMiniProgramCatalogSettings: jest.fn(),
  updateMiniProgramProductDisplayOverride: jest.fn(),
  updateMiniProgramProductDisplayOverrides: jest.fn(),
}));

const { getToken } = jest.requireMock('next-auth/jwt') as {
  getToken: jest.Mock;
};
const { getMiniProgramCatalogSettings } = jest.requireMock(
  '@/lib/services/miniprogram-catalog-service'
) as {
  getMiniProgramCatalogSettings: jest.Mock;
};

function createRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {}
) {
  return new NextRequest(`http://localhost${path}`, {
    method: options.method || 'GET',
    headers: options.headers,
  });
}

function createAuthedRequest(path: string, role: string) {
  return createRequest(path, {
    headers: {
      'x-user-id': `${role}-user`,
      'x-user-username': role,
      'x-user-role': role,
      'x-auth-verified': getAuthVerificationHeaderValue(),
      'x-user-email': `${role}@example.com`,
      'x-user-name': encodeURIComponent(
        role === 'admin' ? '管理员' : '普通用户'
      ),
      'x-user-status': 'active',
    },
  });
}

function createLoginRequest(username: string, password: string) {
  return new NextRequest('http://localhost/api/auth/mini-login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'miniprogram-jest',
      'x-forwarded-for': '203.0.113.8',
    },
    body: JSON.stringify({ username, password }),
  });
}

function createDbUser(role: 'admin' | 'sales', status = 'active') {
  return {
    id: `${role}-user`,
    email: `${role}@example.com`,
    username: role,
    name: role === 'admin' ? '管理员' : '普通用户',
    passwordHash: 'hashed-password',
    role,
    status,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getToken.mockResolvedValue(null);

  for (const key of Object.keys(mockPrisma)) {
    delete mockPrisma[key];
  }

  Object.assign(mockPrisma, {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(async () => ({ id: 'updated-user' })),
    },
  });
});

describe('小程序管理员与普通用户全链路边界', () => {
  test('普通客户：公开目录和公开报货入口无需登录即可通过中间件', async () => {
    const { authMiddleware } = await import('@/lib/auth-middleware');

    const catalogResponse = await authMiddleware(
      createRequest('/api/miniprogram/catalog', {
        headers: { 'x-client-from': 'mini-program' },
      })
    );
    const goodsRequestResponse = await authMiddleware(
      createRequest('/api/miniprogram/goods-requests', {
        method: 'POST',
        headers: { 'x-client-from': 'mini-program' },
      })
    );

    expect(catalogResponse.status).toBe(200);
    expect(goodsRequestResponse.status).toBe(200);
    expect(getToken).not.toHaveBeenCalled();
  });

  test('普通客户：未登录不能访问小程序管理设置接口', async () => {
    const { authMiddleware } = await import('@/lib/auth-middleware');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const response = await authMiddleware(
        createRequest('/api/miniprogram/catalog-settings', {
          headers: { 'x-client-from': 'mini-program' },
        })
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: '未授权访问',
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test.each(['admin', 'sales'] as const)(
    '登录链路：%s 用户成功登录后返回对应角色和小程序 token',
    async role => {
      mockPrisma.user.findUnique.mockResolvedValue(createDbUser(role));
      mockBcryptCompare.mockResolvedValue(true);
      const { POST } = await import('@/app/api/auth/mini-login/route');

      const response = await POST(createLoginRequest(role, 'password123'));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'mock-mini-token',
            tokenType: 'Bearer',
            user: expect.objectContaining({
              id: `${role}-user`,
              username: role,
              role,
            }),
          }),
        })
      );
    }
  );

  test('普通用户：不能读取管理员专用的小程序目录设置', async () => {
    const { GET } = await import(
      '@/app/api/miniprogram/catalog-settings/route'
    );

    const response = await GET(
      createAuthedRequest('/api/miniprogram/catalog-settings', 'sales')
    );

    expect(response.status).toBe(403);
    expect(getMiniProgramCatalogSettings).not.toHaveBeenCalled();
  });

  test('管理员：可以读取小程序目录设置', async () => {
    getMiniProgramCatalogSettings.mockResolvedValue({
      colorSeries: [],
      componentTypes: [],
      productOverrides: {},
      note: '测试设置',
    });
    const { GET } = await import(
      '@/app/api/miniprogram/catalog-settings/route'
    );

    const response = await GET(
      createAuthedRequest('/api/miniprogram/catalog-settings', 'admin')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        colorSeries: [],
        componentTypes: [],
        productOverrides: {},
        note: '测试设置',
      },
    });
  });
});
