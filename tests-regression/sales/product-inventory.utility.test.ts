import {
  getInventoryBatchAvailableQuantity,
  getProductAvailableQuantity,
} from '@/lib/utils/product-inventory';
import type { Product } from '@/lib/types/product';

const product: Product = {
  id: 'product-1',
  code: 'P-001',
  name: '测试瓷砖',
  specification: '800x800',
  unit: 'sheet',
  piecesPerUnit: 4,
  status: 'active',
  createdAt: '2026-04-03T00:00:00.000Z',
  updatedAt: '2026-04-03T00:00:00.000Z',
  inventory: {
    totalQuantity: 120,
    reservedQuantity: 20,
    availableQuantity: 100,
    batches: [
      {
        batchNumber: 'B1',
        quantity: 60,
        reservedQuantity: 55,
        availableQuantity: 5,
      },
      {
        batchNumber: 'B2',
        quantity: 60,
        reservedQuantity: 0,
        availableQuantity: 60,
      },
    ],
  },
};

describe('product-inventory utilities', () => {
  test('getInventoryBatchAvailableQuantity：有批次可用量时应优先使用可用量', () => {
    expect(
      getInventoryBatchAvailableQuantity({
        batchNumber: 'B1',
        quantity: 60,
        availableQuantity: 5,
      })
    ).toBe(5);
  });

  test('getProductAvailableQuantity：指定批次时应返回该批次可用量，而不是产品总可用量', () => {
    expect(getProductAvailableQuantity(product, 'B1')).toBe(5);
    expect(getProductAvailableQuantity(product, 'B2')).toBe(60);
    expect(getProductAvailableQuantity(product)).toBe(100);
  });

  test('getProductAvailableQuantity：指定不存在的批次时应视为不可用', () => {
    expect(getProductAvailableQuantity(product, 'B3')).toBe(0);
  });
});
