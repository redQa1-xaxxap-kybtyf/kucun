jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any) => async (request: any, context?: any) =>
    handler(request, {
      ...(context ?? {}),
      user: {
        id: 'test-user',
        role: 'admin',
        permissions: ['products:create'],
      },
    }),
}));

jest.mock('@/lib/cache', () => ({
  revalidateProducts: jest.fn(async () => undefined),
}));

jest.mock('@/lib/api/handlers/product-import', () => ({
  validateProductImportRows: jest.fn(),
  importProductsFromRows: jest.fn(),
}));

jest.mock('xlsx', () => {
  const actual = jest.requireActual('xlsx');

  return {
    ...actual,
    read: jest.fn(() => ({
      SheetNames: ['产品'],
      Sheets: {
        产品: {},
      },
    })),
    utils: {
      ...actual.utils,
      sheet_to_json: jest.fn(() => []),
    },
  };
});

import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';

import {
  importProductsFromRows,
  validateProductImportRows,
} from '@/lib/api/handlers/product-import';
import { revalidateProducts } from '@/lib/cache';

function createMultipartRequest(mode: 'dry-run' | 'import') {
  return {
    headers: new Headers({
      'content-type': 'multipart/form-data; boundary=test',
    }),
    formData: async () => ({
      get: (key: string) => {
        if (key === 'file') {
          return {
            arrayBuffer: async () => Buffer.from('mock-excel-buffer'),
          };
        }

        if (key === 'mode') {
          return mode;
        }

        return null;
      },
    }),
  } as any;
}

describe('/api/products/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/products/import/template：应返回 Excel 模板', async () => {
    const { GET } = await import('@/app/api/products/import/template/route');
    const response = await GET(
      new Request('http://localhost/api/products/import/template') as any
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('content-disposition')).toContain(
      encodeURIComponent('产品基础信息导入模板.xlsx')
    );
  });

  test('POST /api/products/import：dry-run 应调用预校验逻辑', async () => {
    (validateProductImportRows as jest.Mock).mockResolvedValue({
      valid: true,
      totalCount: 1,
      validCount: 1,
      duplicateCount: 0,
      errorCount: 0,
      previewRows: [],
      duplicates: [],
      errors: [],
    });
    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValueOnce([
      {
        产品编码: 'P-001',
        产品名称: '抛光砖',
        规格: '800x800mm',
      },
    ]);

    const { POST } = await import('@/app/api/products/import/route');
    const response = await POST(createMultipartRequest('dry-run'));

    expect(validateProductImportRows).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          产品编码: 'P-001',
          产品名称: '抛光砖',
        }),
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        message: '导入校验完成',
      })
    );
  });

  test('POST /api/products/import：正式导入成功后应触发产品缓存刷新', async () => {
    (importProductsFromRows as jest.Mock).mockResolvedValue({
      valid: true,
      totalCount: 1,
      validCount: 1,
      duplicateCount: 0,
      errorCount: 0,
      previewRows: [],
      duplicates: [],
      errors: [],
      importedCount: 1,
      importedProducts: [
        {
          id: 'product-1',
          code: 'P-009',
          name: '通体砖',
          status: 'active',
        },
      ],
    });
    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValueOnce([
      {
        产品编码: 'P-009',
        产品名称: '通体砖',
        规格: '750x1500mm',
      },
    ]);

    const { POST } = await import('@/app/api/products/import/route');
    const response = await POST(createMultipartRequest('import'));

    expect(importProductsFromRows).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/products', 'page');
    expect(revalidateProducts).toHaveBeenCalled();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe('成功导入 1 个产品');
  });

  test('POST /api/products/import：重复编码应继续导入并返回重复信息', async () => {
    (importProductsFromRows as jest.Mock).mockResolvedValue({
      valid: true,
      totalCount: 2,
      validCount: 1,
      duplicateCount: 1,
      errorCount: 0,
      previewRows: [],
      duplicates: [
        {
          row: 2,
          productCode: 'P-EXISTING',
          source: 'system',
          message: '产品编码已存在，导入时将自动跳过',
        },
      ],
      errors: [],
      importedCount: 1,
      importedProducts: [
        {
          id: 'product-2',
          code: 'P-NEW',
          name: '新产品',
          status: 'active',
        },
      ],
    });
    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValueOnce([
      {
        产品编码: 'P-EXISTING',
        产品名称: '已存在产品',
        规格: '600x600mm',
      },
      {
        产品编码: 'P-NEW',
        产品名称: '新产品',
        规格: '800x800mm',
      },
    ]);

    const { POST } = await import('@/app/api/products/import/route');
    const response = await POST(createMultipartRequest('import'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe('成功导入 1 个产品，跳过 1 个重复编码');
    expect(body.data.duplicates).toEqual([
      expect.objectContaining({
        productCode: 'P-EXISTING',
        source: 'system',
      }),
    ]);
  });
});
