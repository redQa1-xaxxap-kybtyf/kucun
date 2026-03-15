const prismaMock = {
  product: {
    findMany: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const createProductRecordInTransaction = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

jest.mock('@/lib/api/handlers/product-create', () => ({
  createProductRecordInTransaction: (...args: unknown[]) =>
    createProductRecordInTransaction(...args),
  mapCreatedProductsSummary: (products: Array<any>) =>
    products.map(product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification ?? undefined,
      status: product.status,
    })),
}));

import {
  importProductsFromRows,
  validateProductImportRows,
} from '@/lib/api/handlers/product-import';

describe('product import handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async callback => callback({}));
  });

  test('validateProductImportRows: 有效数据应通过预校验', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        code: 'tile-polished',
        name: '抛光砖',
        status: 'active',
      },
    ]);

    const result = await validateProductImportRows([
      {
        产品编码: 'P-001',
        产品名称: '抛光砖',
        规格: '800x800mm',
        分类编码: 'tile-polished',
        '厚度(mm)': 10,
        状态: '启用',
        描述: '测试导入',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.duplicateCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.previewRows).toEqual([
      expect.objectContaining({
        row: 2,
        code: 'P-001',
        categoryName: '抛光砖',
        status: 'active',
      }),
    ]);
  });

  test('validateProductImportRows: 同文件重复编码应跳过重复并保留告警', async () => {
    const result = await validateProductImportRows([
      {
        产品编码: 'P-001',
        产品名称: '产品A',
        规格: '600x600mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
      {
        产品编码: 'P-001',
        产品名称: '产品B',
        规格: '800x800mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        row: 3,
        source: 'file',
        message: expect.stringContaining('第 2 行重复'),
      }),
    ]);
  });

  test('validateProductImportRows: 系统已存在编码应标记为重复并继续导入其他行', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ code: 'P-EXISTING' }]);

    const result = await validateProductImportRows([
      {
        产品编码: 'P-EXISTING',
        产品名称: '已存在产品',
        规格: '600x600mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
      {
        产品编码: 'P-NEW',
        产品名称: '新产品',
        规格: '800x800mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        row: 2,
        productCode: 'P-EXISTING',
        source: 'system',
      }),
    ]);
  });

  test('validateProductImportRows: 分类停用时应阻止导入', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      {
        id: 'cat-2',
        code: 'tile-inactive',
        name: '已停用分类',
        status: 'inactive',
      },
    ]);

    const result = await validateProductImportRows([
      {
        产品编码: 'P-002',
        产品名称: '仿古砖',
        规格: '600x1200mm',
        分类编码: 'tile-inactive',
        '厚度(mm)': '',
        状态: 'active',
        描述: '',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.duplicateCount).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        row: 2,
        field: '分类编码',
        message: '分类已停用，不能导入到该分类',
      }),
    ]);
  });

  test('importProductsFromRows: 校验通过后应在事务中创建产品', async () => {
    createProductRecordInTransaction.mockResolvedValue({
      id: 'product-1',
      code: 'P-003',
      name: '通体砖',
      specification: '750x1500mm',
      status: 'active',
    });

    const result = await importProductsFromRows([
      {
        产品编码: 'P-003',
        产品名称: '通体砖',
        规格: '750x1500mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: 'active',
        描述: '',
      },
    ]);

    expect(createProductRecordInTransaction).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
    expect(result.importedCount).toBe(1);
    expect(result.importedProducts).toEqual([
      expect.objectContaining({
        id: 'product-1',
        code: 'P-003',
      }),
    ]);
  });

  test('importProductsFromRows: 遇到重复编码时应跳过重复并继续导入', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ code: 'P-EXISTING' }]);
    createProductRecordInTransaction.mockResolvedValue({
      id: 'product-2',
      code: 'P-NEW',
      name: '新产品',
      specification: '800x800mm',
      status: 'active',
    });

    const result = await importProductsFromRows([
      {
        产品编码: 'P-EXISTING',
        产品名称: '已存在产品',
        规格: '600x600mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
      {
        产品编码: 'P-NEW',
        产品名称: '新产品',
        规格: '800x800mm',
        分类编码: '',
        '厚度(mm)': '',
        状态: '',
        描述: '',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.importedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        productCode: 'P-EXISTING',
        source: 'system',
      }),
    ]);
    expect(createProductRecordInTransaction).toHaveBeenCalledTimes(1);
    expect(result.importedProducts).toEqual([
      expect.objectContaining({
        id: 'product-2',
        code: 'P-NEW',
      }),
    ]);
  });
});
