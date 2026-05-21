import type { NextRequest } from 'next/server';

import { GET as getBatchMatch } from '@/app/api/batches/match/route';
import { POST as postPerformanceCategory } from '@/app/api/performance/categories/route';
import { getAuthVerificationHeaderValue } from '@/lib/auth/trusted-headers';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
    purchaseOrderItem: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/system-write-lock', () => ({
  getSystemWriteLock: jest.fn(async () => null),
}));

const prismaMock = prisma as unknown as {
  category: {
    create: jest.Mock;
    findUnique: jest.Mock;
  };
  inventory: {
    findMany: jest.Mock;
  };
  purchaseOrderItem: {
    findMany: jest.Mock;
  };
};

function trustedAdminHeaders() {
  return {
    'x-auth-verified': getAuthVerificationHeaderValue(),
    'x-user-id': 'admin-123',
    'x-user-username': 'admin',
    'x-user-role': 'admin',
  };
}

function createRequest({
  body,
  headers = {},
  method = 'GET',
  pathname,
  search = '',
}: {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  pathname: string;
  search?: string;
}): NextRequest {
  const url = `http://localhost:3000${pathname}${search}`;

  return {
    headers: new Headers(headers),
    json: jest.fn(async () => body),
    method,
    nextUrl: {
      origin: 'http://localhost:3000',
      pathname,
      searchParams: new URL(url).searchParams,
    },
    url,
  } as unknown as NextRequest;
}

describe('sensitive endpoints require trusted authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('拒绝伪造身份头访问批次匹配接口，且不执行库存/供应商查询', async () => {
    const response = await getBatchMatch(
      createRequest({
        headers: {
          'x-user-id': 'fake-admin',
          'x-user-role': 'admin',
          'x-user-username': 'fake-admin',
        },
        pathname: '/api/batches/match',
        search:
          '?productId=11111111-1111-4111-8111-111111111111&productCode=P001',
      })
    );

    expect(response.status).toBe(401);
    expect(prismaMock.inventory.findMany).not.toHaveBeenCalled();
    expect(prismaMock.purchaseOrderItem.findMany).not.toHaveBeenCalled();
  });

  it('允许可信管理员身份进入批次匹配接口', async () => {
    prismaMock.inventory.findMany.mockResolvedValue([]);

    const response = await getBatchMatch(
      createRequest({
        headers: trustedAdminHeaders(),
        pathname: '/api/batches/match',
        search:
          '?productId=11111111-1111-4111-8111-111111111111&productCode=P001',
      })
    );

    await expect(response.json()).resolves.toEqual({
      data: { batches: [], count: 0, hasMatch: false },
      error: null,
    });
    expect(response.status).toBe(200);
    expect(prismaMock.inventory.findMany).toHaveBeenCalledTimes(1);
  });

  it('拒绝伪造身份头创建性能测试分类，且不执行分类写入', async () => {
    const response = await postPerformanceCategory(
      createRequest({
        body: { code: 'PERF_TEST', name: '测试分类' },
        headers: {
          'x-client-from': 'mini-program',
          'x-user-id': 'fake-admin',
          'x-user-role': 'admin',
          'x-user-username': 'fake-admin',
        },
        method: 'POST',
        pathname: '/api/performance/categories',
      })
    );

    expect(response.status).toBe(401);
    expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it('允许可信管理员身份创建性能测试分类', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({
      code: 'PERF_TEST',
      id: 'category-1',
      name: '测试分类',
    });

    const response = await postPerformanceCategory(
      createRequest({
        body: { code: 'PERF_TEST', name: '测试分类' },
        headers: {
          ...trustedAdminHeaders(),
          'x-client-from': 'mini-program',
        },
        method: 'POST',
        pathname: '/api/performance/categories',
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        code: 'PERF_TEST',
        id: 'category-1',
        name: '测试分类',
      },
      success: true,
    });
    expect(response.status).toBe(201);
    expect(prismaMock.category.create).toHaveBeenCalledTimes(1);
  });
});
