import {
  inventoryAdjustSchema,
  outboundCreateSchema,
} from '@/lib/validations/inventory-operations';

describe('瓷砖行业出入库：关键边界（schema）', () => {
  test('outboundCreateSchema：batchNumber 仅空白字符应失败（trim 后为空）', () => {
    const parsed = outboundCreateSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      type: 'normal_outbound',
      productId: '22222222-2222-4222-8222-222222222222',
      batchNumber: '   ',
      quantity: 1,
      unitCost: undefined,
      customerId: '',
      salesOrderId: '',
      remarks: '',
      variantId: '',
      reason: undefined,
      notes: '',
    });

    expect(parsed.success).toBe(false);
  });

  test('outboundCreateSchema：batchNumber 应自动 trim', () => {
    const parsed = outboundCreateSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      type: 'normal_outbound',
      productId: '22222222-2222-4222-8222-222222222222',
      batchNumber: '  B1  ',
      quantity: 1,
      unitCost: undefined,
      customerId: '',
      salesOrderId: '',
      remarks: '',
      variantId: '',
      reason: undefined,
      notes: '',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.batchNumber).toBe('B1');
  });

  test('outboundCreateSchema：batchNumber 超过 50 字符应失败', () => {
    const parsed = outboundCreateSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      type: 'normal_outbound',
      productId: '22222222-2222-4222-8222-222222222222',
      batchNumber: 'A'.repeat(51),
      quantity: 1,
      unitCost: undefined,
      customerId: '',
      salesOrderId: '',
      remarks: '',
      variantId: '',
      reason: undefined,
      notes: '',
    });

    expect(parsed.success).toBe(false);
  });

  test('inventoryAdjustSchema：batchNumber 仅空白字符应失败（trim 后为空）', () => {
    const parsed = inventoryAdjustSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      productId: '22222222-2222-4222-8222-222222222222',
      batchNumber: '   ',
      adjustQuantity: 1,
      reason: 'other',
      notes: '',
      variantId: '',
    });

    expect(parsed.success).toBe(false);
  });

  test('inventoryAdjustSchema：batchNumber 应自动 trim', () => {
    const parsed = inventoryAdjustSchema.safeParse({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      productId: '22222222-2222-4222-8222-222222222222',
      batchNumber: '  B1  ',
      adjustQuantity: 1,
      reason: 'other',
      notes: '',
      variantId: '',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.batchNumber).toBe('B1');
  });
});
