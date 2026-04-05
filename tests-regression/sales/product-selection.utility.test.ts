import type { Product } from '@/lib/types/product';
import { mergeProductsById } from '@/lib/utils/product-selection';

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    code: 'P-001',
    name: '测试产品',
    unit: 'piece',
    piecesPerUnit: 4,
    status: 'active',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    inventory: {
      totalQuantity: 100,
      reservedQuantity: 0,
      availableQuantity: 100,
      batches: [],
    },
    ...overrides,
  };
}

describe('product-selection utility', () => {
  test('应把搜索选中的产品补进当前表单产品池，避免后续显示未知编码', () => {
    const baseProducts = [createProduct()];
    const searchedProduct = createProduct({
      id: 'product-2',
      code: 'P-002',
      name: '搜索命中产品',
    });

    const merged = mergeProductsById(baseProducts, [searchedProduct]);

    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      id: 'product-2',
      code: 'P-002',
      name: '搜索命中产品',
    });
  });

  test('同一产品重复出现时，应以后选中的最新数据覆盖旧缓存', () => {
    const staleProduct = createProduct({
      id: 'product-1',
      code: 'P-001',
      inventory: {
        totalQuantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
        batches: [],
      },
    });
    const freshProduct = createProduct({
      id: 'product-1',
      code: 'P-001-NEW',
      inventory: {
        totalQuantity: 20,
        reservedQuantity: 2,
        availableQuantity: 18,
        batches: [],
      },
    });

    const merged = mergeProductsById([staleProduct], [freshProduct]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'product-1',
      code: 'P-001-NEW',
      inventory: {
        totalQuantity: 20,
        reservedQuantity: 2,
        availableQuantity: 18,
      },
    });
  });
});
