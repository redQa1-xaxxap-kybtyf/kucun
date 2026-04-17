import { buildInventoryExportRows } from '@/lib/utils/inventory-export';

describe('库存导出分类口径', () => {
  test('优先导出完整分类路径，和筛选口径保持一致', () => {
    const rows = buildInventoryExportRows(
      [
        {
          id: 'inventory-1',
          productId: 'product-1',
          quantity: 120,
          reservedQuantity: 20,
          updatedAt: '2026-04-17T00:00:00.000Z',
          product: {
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
        },
      ],
      {
        categoryPathById: new Map([
          ['cat-2', '瓷砖 / 抛光砖 / 柔抛'],
        ]),
      }
    );

    expect(rows[0]).toMatchObject({
      分类: '瓷砖 / 抛光砖 / 柔抛',
      产品编码: 'P-001',
    });
  });

  test('没有路径映射时回退到分类名称', () => {
    const rows = buildInventoryExportRows([
      {
        id: 'inventory-2',
        productId: 'product-2',
        quantity: 20,
        reservedQuantity: 0,
        updatedAt: '2026-04-17T00:00:00.000Z',
        product: {
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
      },
    ]);

    expect(rows[0]).toMatchObject({
      分类: '通体砖',
      产品编码: 'P-002',
    });
  });
});
