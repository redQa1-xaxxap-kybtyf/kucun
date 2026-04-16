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

jest.mock('@/lib/api/middleware', () => ({
  resolveParams: async (params: any) => params ?? {},
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) =>
      handler(request, {
        ...context,
        user: {
          id: 'test-user',
          role: 'admin',
          permissions: ['finance:view', 'finance:manage'],
        },
      }),
  successResponse: (data: unknown, status = 200, message?: string) => ({
    status,
    json: async () => ({
      success: true,
      data,
      ...(message ? { message } : {}),
    }),
  }),
  errorResponse: (error: string, status = 400) => ({
    status,
    json: async () => ({
      success: false,
      error,
    }),
  }),
}));

jest.mock('@/lib/cache/finance-cache', () => ({
  invalidateReportCache: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/expense-service', () => ({
  createExpenseRecord: jest.fn(async () => undefined),
  getExpenseRecords: jest.fn(async () => undefined),
  approveExpenseRecord: jest.fn(async () => undefined),
}));

jest.mock('@/lib/validations/expense', () => ({
  createExpenseSchema: { safeParse: jest.fn() },
  expenseFilterSchema: { safeParse: jest.fn() },
  expenseIdSchema: { safeParse: jest.fn() },
}));

describe('费用创建/审核路由缓存回归', () => {
  const { invalidateReportCache } = jest.requireMock(
    '@/lib/cache/finance-cache'
  ) as {
    invalidateReportCache: jest.Mock;
  };

  const { createExpenseRecord, approveExpenseRecord } = jest.requireMock(
    '@/lib/services/expense-service'
  ) as {
    createExpenseRecord: jest.Mock;
    approveExpenseRecord: jest.Mock;
  };

  const { createExpenseSchema, expenseIdSchema } = jest.requireMock(
    '@/lib/validations/expense'
  ) as {
    createExpenseSchema: { safeParse: jest.Mock };
    expenseIdSchema: { safeParse: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/finance/expenses：创建成功后应失效报表缓存', async () => {
    createExpenseSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        expenseType: 'shipping',
        expenseName: '运费',
        expenseAmount: 100,
        expenseDate: '2026-04-16',
      },
    });
    createExpenseRecord.mockResolvedValue({
      id: 'expense-created-1',
      status: 'draft',
    });

    const { POST } = await import('@/app/api/finance/expenses/route');
    const response = await POST({
      json: async () => ({
        expenseType: 'shipping',
        expenseName: '运费',
        expenseAmount: 100,
        expenseDate: '2026-04-16',
      }),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'expense-created-1',
          status: 'draft',
        }),
      })
    );
    expect(createExpenseRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        expenseType: 'shipping',
        expenseName: '运费',
      }),
      'test-user'
    );
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });

  test('POST /api/finance/expenses：校验失败时不应失效报表缓存', async () => {
    createExpenseSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ message: '费用名称不能为空' }],
      },
    });

    const { POST } = await import('@/app/api/finance/expenses/route');
    const response = await POST({
      json: async () => ({
        expenseType: 'shipping',
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '数据验证失败: 费用名称不能为空',
      })
    );
    expect(createExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).not.toHaveBeenCalled();
  });

  test('POST /api/finance/expenses/[id]/approve：审核成功后应失效报表缓存', async () => {
    expenseIdSchema.safeParse.mockReturnValue({
      success: true,
      data: { id: '11111111-1111-1111-1111-111111111111' },
    });
    approveExpenseRecord.mockResolvedValue({
      id: 'expense-approved-1',
      status: 'approved',
    });

    const { POST } = await import('@/app/api/finance/expenses/[id]/approve/route');
    const response = await POST(
      {} as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'expense-approved-1',
          status: 'approved',
        }),
      })
    );
    expect(approveExpenseRecord).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'test-user'
    );
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });

  test('POST /api/finance/expenses/[id]/approve：编号校验失败时不应失效报表缓存', async () => {
    expenseIdSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ message: '费用记录编号格式不正确' }],
      },
    });

    const { POST } = await import('@/app/api/finance/expenses/[id]/approve/route');
    const response = await POST(
      {} as any,
      { params: { id: 'bad-id' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '提交内容有误： 费用记录编号格式不正确',
      })
    );
    expect(approveExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).not.toHaveBeenCalled();
  });
});
