import type { NextRequest } from 'next/server';

import { getAuthVerificationHeaderValue } from '@/lib/auth/trusted-headers';

jest.mock('@/lib/api/handlers/seed-data', () => ({
  generateTestDataSet: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/services/system-write-lock', () => ({
  getSystemWriteLock: jest.fn(async () => null),
}));

const { generateTestDataSet } = jest.requireMock(
  '@/lib/api/handlers/seed-data'
) as {
  generateTestDataSet: jest.Mock;
};

function createRequest(role: 'admin' | 'sales' = 'admin'): NextRequest {
  return {
    headers: new Headers({
      'x-auth-verified': getAuthVerificationHeaderValue(),
      'x-client-from': 'mini-program',
      'x-user-id': `${role}-user-1`,
      'x-user-role': role,
      'x-user-username': role,
    }),
    method: 'POST',
    nextUrl: {
      origin: 'http://localhost:3000',
      pathname: '/api/seed-test-data',
    },
  } as unknown as NextRequest;
}

function setNodeEnv(value: string) {
  process.env.NODE_ENV = value;
}

describe('/api/seed-test-data production safety gate', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnabled = process.env.ENABLE_TEST_DATA_API;
  const originalProductionConfirm =
    process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_TEST_DATA_API;
    delete process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM;
    setNodeEnv('test');

    generateTestDataSet.mockResolvedValue({
      categories: 1,
      customers: 4,
      inventory: 6,
      products: 2,
      suppliers: 5,
      variants: 3,
    });
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      setNodeEnv(originalNodeEnv);
    }

    if (originalEnabled === undefined) {
      delete process.env.ENABLE_TEST_DATA_API;
    } else {
      process.env.ENABLE_TEST_DATA_API = originalEnabled;
    }

    if (originalProductionConfirm === undefined) {
      delete process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM;
    } else {
      process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM =
        originalProductionConfirm;
    }
  });

  it('默认关闭测试数据接口，且不执行写入', async () => {
    const { POST } = await import('@/app/api/seed-test-data/route');

    const response = await POST(createRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Not Found',
      success: false,
    });
    expect(generateTestDataSet).not.toHaveBeenCalled();
  });

  it('即使开启开关，也拒绝非管理员调用', async () => {
    process.env.ENABLE_TEST_DATA_API = 'true';
    const { POST } = await import('@/app/api/seed-test-data/route');

    const response = await POST(createRequest('sales'));

    expect(response.status).toBe(403);
    expect(generateTestDataSet).not.toHaveBeenCalled();
  });

  it('非生产环境显式开启后允许管理员生成测试数据', async () => {
    process.env.ENABLE_TEST_DATA_API = 'true';
    const { POST } = await import('@/app/api/seed-test-data/route');

    const response = await POST(createRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        categories: 1,
        customers: 4,
        inventory: 6,
        products: 2,
        suppliers: 5,
        variants: 3,
      },
      success: true,
    });
    expect(generateTestDataSet).toHaveBeenCalledTimes(1);
  });

  it('生产环境开启但未设置二次确认时仍然拒绝写入', async () => {
    setNodeEnv('production');
    process.env.ENABLE_TEST_DATA_API = '1';
    const { POST } = await import('@/app/api/seed-test-data/route');

    const response = await POST(createRequest());

    expect(response.status).toBe(404);
    expect(generateTestDataSet).not.toHaveBeenCalled();
  });

  it('生产环境必须同时具备开关和二次确认才允许生成测试数据', async () => {
    setNodeEnv('production');
    process.env.ENABLE_TEST_DATA_API = 'true';
    process.env.ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM =
      'I_UNDERSTAND_THIS_CREATES_TEST_DATA';
    const { POST } = await import('@/app/api/seed-test-data/route');

    const response = await POST(createRequest());

    expect(response.status).toBe(201);
    expect(generateTestDataSet).toHaveBeenCalledTimes(1);
  });
});
