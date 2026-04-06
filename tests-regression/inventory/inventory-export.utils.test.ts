import type { Inventory } from '@/lib/types/inventory';
import {
  buildInventoryExportFilename,
  buildInventoryExportRows,
} from '@/lib/utils/inventory-export';

function buildInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: 'inventory-1',
    productId: 'product-1',
    quantity: 100,
    reservedQuantity: 8,
    unitCost: 12.5,
    updatedAt: '2026-04-06T09:30:00.000Z',
    batchPiecesPerUnit: 4,
    weight: 18.6,
    product: {
      id: 'product-1',
      code: 'INV-001',
      name: '测试产品',
      specification: '600x600',
      unit: 'piece',
      piecesPerUnit: 4,
      status: 'active',
      category: {
        id: 'category-1',
        name: '瓷砖',
        code: 'TILE',
      },
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('inventory export utils', () => {
  it('无财务权限时应导出基础库存字段，并将空批次显示为常规', () => {
    const rows = buildInventoryExportRows([
      buildInventory({
        batchNumber: undefined,
        location: 'A-01',
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        产品编码: 'INV-001',
        分类: '瓷砖',
        批次: '常规',
        库位: 'A-01',
        单位: '件',
        '装箱数（片/件）': 4,
        '总库存（片）': 100,
        '可用（片）': 92,
      })
    );
    expect(rows[0]['总库存（件片）']).toBe('100片 (约25件)');
    expect(rows[0]['单位成本']).toBeUndefined();
    expect(rows[0]['库存货值（元）']).toBeUndefined();
  });

  it('有财务权限时应补充成本与货值字段', () => {
    const rows = buildInventoryExportRows(
      [
        buildInventory({
          batchNumber: 'BATCH-001',
          quantity: 101,
          reservedQuantity: 1,
          unitCost: 9.876,
        }),
      ],
      { includeFinance: true }
    );

    expect(rows[0]).toEqual(
      expect.objectContaining({
        批次: 'BATCH-001',
        '总库存（件片）': '101片 (约25件+1片)',
        '预留（件片）': '1片',
        单位成本: 9.876,
        单位成本展示: '￥9.876',
        '库存货值（元）': 997.48,
      })
    );
  });

  it('导出文件名应包含时间戳，避免多次导出互相覆盖', () => {
    expect(buildInventoryExportFilename(new Date(2026, 3, 6, 9, 30, 45))).toBe(
      '库存总览_20260406_093045'
    );
  });
});
