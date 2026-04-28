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
    systemSetting: {
      findMany: jest.fn(),
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
      systemSetting: {
        findMany: jest.Mock;
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
    prisma.systemSetting.findMany.mockResolvedValue([
      { key: 'companyName', value: '华北建材有限公司' },
      { key: 'companyAddress', value: '天津市河西区解放南路 66 号' },
      { key: 'companyPhone', value: '022-66668888' },
    ]);
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
          displayQuantity: 2,
          piecesPerUnit: 6,
          unitPrice: 73.333,
          subtotal: 880,
          batchNumber: 'LOT-001',
          remarks: '靠窗摆放',
          weightSnapshot: 24.5,
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
      company: {
        name: '华北建材有限公司',
        address: '天津市河西区解放南路 66 号',
        phone: '022-66668888',
        fax: '',
      },
      totalQuantity: '2件（共12片）',
      totalWeight: 49,
      totalWeightKg: 49,
    });
    expect(data?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '柔光砖',
          code: 'P-600',
          spec: '600x1200',
          unit: '件',
          quantity: '2件',
          itemWeightKg: 49,
          weight: 49,
          boxes: 2,
          productName: '柔光砖',
          productCode: 'P-600',
          specification: '600x1200',
          batchNumber: 'LOT-001',
          remark: '靠窗摆放',
        }),
      ])
    );
  });

  test('采购订单打印数据应提供单品种重量和总重量字段', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      orderNumber: 'PO-2026-0015',
      createdAt: new Date('2026-03-26T08:00:00.000Z'),
      status: 'confirmed',
      remarks: '优先整柜',
      totalAmount: 5120,
      supplier: {
        name: '佛山供应商',
        phone: '0757-12345678',
        address: '佛山市南海区',
        supplierCode: 'SUP-015',
      },
      user: {
        name: '采购李四',
      },
      items: [
        {
          quantity: 8,
          unitPrice: 640,
          totalPrice: 5120,
          batchNumber: 'PO-LOT-01',
          remarks: '靠前装柜',
          manualWeight: 12.5,
          weight: null,
          piecesPerUnit: 4,
          manualProductName: null,
          manualSpecification: null,
          manualUnit: null,
          displayName: null,
          productCode: null,
          specification: null,
          supplier: null,
          product: {
            name: '岩板',
            code: 'YB-900',
            specification: '900x1800',
            unit: 'piece',
            piecesPerUnit: 4,
          },
        },
      ],
    });

    const { getPrintDataForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const data = await getPrintDataForTemplate('purchase-order', 'order-2');

    expect(data).toMatchObject({
      order: {
        orderNumber: 'PO-2026-0015',
      },
      supplier: {
        name: '佛山供应商',
      },
      totalWeight: 100,
      totalWeightKg: 100,
    });
    expect(data?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '岩板',
          code: 'YB-900',
          itemWeightKg: 100,
          weight: 100,
          batchNumber: 'PO-LOT-01',
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
        piecesPerUnit: 4,
        weight: 20,
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
      totalWeight: 200,
      totalWeightKg: 200,
      items: [
        expect.objectContaining({
          name: '木纹砖 - M01 · 暖灰',
          code: 'P-900',
          quantity: 40,
          unitPrice: 18.125,
          subtotal: 725,
          itemWeightKg: 200,
          weight: 200,
          batchNumber: 'OUT-01',
        }),
      ],
    });
  });

  test('入库打印数据应优先使用批次重量计算单品种重量和总重量', async () => {
    prisma.inboundRecord.findUnique.mockResolvedValue({
      recordNumber: 'RK-2026-0008',
      createdAt: new Date('2026-03-24T11:00:00.000Z'),
      quantity: 32,
      location: 'A-01-02',
      reason: 'purchase',
      remarks: '码放整齐',
      supplier: {
        name: '佛山鸿瑞',
        phone: '0757-00001111',
        address: '佛山南海',
        supplierCode: 'SUP-008',
      },
      user: {
        name: '仓管王五',
      },
      variant: {
        colorCode: 'G01',
      },
      batchNumber: 'IN-LOT-01',
      batchSpecification: {
        batchNumber: 'IN-LOT-01',
        piecesPerUnit: 8,
        weight: 24,
      },
      product: {
        code: 'P-800',
        name: '通体砖',
        specification: '800x800',
        unit: 'sheet',
        piecesPerUnit: 6,
        weight: 18,
      },
    });

    const { getPrintDataForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const data = await getPrintDataForTemplate('inbound-record', 'RK-2026-0008');

    expect(data).toMatchObject({
      order: {
        orderNumber: 'RK-2026-0008',
        location: 'A-01-02',
      },
      supplier: {
        name: '佛山鸿瑞',
      },
      totalWeight: 96,
      totalWeightKg: 96,
      items: [
        expect.objectContaining({
          code: 'P-800',
          itemWeightKg: 96,
          weight: 96,
          batchNumber: 'IN-LOT-01',
        }),
      ],
    });
  });

  test('退货打印数据应提供单品种重量和总重量字段', async () => {
    prisma.returnOrder.findUnique.mockResolvedValue({
      returnNumber: 'RT-2026-0003',
      createdAt: new Date('2026-03-24T12:00:00.000Z'),
      status: 'pending',
      type: 'quality',
      processType: 'refund',
      reason: '破损退货',
      remarks: '客户要求退款',
      totalAmount: 1260,
      refundAmount: 1260,
      customer: {
        name: '石家庄客户',
        phone: '0311-00001111',
        address: '石家庄裕华区',
      },
      user: {
        name: '售后赵六',
      },
      salesOrder: {
        orderNumber: 'SO-2026-0102',
      },
      items: [
        {
          returnQuantity: 8,
          damagedQuantity: 2,
          originalQuantity: 40,
          unitPrice: 157.5,
          subtotal: 1260,
          reason: '边角破损',
          colorCode: 'B01',
          product: {
            name: '仿古砖',
            code: 'FG-800',
            specification: '800x800',
            unit: 'sheet',
            piecesPerUnit: 4,
            weight: 12,
          },
          salesOrderItem: {
            displayUnit: 'sheet',
            manualUnit: null,
            piecesPerUnit: 4,
            batchNumber: 'RT-LOT-01',
            weightSnapshot: 18,
          },
        },
      ],
    });

    const { getPrintDataForTemplate } = await import(
      '@/lib/print-designer/actions/preview-data'
    );
    const data = await getPrintDataForTemplate('return-order', 'order-3');

    expect(data).toMatchObject({
      order: {
        orderNumber: 'RT-2026-0003',
      },
      salesOrder: {
        orderNumber: 'SO-2026-0102',
      },
      totalWeight: 36,
      totalWeightKg: 36,
      items: [
        expect.objectContaining({
          code: 'FG-800',
          itemWeightKg: 36,
          weight: 36,
          batchNumber: 'RT-LOT-01',
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
