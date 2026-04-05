import {
  correctOpeningBalanceImportBatch,
  deleteOpeningBalanceImportBatch,
  getOpeningBalanceImportBatchDetail,
} from '@/lib/services/opening-balance-import-batch-service';

jest.mock('@/lib/db', () => ({
  prisma: {
    inboundRecord: {
      findMany: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
    inventoryCostQueue: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: {
    inboundRecord: {
      findMany: jest.Mock;
    };
    inventory: {
      findMany: jest.Mock;
    };
    inventoryCostQueue: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
};

function createBatchRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'record-1',
    recordNumber: 'RK20260323001',
    productId: 'product-1',
    variantId: null,
    batchNumber: 'COLOR-A01',
    openingImportBatchId: 'OBI-20260323-101010-ABCD',
    quantity: 100,
    unitCost: 12.5,
    totalCost: 1250,
    location: 'A-01',
    reason: 'opening_balance',
    createdAt: new Date('2026-03-23T10:10:10.000Z'),
    updatedAt: new Date('2026-03-23T10:10:10.000Z'),
    supplierId: null,
    product: {
      id: 'product-1',
      code: 'P-001',
      name: '测试砖',
      specification: '800x800mm',
      piecesPerUnit: 4,
      weight: 30,
    },
    variant: null,
    supplier: null,
    batchSpecification: {
      id: 'batch-spec-1',
      batchNumber: 'COLOR-A01',
      piecesPerUnit: 4,
      weight: 30,
      thickness: 9.5,
    },
    ...overrides,
  };
}

describe('opening-balance import batch service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('会识别已被后续业务消耗的导入批次记录并阻止整批删除', async () => {
    prisma.inboundRecord.findMany.mockResolvedValue([createBatchRecord()]);
    prisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inventory-1',
        productId: 'product-1',
        variantId: null,
        batchNumber: 'COLOR-A01',
        quantity: 100,
        reservedQuantity: 0,
      },
    ]);
    prisma.inventoryCostQueue.findMany.mockResolvedValue([
      {
        id: 'queue-1',
        inboundRecordId: 'record-1',
        remainingQty: 90,
      },
    ]);

    const detail = await getOpeningBalanceImportBatchDetail(
      'OBI-20260323-101010-ABCD'
    );

    expect(detail.canDeleteAll).toBe(false);
    expect(detail.records[0]).toMatchObject({
      canCorrect: false,
      canDelete: false,
      consumedQty: 10,
    });
    expect(detail.records[0].blockedReason).toContain('已被后续业务消耗 10 片');

    await expect(
      deleteOpeningBalanceImportBatch('OBI-20260323-101010-ABCD')
    ).rejects.toThrow('这批期初数据里已有记录进入后续业务');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('对未污染的导入批次记录支持批量更正', async () => {
    const tx = {
      inboundRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'record-1',
          recordNumber: 'RK20260323001',
          quantity: 460,
          unitCost: 18.5,
          totalCost: 8510,
          productId: 'product-1',
          variantId: null,
          batchNumber: 'COLOR-A01',
          openingImportBatchId: 'OBI-20260323-101010-ABCD',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inventory-1',
            quantity: 460,
            reservedQuantity: 0,
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      inventoryCostQueue: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'queue-1',
            remainingQty: 460,
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(async callback => callback(tx));

    const result = await correctOpeningBalanceImportBatch(
      'OBI-20260323-101010-ABCD',
      [
        {
          id: 'record-1',
          quantity: 500,
        },
      ]
    );

    expect(result).toMatchObject({
      updatedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(result.results[0]).toMatchObject({
      id: 'record-1',
      status: 'updated',
    });
    expect(tx.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: {
        quantity: { increment: 40 },
        updatedAt: expect.any(Date),
      },
    });
    expect(tx.inventoryCostQueue.update).toHaveBeenCalledWith({
      where: { id: 'queue-1' },
      data: {
        remainingQty: { increment: 40 },
      },
    });
    expect(tx.inboundRecord.update).toHaveBeenCalledWith({
      where: { id: 'record-1' },
      data: {
        quantity: 500,
        unitCost: 18.5,
        totalCost: 9250,
      },
    });
  });

  test('已被后续业务消耗的导入批次记录在批量更正时会返回失败结果', async () => {
    const tx = {
      inboundRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'record-1',
          recordNumber: 'RK20260323001',
          quantity: 100,
          unitCost: 12.5,
          totalCost: 1250,
          productId: 'product-1',
          variantId: null,
          batchNumber: 'COLOR-A01',
          openingImportBatchId: 'OBI-20260323-101010-ABCD',
        }),
        update: jest.fn(),
      },
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inventory-1',
            quantity: 100,
            reservedQuantity: 0,
          },
        ]),
        update: jest.fn(),
      },
      inventoryCostQueue: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'queue-1',
            remainingQty: 97,
          },
        ]),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async callback => callback(tx));

    const result = await correctOpeningBalanceImportBatch(
      'OBI-20260323-101010-ABCD',
      [
        {
          id: 'record-1',
          quantity: 120,
        },
      ]
    );

    expect(result).toMatchObject({
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(result.results[0]).toMatchObject({
      id: 'record-1',
      status: 'failed',
    });
    expect(result.results[0]?.message).toContain('已被后续业务消耗 3 片');
    expect(tx.inventory.update).not.toHaveBeenCalled();
    expect(tx.inventoryCostQueue.update).not.toHaveBeenCalled();
    expect(tx.inboundRecord.update).not.toHaveBeenCalled();
  });
});
