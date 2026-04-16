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
  deleteExpenseRecord: jest.fn(async () => undefined),
  getExpenseRecordById: jest.fn(async () => null),
  updateExpenseRecord: jest.fn(async () => undefined),
  voidExpenseRecord: jest.fn(async () => undefined),
}));

jest.mock('@/lib/validations/expense', () => ({
  expenseIdSchema: { safeParse: jest.fn() },
  updateExpenseSchema: { safeParse: jest.fn() },
  voidExpenseSchema: { safeParse: jest.fn() },
}));

describe('/api/finance/expenses/[id] DELETE 作废/删除回归', () => {
  const { invalidateReportCache } = jest.requireMock(
    '@/lib/cache/finance-cache'
  ) as {
    invalidateReportCache: jest.Mock;
  };

  const {
    deleteExpenseRecord,
    getExpenseRecordById,
    voidExpenseRecord,
  } = jest.requireMock('@/lib/services/expense-service') as {
    deleteExpenseRecord: jest.Mock;
    getExpenseRecordById: jest.Mock;
    voidExpenseRecord: jest.Mock;
  };

  const { expenseIdSchema, voidExpenseSchema } = jest.requireMock(
    '@/lib/validations/expense'
  ) as {
    expenseIdSchema: { safeParse: jest.Mock };
    voidExpenseSchema: { safeParse: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    expenseIdSchema.safeParse.mockReturnValue({
      success: true,
      data: { id: '11111111-1111-1111-1111-111111111111' },
    });
    voidExpenseSchema.safeParse.mockReturnValue({
      success: true,
      data: { voidReason: '录入有误' },
    });
  });

  test('草稿费用应直接删除，不走作废服务', async () => {
    getExpenseRecordById.mockResolvedValue({
      id: 'expense-draft-1',
      status: 'draft',
    });

    const { DELETE } = await import('@/app/api/finance/expenses/[id]/route');
    const response = await DELETE(
      {
        json: async () => {
          throw new Error('draft delete does not read request body');
        },
      } as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: { message: '删除成功' },
      })
    );

    expect(deleteExpenseRecord).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111'
    );
    expect(voidExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });

  test('已审核费用应读取作废说明并走作废服务', async () => {
    getExpenseRecordById.mockResolvedValue({
      id: 'expense-approved-1',
      status: 'approved',
    });
    voidExpenseRecord.mockResolvedValue({
      id: 'expense-approved-1',
      status: 'cancelled',
    });

    const { DELETE } = await import('@/app/api/finance/expenses/[id]/route');
    const response = await DELETE(
      {
        json: async () => ({ voidReason: '录入有误' }),
      } as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'expense-approved-1',
          status: 'cancelled',
        }),
        message: '费用作废成功',
      })
    );

    expect(voidExpenseSchema.safeParse).toHaveBeenCalledWith({
      voidReason: '录入有误',
    });
    expect(voidExpenseRecord).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'test-user',
      '录入有误'
    );
    expect(deleteExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });

  test('已审核费用提交非法作废说明时应返回 400 且不写入作废', async () => {
    getExpenseRecordById.mockResolvedValue({
      id: 'expense-approved-2',
      status: 'approved',
    });
    voidExpenseSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ message: '作废说明不能超过64个字符' }],
      },
    });

    const { DELETE } = await import('@/app/api/finance/expenses/[id]/route');
    const response = await DELETE(
      {
        json: async () => ({ voidReason: 'x'.repeat(100) }),
      } as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '数据验证失败: 作废说明不能超过64个字符',
      })
    );

    expect(voidExpenseRecord).not.toHaveBeenCalled();
    expect(deleteExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).not.toHaveBeenCalled();
  });

  test('已审核费用请求体为空时，仍应按无说明作废', async () => {
    getExpenseRecordById.mockResolvedValue({
      id: 'expense-approved-3',
      status: 'approved',
    });
    voidExpenseRecord.mockResolvedValue({
      id: 'expense-approved-3',
      status: 'cancelled',
    });

    const { DELETE } = await import('@/app/api/finance/expenses/[id]/route');
    const response = await DELETE(
      {
        json: async () => {
          throw new Error('empty body');
        },
      } as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        message: '费用作废成功',
      })
    );

    expect(voidExpenseSchema.safeParse).not.toHaveBeenCalled();
    expect(voidExpenseRecord).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'test-user',
      undefined
    );
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });

  test('已作废费用重复调用时，应返回 200 和“费用已作废”提示', async () => {
    getExpenseRecordById.mockResolvedValue({
      id: 'expense-cancelled-1',
      status: 'cancelled',
    });
    voidExpenseRecord.mockResolvedValue({
      id: 'expense-cancelled-1',
      status: 'cancelled',
    });

    const { DELETE } = await import('@/app/api/finance/expenses/[id]/route');
    const response = await DELETE(
      {
        json: async () => ({ voidReason: '重复点击' }),
      } as any,
      { params: { id: '11111111-1111-1111-1111-111111111111' } } as any
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        message: '费用已作废',
        data: expect.objectContaining({
          id: 'expense-cancelled-1',
          status: 'cancelled',
        }),
      })
    );

    expect(voidExpenseSchema.safeParse).toHaveBeenCalledWith({
      voidReason: '重复点击',
    });
    expect(voidExpenseRecord).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'test-user',
      '录入有误'
    );
    expect(deleteExpenseRecord).not.toHaveBeenCalled();
    expect(invalidateReportCache).toHaveBeenCalledTimes(1);
  });
});
