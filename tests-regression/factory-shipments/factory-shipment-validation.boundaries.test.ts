import { updateFactoryShipmentOrderSchema } from '@/lib/validations/factory-shipment';

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: '22222222-2222-4222-8222-222222222222',
    supplierId: 'supplier-1',
    productCode: 'P-001',
    batchNumber: 'B001',
    quantity: 10,
    unitPrice: 12,
    displayName: '自用砖A',
    unit: 'sheet',
    ...overrides,
  };
}

describe('厂家发货单校验边界', () => {
  test('相同供应商下相同产品和批次重复录入时应失败', () => {
    const parsed = updateFactoryShipmentOrderSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      items: [createItem(), createItem()],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['items', 0, 'displayName'],
          message: '同一供应商下相同产品和批次不能重复录入',
        }),
        expect.objectContaining({
          path: ['items', 1, 'batchNumber'],
          message: '同一供应商下相同产品和批次不能重复录入',
        }),
      ])
    );
  });

  test('相同供应商下相同产品未区分批次时应提示补充批次或合并数量', () => {
    const parsed = updateFactoryShipmentOrderSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      items: [
        createItem({ batchNumber: '' }),
        createItem({ batchNumber: '' }),
      ],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['items', 0, 'displayName'],
          message: '同一供应商下相同产品不能重复录入，请补充批次或合并数量',
        }),
      ])
    );
  });

  test('相同供应商下相同产品但批次不同应允许通过', () => {
    const parsed = updateFactoryShipmentOrderSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      items: [
        createItem({ batchNumber: 'B001' }),
        createItem({ batchNumber: 'B002' }),
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
