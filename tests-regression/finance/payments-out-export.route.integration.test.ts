jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) => {
      const user = {
        id: 'test-user',
        name: '测试财务',
        email: 'finance@example.com',
        role: 'finance',
        permissions: ['finance:view'],
      };
      return handler(request, { ...context, user });
    },
  errorResponse: (message: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/validations/payable', () => ({
  paymentOutRecordQuerySchema: {
    safeParse: jest.fn(),
  },
}));

jest.mock('@/lib/services/csv-export-service', () => ({
  CSVExportService: {
    generateCSVContent: jest.fn(() => 'csv-content'),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    paymentOutRecord: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('/api/finance/payments-out/export（导出口径回归）', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      paymentOutRecord: {
        count: jest.Mock;
        findMany: jest.Mock;
      };
    };
  };

  const { paymentOutRecordQuerySchema } = jest.requireMock(
    '@/lib/validations/payable'
  ) as {
    paymentOutRecordQuerySchema: { safeParse: jest.Mock };
  };

  const { CSVExportService } = jest.requireMock(
    '@/lib/services/csv-export-service'
  ) as {
    CSVExportService: { generateCSVContent: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('CSV 导出应输出中文付款方式与中文付款状态标签，而不是底层枚举值', async () => {
    paymentOutRecordQuerySchema.safeParse.mockReturnValue({
      success: true,
      data: {
        page: 1,
        limit: 50000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    });

    prisma.paymentOutRecord.count.mockResolvedValue(1);
    prisma.paymentOutRecord.findMany.mockResolvedValue([
      {
        paymentNumber: 'FK-001',
        paymentAmount: 100,
        actualPaymentAmount: 99,
        roundingAmount: 1,
        paymentMethod: 'bank_transfer',
        status: 'confirmed',
        paymentDate: new Date('2026-04-01T10:00:00.000Z'),
        supplier: {
          id: 'sup-1',
          name: '供应商A',
          phone: null,
        },
        payableRecord: {
          id: 'payable-1',
          payableNumber: 'YFK-001',
          payableAmount: 100,
          remainingAmount: 0,
        },
        user: {
          id: 'user-1',
          name: '财务A',
        },
        voucherNumber: 'V-001',
        remarks: '测试备注',
      },
    ]);

    const { POST } = await import('@/app/api/finance/payments-out/export/route');

    const response = await POST(
      new Request('http://localhost/api/finance/payments-out/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv' }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('csv-content');

    expect(CSVExportService.generateCSVContent).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          付款编号: 'FK-001',
          供应商名称: '供应商A',
          付款方式: '银行转账',
          付款状态: '已确认',
        }),
      ],
      expect.objectContaining({
        fieldOrder: expect.arrayContaining(['付款方式', '付款状态']),
      })
    );

    const [exportRows] = CSVExportService.generateCSVContent.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];

    expect(exportRows[0]?.付款方式).toBe('银行转账');
    expect(exportRows[0]?.付款状态).toBe('已确认');
    expect(exportRows[0]?.付款方式).not.toBe('bank_transfer');
    expect(exportRows[0]?.付款状态).not.toBe('confirmed');
  });
});
