import {
  importInitialStockRows,
  validateInitialStockImportRows,
} from '@/lib/api/handlers/initial-stock-import';

jest.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
    supplier: {
      findMany: jest.fn(),
    },
    inboundRecord: {
      findMany: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/api/batch-number-generator', () => ({
  generateBatchNumberOutsideTransaction: jest.fn(
    async (
      _product: { id: string; code: string },
      providedBatchNumber?: string
    ) => providedBatchNumber || 'AUTO-BATCH-001'
  ),
}));

jest.mock('@/lib/api/minimal-inbound-transaction', () => ({
  executeMinimalInboundTransaction: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: {
    product: {
      findMany: jest.Mock;
    };
    supplier: {
      findMany: jest.Mock;
    };
    inboundRecord: {
      findMany: jest.Mock;
    };
    inventory: {
      findMany: jest.Mock;
    };
  };
};

const { executeMinimalInboundTransaction } = jest.requireMock(
  '@/lib/api/minimal-inbound-transaction'
) as {
  executeMinimalInboundTransaction: jest.Mock;
};

describe('initial-stock import handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findMany.mockResolvedValue([]);
    prisma.supplier.findMany.mockResolvedValue([]);
    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);
    executeMinimalInboundTransaction.mockResolvedValue({
      id: 'inbound-1',
    });
  });

  test('支持通过产品名称+规格+色号精确匹配已有产品', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-a',
        code: 'P-A',
        name: '柔光砖',
        specification: '600x1200mm',
        variants: [
          {
            id: 'variant-a1',
            colorCode: 'A01',
            status: 'active',
          },
        ],
      },
      {
        id: 'product-b',
        code: 'P-B',
        name: '柔光砖',
        specification: '600x1200mm',
        variants: [
          {
            id: 'variant-b1',
            colorCode: 'B02',
            status: 'active',
          },
        ],
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: '',
        产品名称: '柔光砖',
        规格: '600x1200mm',
        色号: 'B02',
        批次号: 'INIT-001',
        数量: 12,
        单位成本: 25,
        库位: 'A-01',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.canImport).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(1);
    expect(result.previewRows[0]).toMatchObject({
      productCode: 'P-B',
      colorCode: 'B02',
      matchMethod: '名称+规格+色号',
    });
  });

  test('产品存在多个色号时，未填写色号会报错', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        code: 'P-001',
        name: '抛釉砖',
        specification: '800x800mm',
        variants: [
          {
            id: 'variant-1',
            colorCode: 'A01',
            status: 'active',
          },
          {
            id: 'variant-2',
            colorCode: 'A02',
            status: 'active',
          },
        ],
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-001',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'INIT-002',
        数量: 8,
        单位成本: 30,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.canImport).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({
      field: '色号',
      productCode: 'P-001',
    });
    expect(result.errors[0].message).toContain('存在多个色号');
  });

  test('未填写装箱数时，预览默认使用产品档案中的装箱数', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-ppu',
        code: 'P-PPU',
        name: '柔抛砖',
        specification: '800x800mm',
        piecesPerUnit: 6,
        weight: 28.5,
        variants: [],
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-PPU',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'PPU-001',
        数量: 60,
        单位成本: 18.5,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.previewRows[0]).toMatchObject({
      productCode: 'P-PPU',
      batchNumber: 'PPU-001',
      inputQuantity: 60,
      quantityUnit: '片',
      quantityUnitSource: 'default',
      piecesPerUnit: 6,
      piecesPerUnitSource: 'product',
      weight: 28.5,
      weightSource: 'product',
      quantity: 60,
    });
  });

  test('数量单位为件时，会按装箱数自动换算成片', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-box-convert',
        code: 'P-BOX',
        name: '柔光砖',
        specification: '800x800mm',
        piecesPerUnit: 4,
        weight: 30,
        variants: [],
      },
    ]);

    const previewResult = await validateInitialStockImportRows([
      {
        产品编码: 'P-BOX',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'BOX-115',
        数量: 115,
        数量单位: '件',
        单位成本: 18.5,
        库位: 'A-01',
        备注: '115件应换算为460片',
      },
    ]);

    expect(previewResult.valid).toBe(true);
    expect(previewResult.previewRows[0]).toMatchObject({
      productCode: 'P-BOX',
      inputQuantity: 115,
      quantityUnit: '件',
      quantityUnitSource: 'row',
      piecesPerUnit: 4,
      quantity: 460,
    });

    await importInitialStockRows(
      [
        {
          产品编码: 'P-BOX',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'BOX-115',
          数量: 115,
          数量单位: '件',
          单位成本: 18.5,
          库位: 'A-01',
          备注: '115件应换算为460片',
        },
      ],
      'user-1'
    );

    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-box-convert',
        batchNumber: 'BOX-115',
        quantity: 460,
        unitCost: 18.5,
        openingImportBatchId: expect.stringMatching(/^OBI-\d{8}-\d{6}-[A-F0-9]{4}$/),
      })
    );
  });

  test('同一次导入的多条记录会写入同一个导入批次号', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-same-batch',
        code: 'P-SAME',
        name: '同批次测试砖',
        specification: '600x1200mm',
        piecesPerUnit: 4,
        weight: 28,
        variants: [],
      },
    ]);

    const result = await importInitialStockRows(
      [
        {
          产品编码: 'P-SAME',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'BATCH-A',
          数量: 10,
          数量单位: '件',
          单位成本: 18,
          库位: 'A-01',
          备注: '',
        },
        {
          产品编码: 'P-SAME',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'BATCH-B',
          数量: 20,
          数量单位: '件',
          单位成本: 19,
          库位: 'A-02',
          备注: '',
        },
      ],
      'user-1'
    );

    expect(result.importBatchId).toMatch(/^OBI-\d{8}-\d{6}-[A-F0-9]{4}$/);
    expect(executeMinimalInboundTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        batchNumber: 'BATCH-A',
        openingImportBatchId: result.importBatchId,
      })
    );
    expect(executeMinimalInboundTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        batchNumber: 'BATCH-B',
        openingImportBatchId: result.importBatchId,
      })
    );
  });

  test('数量单位留空时，会兼容旧模板并按片处理', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-legacy-unit',
        code: 'P-LEGACY',
        name: '仿古砖',
        specification: '600x600mm',
        piecesPerUnit: 8,
        weight: 26,
        variants: [],
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-LEGACY',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'LEGACY-01',
        数量: 115,
        单位成本: 12,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.previewRows[0]).toMatchObject({
      inputQuantity: 115,
      quantityUnit: '片',
      quantityUnitSource: 'default',
      piecesPerUnit: 8,
      quantity: 115,
    });
  });

  test('支持使用“单片成本”列名导入，兼容旧模板字段映射', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-piece-cost',
        code: 'P-PIECE-COST',
        name: '柔光砖',
        specification: '800x800mm',
        piecesPerUnit: 4,
        weight: 30,
        variants: [],
      },
    ]);

    const rows = [
      {
        产品编码: 'P-PIECE-COST',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'PIECE-COST-01',
        数量: 10,
        数量单位: '件',
        单片成本: 18.5,
        库位: 'A-09',
        备注: '新模板列名兼容',
      },
    ] as any;

    const previewResult = await validateInitialStockImportRows(rows);

    expect(previewResult.valid).toBe(true);
    expect(previewResult.previewRows[0]).toMatchObject({
      productCode: 'P-PIECE-COST',
      quantity: 40,
      unitCost: 18.5,
    });

    await importInitialStockRows(rows, 'user-1');

    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-piece-cost',
        quantity: 40,
        unitCost: 18.5,
      })
    );
  });

  test('数量单位为件时，如果模板和产品档案都没有装箱数会报错', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-no-ppu',
        code: 'P-NO-PPU',
        name: '岩板',
        specification: '900x1800mm',
        piecesPerUnit: 0,
        weight: null,
        variants: [],
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-NO-PPU',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'NO-PPU-01',
        数量: 12,
        数量单位: '件',
        单位成本: 55,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.canImport).toBe(false);
    expect(result.errors[0]).toMatchObject({
      field: '装箱数',
      productCode: 'P-NO-PPU',
    });
    expect(result.errors[0].message).toContain('数量单位填写“件”时');
  });

  test('填写每件重量和供应商时，预览会带出对应值并校验供应商存在', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-weight-supplier',
        code: 'P-WS',
        name: '轻纹砖',
        specification: '600x1200mm',
        piecesPerUnit: 4,
        weight: 20,
        variants: [],
      },
    ]);
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'supplier-1',
        name: '华南一号供应商',
        supplierCode: 'SUP-001',
        status: 'active',
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-WS',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'WS-001',
        装箱数: 4,
        '每件重量(kg)': 21.25,
        数量: 40,
        单位成本: 15.125,
        供应商: '华南一号供应商',
        库位: 'A-08',
        备注: '带重量和供应商',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.previewRows[0]).toMatchObject({
      productCode: 'P-WS',
      weight: 21.25,
      weightSource: 'row',
      supplierName: '华南一号供应商',
    });
  });

  test('填写不存在的供应商时会报错', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-supplier-error',
        code: 'P-SE',
        name: '亮光砖',
        specification: '750x1500mm',
        piecesPerUnit: 3,
        weight: null,
        variants: [],
      },
    ]);
    prisma.supplier.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-SE',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'SUP-ERR',
        数量: 10,
        单位成本: 18,
        供应商: '不存在供应商',
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.canImport).toBe(false);
    expect(result.errors[0]).toMatchObject({
      field: '供应商',
      productCode: 'P-SE',
    });
    expect(result.errors[0].message).toContain('不存在供应商');
  });

  test('供应商列支持填写供应商编码', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-supplier-code',
        code: 'P-SC',
        name: '柔光大板',
        specification: '900x1800mm',
        piecesPerUnit: 2,
        weight: 36,
        variants: [],
      },
    ]);
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'supplier-code-1',
        name: '编码供应商',
        supplierCode: 'SUP-CODE-01',
        status: 'active',
      },
    ]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-SC',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'SUP-CODE',
        数量: 12,
        单位成本: 22.5,
        供应商: 'SUP-CODE-01',
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.previewRows[0]).toMatchObject({
      supplierName: '编码供应商',
    });
  });

  test('文件内重复和系统已有期初库存会自动跳过，其他行继续导入', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        code: 'P-001',
        name: '仿古砖',
        specification: '600x600mm',
        variants: [],
      },
    ]);

    prisma.inboundRecord.findMany
      .mockResolvedValueOnce([
        {
          productId: 'product-1',
          variantId: null,
          batchNumber: 'B-200',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-001',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'B-100',
        数量: 10,
        单位成本: 20,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-001',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'B-100',
        数量: 5,
        单位成本: 20,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-001',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'B-200',
        数量: 6,
        单位成本: 20,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-001',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'B-300',
        数量: 9,
        单位成本: 20,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.canImport).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.duplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          source: 'file',
        }),
        expect.objectContaining({
          row: 4,
          source: 'opening_balance',
        }),
      ])
    );
    expect(result.previewRows.map(row => row.batchNumber)).toEqual([
      'B-100',
      'B-300',
    ]);
  });

  test('同一产品编码的不同色号、相同批次，可以分别导入', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-2',
        code: 'P-020',
        name: '通体砖',
        specification: '750x1500mm',
        variants: [
          {
            id: 'variant-201',
            colorCode: 'H01',
            status: 'active',
          },
          {
            id: 'variant-202',
            colorCode: 'H02',
            status: 'active',
          },
        ],
      },
    ]);

    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-020',
        产品名称: '',
        规格: '',
        色号: 'H01',
        批次号: 'B-500',
        数量: 20,
        单位成本: 31,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-020',
        产品名称: '',
        规格: '',
        色号: 'H02',
        批次号: 'B-500',
        数量: 18,
        单位成本: 31,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(
      result.previewRows.map(
        row => `${row.productCode}-${row.colorCode}-${row.batchNumber}`
      )
    ).toEqual(['P-020-H01-B-500', 'P-020-H02-B-500']);
  });

  test('同一产品编码、同一色号、不同批次，需要拆成多行且都可导入', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-3',
        code: 'P-030',
        name: '岩板',
        specification: '1200x2400mm',
        variants: [
          {
            id: 'variant-301',
            colorCode: 'Y09',
            status: 'active',
          },
        ],
      },
    ]);

    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-030',
        产品名称: '',
        规格: '',
        色号: 'Y09',
        批次号: 'LOT-01',
        数量: 6,
        单位成本: 99,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-030',
        产品名称: '',
        规格: '',
        色号: 'Y09',
        批次号: 'LOT-02',
        数量: 7,
        单位成本: 101,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.previewRows.map(row => row.batchNumber)).toEqual([
      'LOT-01',
      'LOT-02',
    ]);
  });

  test('系统已有同批次期初库存时，只跳过对应色号，不影响其他色号继续导入', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-4',
        code: 'P-040',
        name: '木纹砖',
        specification: '200x1200mm',
        variants: [
          {
            id: 'variant-401',
            colorCode: 'M01',
            status: 'active',
          },
          {
            id: 'variant-402',
            colorCode: 'M02',
            status: 'active',
          },
        ],
      },
    ]);

    prisma.inboundRecord.findMany
      .mockResolvedValueOnce([
        {
          productId: 'product-4',
          variantId: 'variant-401',
          batchNumber: 'EXIST-01',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-040',
        产品名称: '',
        规格: '',
        色号: 'M01',
        批次号: 'EXIST-01',
        数量: 11,
        单位成本: 15,
        库位: '',
        备注: '',
      },
      {
        产品编码: 'P-040',
        产品名称: '',
        规格: '',
        色号: 'M02',
        批次号: 'EXIST-01',
        数量: 12,
        单位成本: 15,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.canImport).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates[0]).toMatchObject({
      source: 'opening_balance',
      productCode: 'P-040',
      batchNumber: 'EXIST-01',
    });
    expect(result.previewRows[0]).toMatchObject({
      productCode: 'P-040',
      colorCode: 'M02',
      batchNumber: 'EXIST-01',
    });
  });

  test('正式导入会带上自动识别的唯一色号和库位，并跳过错误行', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        code: 'P-008',
        name: '大板',
        specification: '900x1800mm',
        piecesPerUnit: 1,
        weight: 30,
        variants: [
          {
            id: 'variant-8',
            colorCode: 'C88',
            status: 'active',
          },
        ],
      },
    ]);
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'supplier-opening-a',
        name: '期初供应商A',
        supplierCode: 'SUP-OPENING-A',
        status: 'active',
      },
    ]);

    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await importInitialStockRows(
      [
        {
          产品编码: 'P-008',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'INIT-888',
          '每件重量(kg)': 31.5,
          数量: 20,
          单位成本: 66.5,
          供应商: '期初供应商A',
          库位: 'B-02',
          备注: '首批期初',
        },
        {
          产品编码: '',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'BAD-001',
          数量: 3,
          单位成本: 10,
          库位: '',
          备注: '',
        },
      ],
      'user-1'
    );

    expect(result.importedCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(executeMinimalInboundTransaction).toHaveBeenCalledTimes(1);
    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        variantId: 'variant-8',
        batchNumber: 'INIT-888',
        quantity: 20,
        unitCost: 66.5,
        weight: 31.5,
        supplierId: 'supplier-opening-a',
        location: 'B-02',
        remarks: '首批期初',
        userId: 'user-1',
      })
    );
  });

  test('填写装箱数且与产品档案不一致时，会作为批次装箱数传入正式导入', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-ppu-override',
        code: 'P-108',
        name: '通体大板',
        specification: '900x1800mm',
        piecesPerUnit: 4,
        variants: [],
      },
    ]);

    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    await importInitialStockRows(
      [
        {
          产品编码: 'P-108',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'PPU-OVERRIDE',
          装箱数: 8,
          数量: 80,
          单位成本: 45.125,
          库位: 'C-01',
          备注: '批次装箱数调整',
        },
      ],
      'user-1'
    );

    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-ppu-override',
        batchNumber: 'PPU-OVERRIDE',
        piecesPerUnit: 8,
        quantity: 80,
        unitCost: 45.125,
      })
    );
  });

  test('只填写每件重量时，会同时带上产品档案装箱数写入批次规格', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-weight-only',
        code: 'P-WEIGHT',
        name: '仿石砖',
        specification: '600x600mm',
        piecesPerUnit: 6,
        weight: 29,
        variants: [],
      },
    ]);
    prisma.supplier.findMany.mockResolvedValue([]);
    prisma.inboundRecord.findMany.mockResolvedValue([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    await importInitialStockRows(
      [
        {
          产品编码: 'P-WEIGHT',
          产品名称: '',
          规格: '',
          色号: '',
          批次号: 'WEIGHT-ONLY',
          '每件重量(kg)': 30.25,
          数量: 60,
          单位成本: 19.888,
          库位: 'D-01',
          备注: '只改单批次重量',
        },
      ],
      'user-1'
    );

    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-weight-only',
        batchNumber: 'WEIGHT-ONLY',
        piecesPerUnit: 6,
        weight: 30.25,
      })
    );
  });

  test('详细导入测试：多色号、多批次、重复跳过和缺失产品可同时得到正确结果', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-5',
        code: 'P-050',
        name: '地砖',
        specification: '800x800mm',
        variants: [
          {
            id: 'variant-501',
            colorCode: 'D01',
            status: 'active',
          },
          {
            id: 'variant-502',
            colorCode: 'D02',
            status: 'active',
          },
        ],
      },
      {
        id: 'product-6',
        code: 'P-060',
        name: '墙砖',
        specification: '300x600mm',
        variants: [],
      },
    ]);

    prisma.inboundRecord.findMany
      .mockResolvedValueOnce([
        {
          productId: 'product-5',
          variantId: 'variant-501',
          batchNumber: 'OLD-01',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const result = await validateInitialStockImportRows([
      {
        产品编码: 'P-050',
        产品名称: '',
        规格: '',
        色号: 'D01',
        批次号: 'NEW-01',
        数量: 10,
        单位成本: 20,
        库位: 'A-01',
        备注: '',
      },
      {
        产品编码: 'P-050',
        产品名称: '',
        规格: '',
        色号: 'D02',
        批次号: 'NEW-01',
        数量: 11,
        单位成本: 20,
        库位: 'A-02',
        备注: '',
      },
      {
        产品编码: 'P-050',
        产品名称: '',
        规格: '',
        色号: 'D01',
        批次号: 'OLD-01',
        数量: 9,
        单位成本: 20,
        库位: 'A-03',
        备注: '',
      },
      {
        产品编码: 'P-060',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'BASIC-01',
        数量: 30,
        单位成本: 9.5,
        库位: 'B-01',
        备注: '',
      },
      {
        产品编码: 'P-060',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'BASIC-01',
        数量: 31,
        单位成本: 9.5,
        库位: 'B-02',
        备注: '',
      },
      {
        产品编码: 'P-NOT-FOUND',
        产品名称: '',
        规格: '',
        色号: '',
        批次号: 'ERR-01',
        数量: 5,
        单位成本: 8,
        库位: '',
        备注: '',
      },
    ]);

    expect(result.totalCount).toBe(6);
    expect(result.valid).toBe(false);
    expect(result.canImport).toBe(true);
    expect(result.validCount).toBe(3);
    expect(result.duplicateCount).toBe(2);
    expect(result.errorCount).toBe(1);
    expect(
      result.previewRows.map(
        row =>
          `${row.productCode}-${row.colorCode ?? 'default'}-${row.batchNumber}`
      )
    ).toEqual([
      'P-050-D01-NEW-01',
      'P-050-D02-NEW-01',
      'P-060-default-BASIC-01',
    ]);
    expect(result.duplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 4,
          source: 'opening_balance',
        }),
        expect.objectContaining({
          row: 6,
          source: 'file',
        }),
      ])
    );
    expect(result.errors[0]).toMatchObject({
      row: 7,
      field: '产品编码',
      productCode: 'P-NOT-FOUND',
    });
  });
});
