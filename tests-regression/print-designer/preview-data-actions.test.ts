jest.mock('@/lib/print-designer/actions/auth', () => ({
  getAuthUser: jest.fn(async () => ({
    id: 'user-1',
    role: 'admin',
  })),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      findUnique: jest.fn(),
    },
    outboundRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inboundRecord: {
      findUnique: jest.fn(),
    },
    returnOrder: {
      findUnique: jest.fn(),
    },
    purchaseOrder: {
      findUnique: jest.fn(),
    },
    factoryShipmentOrder: {
      findUnique: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
  },
}));

describe('preview-data server actions', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      customer: {
        findMany: jest.Mock;
      };
      factoryShipmentOrder: {
        findUnique: jest.Mock;
      };
      inboundRecord: {
        findUnique: jest.Mock;
      };
      outboundRecord: {
        findMany: jest.Mock;
        findUnique: jest.Mock;
      };
      purchaseOrder: {
        findUnique: jest.Mock;
      };
      returnOrder: {
        findUnique: jest.Mock;
      };
      salesOrder: {
        findUnique: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('销售订单打印数据应优先带出真实商品字段与旧模板兼容字段', async () => {
    prisma.salesOrder.findUnique.mockResolvedValue({
      orderNumber: 'SO-2026-0088',
      createdAt: new Date('2026-03-24T08:00:00.000Z'),
      status: 'confirmed',
      remarks: '客户催单',
      totalAmount: 880,
      customer: {
        name: '天津客户',
        phone: '13800000000',
        address: '天津市河西区',
      },
      user: {
        name: '销售张三',
      },
      items: [
        {
          quantity: 12,
          unitPrice: 73.333,
          subtotal: 880,
          batchNumber: 'LOT-001',
          remarks: '靠窗摆放',
          manualWeight: 24.5,
          manualProductName: null,
          manualSpecification: null,
          manualUnit: null,
          displayUnit: 'piece',
          productCode: null,
          specification: null,
          product: {
            name: '柔光砖',
            code: 'P-600',
            specification: '600x1200',
            unit: 'sheet',
          },
        },
      ],
    });

    const { getPrintDataForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const data = await getPrintDataForTemplate('sales-order', 'order-1');

    expect(data).toMatchObject({
      order: {
        orderNumber: 'SO-2026-0088',
        remark: '客户催单',
      },
      customer: {
        name: '天津客户',
      },
      totalQuantity: 12,
    });
    expect(data?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '柔光砖',
          code: 'P-600',
          spec: '600x1200',
          unit: '件',
          productName: '柔光砖',
          productCode: 'P-600',
          specification: '600x1200',
          batchNumber: 'LOT-001',
          remark: '靠窗摆放',
        }),
      ])
    );
  });

  test('出库发货打印数据应使用 recordNumber 查询，并回退销售订单客户信息', async () => {
    prisma.outboundRecord.findUnique.mockResolvedValue({
      recordNumber: 'CK-2026-0012',
      createdAt: new Date('2026-03-24T09:00:00.000Z'),
      quantity: 40,
      unitCost: 18.125,
      totalCost: 725,
      reason: 'sale',
      notes: '送货上门',
      batchNumber: 'OUT-01',
      product: {
        name: '木纹砖',
        code: 'P-900',
        specification: '900x1800',
        unit: 'sheet',
      },
      variant: {
        colorCode: 'M01',
        colorName: '暖灰',
      },
      customer: null,
      operator: {
        name: '仓管李四',
      },
      salesOrder: {
        orderNumber: 'SO-2026-0009',
        customer: {
          name: '上海客户',
          phone: '13900000000',
          address: '上海市浦东新区',
        },
      },
    });

    const { getPrintDataForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const data = await getPrintDataForTemplate('delivery-note', 'CK-2026-0012');

    expect(data).toMatchObject({
      order: {
        orderNumber: 'CK-2026-0012',
        sourceOrderNumber: 'SO-2026-0009',
        remark: '送货上门',
      },
      customer: {
        name: '上海客户',
      },
      items: [
        expect.objectContaining({
          name: '木纹砖 - M01 · 暖灰',
          code: 'P-900',
          quantity: 40,
          unitPrice: 18.125,
          subtotal: 725,
          batchNumber: 'OUT-01',
        }),
      ],
    });
  });

  test('最近打印单据列表应返回出库记录可直接用于业务侧预览选择', async () => {
    prisma.outboundRecord.findMany.mockResolvedValue([
      {
        recordNumber: 'CK-2026-0101',
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        customer: {
          name: '杭州客户',
        },
        salesOrder: null,
        product: {
          name: '仿古砖',
        },
      },
    ]);

    const { getRecentDocumentsForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const documents = await getRecentDocumentsForTemplate('delivery-note', 5);

    expect(documents).toEqual([
      {
        id: 'CK-2026-0101',
        label: 'CK-2026-0101',
        secondary: '杭州客户',
        description: '出库于 2026-03-24',
      },
    ]);
  });
});
