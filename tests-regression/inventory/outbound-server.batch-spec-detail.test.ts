jest.mock('@/lib/db', () => ({
  prisma: {
    outboundRecord: {
      findUnique: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
    },
    batchSpecification: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import { getOutboundRecordByNumber } from '@/lib/api/outbound-server';

const prismaMock = prisma as unknown as {
  outboundRecord: {
    findUnique: jest.Mock;
  };
  inventory: {
    findUnique: jest.Mock;
  };
  batchSpecification: {
    findMany: jest.Mock;
  };
};

describe('getOutboundRecordByNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('出库详情应优先使用批次装箱数和批次重量', async () => {
    prismaMock.outboundRecord.findUnique.mockResolvedValue({
      id: 'out-1',
      recordNumber: 'OUT-001',
      productId: 'product-1',
      variantId: null,
      inventoryId: 'inventory-1',
      quantity: 26,
      reason: 'sales_outbound',
      notes: '测试出库',
      customerId: null,
      salesOrderId: null,
      operatorId: 'user-1',
      batchNumber: 'BATCH-001',
      unitCost: 12.5,
      totalCost: 325,
      createdAt: new Date('2026-04-15T08:00:00.000Z'),
      updatedAt: new Date('2026-04-15T08:00:00.000Z'),
      product: {
        id: 'product-1',
        code: 'P-001',
        name: '测试产品',
        specification: '600x600',
        unit: 'piece',
        piecesPerUnit: 12,
        weight: 24,
      },
      variant: null,
      operator: {
        id: 'user-1',
        name: '测试员',
        email: 'tester@example.com',
      },
      customer: null,
      salesOrder: null,
    });
    prismaMock.inventory.findUnique.mockResolvedValue({ quantity: 100 });
    prismaMock.batchSpecification.findMany.mockResolvedValue([
      {
        productId: 'product-1',
        variantId: null,
        batchNumber: 'BATCH-001',
        piecesPerUnit: 13,
        weight: 26,
      },
    ]);

    const result = await getOutboundRecordByNumber('OUT-001');

    expect(result).toEqual(
      expect.objectContaining({
        piecesPerUnit: 13,
        weightPerUnit: 26,
        totalWeight: 52,
        inventoryBalance: 100,
      })
    );
    expect(result?.product).toEqual(
      expect.objectContaining({
        piecesPerUnit: 13,
        weight: 26,
      })
    );
  });
});
