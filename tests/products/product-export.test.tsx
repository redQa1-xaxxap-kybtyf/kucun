import { buildProductExportRows } from '@/lib/utils/product-export';

describe('产品导出分类口径', () => {
  test('优先导出完整分类路径，避免层级调整后仍显示旧口径', () => {
    const rows = buildProductExportRows(
      [
        {
          id: 'product-1',
          code: 'P-001',
          name: '柔抛砖',
          unit: 'piece',
          status: 'active',
          categoryId: 'cat-2',
          category: {
            id: 'cat-2',
            name: '柔抛',
            code: 'RP',
          },
          createdAt: '2026-04-17T00:00:00.000Z',
          updatedAt: '2026-04-17T00:00:00.000Z',
        },
      ],
      {
        categoryPathById: new Map([
          ['cat-2', '瓷砖 / 抛光砖 / 柔抛'],
        ]),
      }
    );

    expect(rows[0]).toMatchObject({
      产品编码: 'P-001',
      产品分类: '瓷砖 / 抛光砖 / 柔抛',
      分类编码: 'RP',
    });
  });

  test('没有路径映射时回退到当前分类名称', () => {
    const rows = buildProductExportRows([
      {
        id: 'product-2',
        code: 'P-002',
        name: '通体砖',
        unit: 'piece',
        status: 'active',
        categoryId: 'cat-3',
        category: {
          id: 'cat-3',
          name: '通体砖',
          code: 'TT',
        },
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
    ]);

    expect(rows[0]).toMatchObject({
      产品分类: '通体砖',
      分类编码: 'TT',
    });
  });
});
