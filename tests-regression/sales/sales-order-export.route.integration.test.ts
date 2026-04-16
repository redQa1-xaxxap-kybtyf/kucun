import * as XLSX from 'xlsx';

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) => {
      const user = {
        id: 'test-user',
        name: '测试销售',
        email: 'sales@example.com',
        role: 'sales',
        permissions: ['sales:view'],
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
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api/handlers/sales-orders/detail', () => ({
  getSalesOrderDetailWithPayments: jest.fn(),
}));

describe('/api/sales-orders/[id]/export（件片重量导出口径回归）', () => {
  const { getSalesOrderDetailWithPayments } = jest.requireMock(
    '@/lib/api/handlers/sales-orders/detail'
  ) as {
    getSalesOrderDetailWithPayments: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('完整导出应输出 x件y片 / 总重量，并优先使用销售单显示字段与重量快照', async () => {
    getSalesOrderDetailWithPayments.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'SO-EXPORT-001',
      customerId: 'customer-1',
      userId: 'user-1',
      status: 'confirmed',
      orderType: 'NORMAL',
      transferMode: 'SUPPLIER_ONLY',
      itemsAmount: 128,
      additionalFees: 0,
      roundingAdjustment: 0,
      totalAmount: 128,
      costAmount: 0,
      profitAmount: 0,
      actualPaidAmount: 0,
      paymentRounding: 0,
      paidAmount: 0,
      remainingAmount: 128,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      shippedAt: '2026-04-16T01:00:00.000Z',
      remarks: '导出回归测试',
      customer: {
        id: 'customer-1',
        name: '测试客户',
        phone: '13800000000',
        address: '天津市南开区',
      },
      user: {
        id: 'user-1',
        name: '测试销售',
      },
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          batchNumber: 'BATCH-001',
          quantity: 13,
          unitPrice: 9.85,
          subtotal: 128,
          isManualProduct: false,
          displayUnit: '件',
          displayQuantity: 1,
          piecesPerUnit: 13,
          weightSnapshot: 20,
          remarks: '按件导出',
          product: {
            id: 'product-1',
            code: 'PROD-001',
            name: '测试砖',
            unit: 'piece',
            specification: '600x1200',
            piecesPerUnit: 13,
            weight: 20,
          },
        },
      ],
      feeItems: [],
      paymentRecords: [],
      returnOrders: [],
      prepaymentUsages: [],
      prepaymentTotalApplied: 0,
    });

    const { POST } = await import('@/app/api/sales-orders/[id]/export/route');

    const response = await POST(
      new Request('http://localhost/api/sales-orders/order-1/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'excel',
          mode: 'complete',
        }),
      }) as any,
      { params: Promise.resolve({ id: 'order-1' }) } as any
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining(['订单摘要', '订单明细'])
    );

    const summaryRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['订单摘要'],
      { defval: '' }
    );
    const detailRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['订单明细'],
      { defval: '' }
    );

    expect(summaryRows[0]).toEqual(
      expect.objectContaining({
        订单号: 'SO-EXPORT-001',
        产品数量: '1件（共13片）',
        '总重量(kg)': 20,
      })
    );

    expect(detailRows[0]).toEqual(
      expect.objectContaining({
        产品名称: '测试砖',
        产品编号: 'PROD-001',
        单位: '件',
        数量: '1件',
        '重量(kg)': 20,
        备注: '按件导出',
      })
    );
  });
});
