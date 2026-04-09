import { outboundCreateSchema } from '@/lib/validations/inventory-operations';
import {
  inventoryAdjustmentsQuerySchema,
} from '@/lib/validations/inventory-queries';

describe('inventory operation schemas', () => {
  it('accepts numeric adjustment query params from the API pagination parser', () => {
    const result = inventoryAdjustmentsQuerySchema.safeParse({
      page: 2,
      limit: 50,
      sortBy: 'adjustQuantity',
      sortOrder: 'asc',
      status: 'draft',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.page).toBe(2);
    expect(result.data.limit).toBe(50);
    expect(result.data.sortBy).toBe('adjustQuantity');
    expect(result.data.status).toBe('draft');
  });

  it('requires a customer for sample outbound records', () => {
    const validResult = outboundCreateSchema.safeParse({
      idempotencyKey: '7b41c8bb-7d31-4a31-a494-eb97eb5930fd',
      type: 'sample_outbound',
      productId: 'c4ca4238-a0b9-4383-a2b3-65f8b1e82d6d',
      batchNumber: 'BATCH-001',
      quantity: 5,
      customerId: '42d71a07-c85f-4759-84f2-2cb1b578bf20',
    });

    expect(validResult.success).toBe(true);

    const invalidResult = outboundCreateSchema.safeParse({
      idempotencyKey: '7b41c8bb-7d31-4a31-a494-eb97eb5930fd',
      type: 'sample_outbound',
      productId: 'c4ca4238-a0b9-4383-a2b3-65f8b1e82d6d',
      batchNumber: 'BATCH-001',
      quantity: 5,
    });

    expect(invalidResult.success).toBe(false);
    if (invalidResult.success) {
      return;
    }

    expect(invalidResult.error.issues[0]?.message).toContain('销售/样品出库需要选择客户');
  });
});
