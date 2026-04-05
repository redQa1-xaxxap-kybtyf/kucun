import {
  createInboundSchema,
  inboundFormSchema,
} from '@/lib/validations/inbound';

describe('inbound unit consistency（件/片口径防回归）', () => {
  test('createInboundSchema：按件入库时必须提供装箱数', () => {
    const parsed = createInboundSchema.safeParse({
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'units',
      quantity: 240,
      reason: 'other',
      remarks: '测试入库',
      batchNumber: 'BATCH-20241009-001',
      unitCost: 10,
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['piecesPerUnit'],
          message: '按件入库时必须填写装箱数',
        }),
      ])
    );
  });

  test('createInboundSchema：按件入库时最终片数必须等于件数乘装箱数', () => {
    const parsed = createInboundSchema.safeParse({
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'units',
      quantity: 24,
      reason: 'other',
      remarks: '测试入库',
      batchNumber: 'BATCH-20241009-001',
      piecesPerUnit: 10,
      unitCost: 10,
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['quantity'],
          message: '最终片数与录入数量/装箱数不一致，请刷新后重试',
        }),
      ])
    );
  });

  test('inboundFormSchema：按片入库时最终片数必须与录入片数一致', () => {
    const parsed = inboundFormSchema.safeParse({
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'pieces',
      quantity: 240,
      reason: 'other',
      remarks: '',
      batchNumber: 'BATCH-20241009-001',
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
      piecesPerUnit: 10,
      weight: 18.5,
      unitCost: 10,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['quantity'],
          message: '最终片数与录入数量/装箱数不一致，请刷新后重试',
        }),
      ])
    );
  });

  test('createInboundSchema：手工采购入库允许不关联采购单明细', () => {
    const parsed = createInboundSchema.safeParse({
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'pieces',
      quantity: 24,
      reason: 'purchase',
      remarks: '手工采购入库',
      batchNumber: 'BATCH-20241009-002',
      unitCost: 10,
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
    });

    expect(parsed.success).toBe(true);
  });

  test('createInboundSchema：有到货破损时必须选择处理方式', () => {
    const parsed = createInboundSchema.safeParse({
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'pieces',
      quantity: 24,
      reason: 'purchase',
      remarks: '手工采购入库',
      batchNumber: 'BATCH-20241009-003',
      unitCost: 10,
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
      damagedInputQuantity: 3,
      damagedQuantity: 3,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['damageHandling'],
          message: '有到货破损时必须选择处理方式',
        }),
      ])
    );
  });

  test('inboundFormSchema：到货破损片数必须与录入数量保持一致', () => {
    const parsed = inboundFormSchema.safeParse({
      productId: '660e8400-e29b-41d4-a716-446655440001',
      inputQuantity: 24,
      inputUnit: 'units',
      quantity: 240,
      reason: 'purchase',
      remarks: '',
      batchNumber: 'BATCH-20241009-004',
      supplierId: '770e8400-e29b-41d4-a716-446655440002',
      piecesPerUnit: 10,
      weight: 18.5,
      unitCost: 10,
      damagedInputQuantity: 2,
      damagedQuantity: 2,
      damageHandling: 'supplier_claim',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['damagedQuantity'],
          message: '破损片数与录入数量/装箱数不一致，请刷新后重试',
        }),
      ])
    );
  });
});
