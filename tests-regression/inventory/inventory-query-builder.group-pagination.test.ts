/**
 * 库存查询构建器回归测试
 * 锁定“按产品编码分组分页，组内批次不可被拆页”的场景。
 */

const queryRawMock = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

jest.mock('@/lib/env', () => ({
  inventoryConfig: {
    lowStockThreshold: 10,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

function extractSql(callArgs: unknown[]): string {
  const [firstArg] = callArgs;

  if (Array.isArray(firstArg)) {
    return firstArg.join(' ');
  }

  if (
    firstArg &&
    typeof firstArg === 'object' &&
    'sql' in firstArg &&
    typeof (firstArg as { sql?: unknown }).sql === 'string'
  ) {
    return (firstArg as { sql: string }).sql;
  }

  return String(firstArg ?? '');
}

function collectEmbeddedSqlFragments(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => collectEmbeddedSqlFragments(item));
  }

  if (typeof value === 'object') {
    const fragments: string[] = [];
    const maybeSql = value as { sql?: unknown; values?: unknown[] };

    if (typeof maybeSql.sql === 'string') {
      fragments.push(maybeSql.sql);
    }

    if (Array.isArray(maybeSql.values)) {
      fragments.push(
        ...maybeSql.values.flatMap(item => collectEmbeddedSqlFragments(item))
      );
    }

    return fragments;
  }

  return [];
}

describe('inventory-query-builder grouped pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应先按产品分页，再返回当前页产品下的全部批次', async () => {
    queryRawMock
      .mockResolvedValueOnce([
        {
          product_id: 'product-1',
          product_code: 'P-001',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inventory-1',
          productId: 'product-1',
          batchNumber: 'BATCH-A',
          quantity: 120,
          reservedQuantity: 20,
          location: 'A-01',
          unitCost: 12.5,
          updatedAt: new Date('2026-04-05T10:00:00.000Z'),
          product_id: 'product-1',
          product_code: 'P-001',
          product_name: '产品一',
          specification_size: '36M06#',
          product_unit: 'unit',
          product_piecesPerUnit: 13,
          product_weight: 18.6,
          product_thumbnailUrl: null,
          batch_piecesPerUnit: 13,
          batch_weight: 18.6,
          product_status: 'active',
          category_id: null,
          category_name: null,
          category_code: null,
        },
        {
          id: 'inventory-2',
          productId: 'product-1',
          batchNumber: 'BATCH-B',
          quantity: 80,
          reservedQuantity: 0,
          location: 'A-02',
          unitCost: 12.5,
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          product_id: 'product-1',
          product_code: 'P-001',
          product_name: '产品一',
          specification_size: '36M06#',
          product_unit: 'unit',
          product_piecesPerUnit: 13,
          product_weight: 18.6,
          product_thumbnailUrl: null,
          batch_piecesPerUnit: 13,
          batch_weight: 18.6,
          product_status: 'active',
          category_id: null,
          category_name: null,
          category_code: null,
        },
      ]);

    const { getOptimizedInventoryList } = await import(
      '@/lib/api/inventory-query-builder'
    );

    const result = await getOptimizedInventoryList({
      page: 1,
      limit: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(result).toHaveLength(2);
    expect(result.map(item => item.batchNumber)).toEqual([
      'BATCH-A',
      'BATCH-B',
    ]);
    expect(queryRawMock).toHaveBeenCalledTimes(2);

    const groupPageSql = extractSql(queryRawMock.mock.calls[0]);
    expect(groupPageSql).toContain('GROUP BY i.product_id, p.code');
    expect(groupPageSql).toContain('LIMIT');
    expect(groupPageSql).toContain('OFFSET');

    const rowFetchSql = extractSql(queryRawMock.mock.calls[1]);
    expect(rowFetchSql).toContain('i.product_id IN');
    const rowFetchSqlFragments = collectEmbeddedSqlFragments(
      queryRawMock.mock.calls[1]
    );
    expect(
      rowFetchSqlFragments.some(fragment =>
        fragment.includes('FIELD(i.product_id,')
      )
    ).toBe(true);
  });

  it('库存总数应按产品分组计数，而不是按库存记录计数', async () => {
    queryRawMock.mockResolvedValueOnce([{ count: BigInt(3) }]);

    const { getInventoryCount } = await import(
      '@/lib/api/inventory-query-builder'
    );

    const total = await getInventoryCount({
      page: 1,
      limit: 20,
    });

    expect(total).toBe(3);
    expect(queryRawMock).toHaveBeenCalledTimes(1);

    const countSql = extractSql(queryRawMock.mock.calls[0]);
    expect(countSql).toContain('COUNT(DISTINCT i.product_id)');
  });

  it('搜索并筛选仅看有库存时，仍应返回同一产品下的全部有库存批次', async () => {
    queryRawMock
      .mockResolvedValueOnce([
        {
          product_id: 'product-2',
          product_code: 'RET-rr-416972',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inventory-3',
          productId: 'product-2',
          batchNumber: null,
          quantity: 3,
          reservedQuantity: 0,
          location: 'B-01',
          unitCost: 9.8,
          updatedAt: new Date('2026-04-05T12:00:00.000Z'),
          product_id: 'product-2',
          product_code: 'RET-rr-416972',
          product_name: '退货回流产品',
          specification_size: '600x600',
          product_unit: 'sheet',
          product_piecesPerUnit: 4,
          product_weight: 18.6,
          product_thumbnailUrl: null,
          batch_piecesPerUnit: 4,
          batch_weight: 18.6,
          product_status: 'active',
          category_id: null,
          category_name: null,
          category_code: null,
        },
        {
          id: 'inventory-4',
          productId: 'product-2',
          batchNumber: 'BATCH-rr-0611',
          quantity: 40,
          reservedQuantity: 0,
          location: 'B-02',
          unitCost: 9.8,
          updatedAt: new Date('2026-04-05T11:00:00.000Z'),
          product_id: 'product-2',
          product_code: 'RET-rr-416972',
          product_name: '退货回流产品',
          specification_size: '600x600',
          product_unit: 'sheet',
          product_piecesPerUnit: 4,
          product_weight: 18.6,
          product_thumbnailUrl: null,
          batch_piecesPerUnit: 4,
          batch_weight: 18.6,
          product_status: 'active',
          category_id: null,
          category_name: null,
          category_code: null,
        },
      ]);

    const { getOptimizedInventoryList } = await import(
      '@/lib/api/inventory-query-builder'
    );

    const result = await getOptimizedInventoryList({
      page: 1,
      limit: 1,
      search: 'RET-rr-416972',
      hasStock: true,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(result).toHaveLength(2);
    expect(result.map(item => item.batchNumber)).toEqual([
      null,
      'BATCH-rr-0611',
    ]);

    const groupPageSql = extractSql(queryRawMock.mock.calls[0]);
    expect(groupPageSql).toContain('GROUP BY i.product_id, p.code');

    const filterSqlFragments = collectEmbeddedSqlFragments(queryRawMock.mock.calls[0]);
    expect(
      filterSqlFragments.some(fragment =>
        fragment.includes('CASE WHEN i.quantity - i.reserved_quantity < 0 THEN 0 ELSE i.quantity - i.reserved_quantity END')
      )
    ).toBe(true);
  });
});
