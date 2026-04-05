jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      public readonly body: unknown,
      public readonly status: number
    ) {}

    async json() {
      return this.body;
    }
  }

  return {
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any, _options?: { permissions?: string[] }) =>
    async (request: any, context?: any) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: 'admin-user',
          role: 'admin',
          permissions: ['settings:manage_users'],
        },
      }),
}));

jest.mock('@/lib/logger', () => ({
  extractRequestInfo: jest.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  })),
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  logUserAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('@/lib/validations/settings', () => {
  const { z } = require('zod') as typeof import('zod');

  return {
    CreateUserSchema: z.object({
      email: z.string().email('邮箱格式不正确'),
      name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),
      password: z
        .string()
        .min(6, '密码至少需要6个字符')
        .max(50, '密码不能超过50个字符'),
      role: z.enum(['admin', 'sales']),
      username: z
        .string()
        .min(3, '用户名至少需要3个字符')
        .max(20, '用户名不能超过20个字符')
        .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
    }),
    UpdateUserSchema: z.object({
      email: z.string().email('邮箱格式不正确').optional(),
      name: z
        .string()
        .min(1, '姓名不能为空')
        .max(50, '姓名不能超过50个字符')
        .optional(),
      role: z.enum(['admin', 'sales']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      userId: z.string().min(1, '用户ID不能为空'),
      username: z
        .string()
        .min(3, '用户名至少需要3个字符')
        .max(20, '用户名不能超过20个字符')
        .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
        .optional(),
    }),
    ResetPasswordSchema: z.object({
      newPassword: z
        .string()
        .min(6, '密码至少需要6个字符')
        .max(50, '密码不能超过50个字符'),
      userId: z.string().min(1, '用户ID不能为空'),
    }),
    UserListQuerySchema: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
      page: z.coerce.number().int().min(1).optional().default(1),
      role: z.enum(['admin', 'sales']).optional().nullable(),
      search: z.string().optional().nullable(),
      status: z.enum(['active', 'inactive']).optional().nullable(),
    }),
  };
});

jest.mock('@/lib/env', () => ({
  env: {
    BCRYPT_SALT_ROUNDS: 10,
    NODE_ENV: 'production',
  },
  paginationConfig: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };
const { env } = jest.requireMock('@/lib/env') as {
  env: { BCRYPT_SALT_ROUNDS: number; NODE_ENV: string };
};
const { logUserAction } = jest.requireMock('@/lib/logger') as {
  logUserAction: jest.Mock;
};
const { hash } = jest.requireMock('bcryptjs') as {
  hash: jest.Mock;
};

describe('/api/settings/users route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.NODE_ENV = 'production';

    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }

    Object.assign(prisma, {
      user: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    });
  });

  test('GET: 非法查询参数应返回 400', async () => {
    const { GET } = await import('@/app/api/settings/users/route');
    const response = await GET({
      nextUrl: new URL('http://localhost/api/settings/users?status=oops'),
      url: 'http://localhost/api/settings/users?status=oops',
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
      })
    );
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  test('GET: 搜索条件应兼容 MySQL，不再使用 mode insensitive', async () => {
    (prisma.user.count as jest.Mock).mockResolvedValue(1);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        email: 'admin@example.com',
        id: 'user-1',
        name: '管理员',
        role: 'admin',
        status: 'active',
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
        username: 'admin',
      },
    ]);

    const { GET } = await import('@/app/api/settings/users/route');
    const response = await GET({
      nextUrl: new URL(
        'http://localhost/api/settings/users?page=1&limit=20&search=admin'
      ),
      url: 'http://localhost/api/settings/users?page=1&limit=20&search=admin',
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 1,
          users: expect.arrayContaining([
            expect.objectContaining({
              id: 'user-1',
              username: 'admin',
            }),
          ]),
        }),
      })
    );

    const [countArgs] = (prisma.user.count as jest.Mock).mock.calls[0] as [
      Record<string, unknown>,
    ];
    const [findManyArgs] = (prisma.user.findMany as jest.Mock).mock.calls[0] as [
      Record<string, unknown>,
    ];

    expect(countArgs.where).toEqual(
      expect.objectContaining({
        OR: [
          { username: { contains: 'admin' } },
          { email: { contains: 'admin' } },
          { name: { contains: 'admin' } },
        ],
      })
    );
    expect(findManyArgs.where).toEqual(countArgs.where);
  });

  test('POST: 非法数据应返回 400', async () => {
    const { POST } = await import('@/app/api/settings/users/route');
    const response = await POST({
      json: async () => ({
        username: 'ab',
        name: '',
        password: '123',
        role: 'admin',
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
      })
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('POST: 创建用户成功时应写入 hash 和审计日志', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      email: 'sales01@example.com',
      id: 'user-sales-1',
      name: '销售一号',
      role: 'sales',
      status: 'active',
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      username: 'sales01',
    });

    const { POST } = await import('@/app/api/settings/users/route');
    const response = await POST({
      json: async () => ({
        email: 'sales01@example.com',
        name: '销售一号',
        password: 'secret123',
        role: 'sales',
        username: 'sales01',
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(hash).toHaveBeenCalledWith('secret123', 10);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'sales01@example.com',
          passwordHash: 'hashed-password',
          role: 'sales',
          status: 'active',
          username: 'sales01',
        }),
      })
    );
    expect(logUserAction).toHaveBeenCalledWith(
      'create_user',
      '创建新用户账户：sales01',
      'admin-user',
      '127.0.0.1',
      'jest',
      expect.objectContaining({
        targetRole: 'sales',
        targetUserId: 'user-sales-1',
        targetUsername: 'sales01',
      })
    );
  });

  test('PUT: 不允许禁用自己的账户', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-user',
      role: 'admin',
      status: 'active',
    });

    const { PUT } = await import('@/app/api/settings/users/route');
    const response = await PUT({
      json: async () => ({
        status: 'inactive',
        userId: 'admin-user',
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '不能禁用自己的账户',
      })
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('DELETE: 生产模式下不允许删除自己的账户', async () => {
    env.NODE_ENV = 'production';

    const { DELETE } = await import('@/app/api/settings/users/route');
    const response = await DELETE({
      json: async () => ({
        userId: 'admin-user',
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '不能删除自己的账户',
      })
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('DELETE: 删除其他用户时应改为 inactive 并记录审计日志', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'sales02',
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      email: 'sales02@example.com',
      id: 'user-2',
      name: '销售二号',
      role: 'sales',
      status: 'inactive',
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      username: 'sales02',
    });

    const { DELETE } = await import('@/app/api/settings/users/route');
    const response = await DELETE({
      json: async () => ({
        userId: 'user-2',
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'inactive' },
        where: { id: 'user-2' },
      })
    );
    expect(logUserAction).toHaveBeenCalledWith(
      'delete_user',
      '删除用户账户：sales02',
      'admin-user',
      '127.0.0.1',
      'jest',
      expect.objectContaining({
        targetRole: 'sales',
        targetUserId: 'user-2',
        targetUsername: 'sales02',
      })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        message: '用户删除成功',
      })
    );
  });
});

describe('/api/settings/users/reset-password route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.NODE_ENV = 'production';

    for (const key of Object.keys(prisma)) {
      delete prisma[key];
    }

    Object.assign(prisma, {
      user: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    });
  });

  test('非管理员不能重置密码', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'sales',
    });

    const { POST } = await import('@/app/api/settings/users/reset-password/route');
    const response = await POST({
      json: async () => ({
        newPassword: 'secret123',
        userId: 'user-2',
      }),
    } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '权限不足，只有管理员可以重置用户密码',
      })
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('非法重置参数应返回 400', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'admin',
    });

    const { POST } = await import('@/app/api/settings/users/reset-password/route');
    const response = await POST({
      json: async () => ({
        newPassword: '123',
        userId: '',
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
      })
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('目标用户不存在时应返回 404', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/settings/users/reset-password/route');
    const response = await POST({
      json: async () => ({
        newPassword: 'secret123',
        userId: 'user-missing',
      }),
    } as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '用户不存在',
      })
    );
  });

  test('管理员重置密码成功时应更新 hash', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce({ id: 'user-2', username: 'sales02' });

    const { POST } = await import('@/app/api/settings/users/reset-password/route');
    const response = await POST({
      json: async () => ({
        newPassword: 'secret123',
        userId: 'user-2',
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(hash).toHaveBeenCalledWith('secret123', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      data: { passwordHash: 'hashed-password' },
      where: { id: 'user-2' },
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        message: '密码重置成功',
      })
    );
  });
});
