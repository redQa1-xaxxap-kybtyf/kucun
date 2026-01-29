import { createInMemoryPrisma } from '../helpers/in-memory-prisma';

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

function resetPrisma(seed?: Parameters<typeof createInMemoryPrisma>[0]) {
  const { prisma: memPrisma, tx, store } = createInMemoryPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { tx, store };
}

describe('库存核心链路（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('最小入库事务：应创建入库记录 + FIFO 队列 + 库存记录', async () => {
    const productId = 'prod-1';
    const userId = 'user-1';

    const { tx, store } = resetPrisma({
      products: [{ id: productId, name: '产品A', code: 'P001', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
    });

    const { executeMinimalInboundTransaction } = await import(
      '@/lib/api/minimal-inbound-transaction'
    );

    const result = await executeMinimalInboundTransaction(
      {
        productId,
        quantity: 10,
        unitCost: 5,
        reason: 'purchase',
        remarks: '入库测试',
        batchNumber: 'B1',
        userId,
      },
      { tx }
    );

    expect(result.productId).toBe(productId);
    expect(result.quantity).toBe(10);
    expect(result.batchNumber).toBe('B1');

    expect(store.inboundById.size).toBe(1);
    expect(store.fifoById.size).toBe(1);
    expect(store.inventoriesById.size).toBe(1);

    const inventory = Array.from(store.inventoriesById.values())[0] as any;
    expect(inventory.productId).toBe(productId);
    expect(inventory.batchNumber).toBe('B1');
    expect(inventory.quantity).toBe(10);
    expect(inventory.reservedQuantity).toBe(0);
    expect(inventory.unitCost).toBe(5);
  });

  test('updateInventoryQuantity：仅当 unitCost 为空时写入，避免覆盖已有成本', async () => {
    const productId = 'prod-2';
    const batchNumber = 'B2';

    const { tx, store } = resetPrisma({
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 12.5,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { updateInventoryQuantity } = await import(
      '@/lib/api/inbound-handlers'
    );

    await updateInventoryQuantity(
      productId,
      batchNumber,
      5,
      { variantId: undefined, unitCost: 99.99 },
      tx
    );

    const inv = store.inventoriesById.get('inv-1') as any;
    expect(inv.quantity).toBe(15);
    expect(inv.unitCost).toBe(12.5);
  });

  test('手工出库：应按 FIFO 扣减成本，并同步扣减 reservedQuantity', async () => {
    const productId = 'prod-3';
    const batchNumber = 'B3';
    const userId = 'user-3';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品C', code: 'P003', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-3',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 3,
          unitCost: 100, // hint，不应影响 FIFO 成本
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      inboundRecords: [
        {
          id: 'inb-3',
          recordNumber: 'IN-3',
          productId,
          variantId: null,
          batchNumber,
          batchSpecificationId: null,
          quantity: 10,
          unitCost: 5,
          totalCost: 50,
          reason: 'purchase',
          remarks: null,
          userId,
          purchaseOrderId: null,
          purchaseOrderItemId: null,
          supplierId: null,
          createdAt: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-1',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-3',
          remainingQty: 10,
          unitCost: 5,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    const result = await executeOutboundTransaction(
      {
        type: 'normal_outbound',
        productId,
        batchNumber: `  ${batchNumber}  `,
        quantity: 4,
        remarks: '手工出库',
      },
      userId
    );

    const inv = store.inventoriesById.get('inv-3') as any;
    expect(inv.quantity).toBe(6);
    expect(inv.reservedQuantity).toBe(0);

    // FIFO 队列应消耗 4
    const fifo = store.fifoById.get('q-1') as any;
    expect(fifo.remainingQty).toBe(6);

    // 出库记录应写入 FIFO 成本
    expect(store.outboundById.size).toBe(1);
    const outbound = Array.from(store.outboundById.values())[0] as any;
    expect(outbound.productId).toBe(productId);
    expect(outbound.batchNumber).toBe(batchNumber);
    expect(outbound.quantity).toBe(4);
    expect(outbound.unitCost).toBe(5);
    expect(outbound.totalCost).toBe(20);

    // 返回值应包含库存对象
    expect(result?.inventory?.id).toBe('inv-3');
  });

  test('手工出库：批次号缺失应强校验失败', async () => {
    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    resetPrisma();

    await expect(
      executeOutboundTransaction(
        {
          type: 'normal_outbound',
          productId: 'p',
          quantity: 1,
          batchNumber: '   ',
        },
        'u'
      )
    ).rejects.toThrow('批次号/色号为必填项');
  });

  test('手工出库：同一客户同一产品批次必须一致', async () => {
    const productId = 'prod-4';
    const userId = 'user-4';
    const customerId = 'cust-4';

    resetPrisma({
      products: [{ id: productId, name: '产品D', code: 'P004', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-4a',
          productId,
          variantId: null,
          batchNumber: 'B1',
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 1,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'inv-4b',
          productId,
          variantId: null,
          batchNumber: 'B2',
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 1,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      outboundRecords: [
        {
          id: 'out-exists',
          recordNumber: 'OUT-EXISTS',
          productId,
          variantId: null,
          batchNumber: 'B1',
          inventoryId: 'inv-4a',
          quantity: 1,
          unitCost: 1,
          totalCost: 1,
          reason: 'normal_outbound',
          notes: null,
          customerId,
          operatorId: userId,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      inboundRecords: [
        {
          id: 'inb-4b',
          recordNumber: 'IN-4B',
          productId,
          variantId: null,
          batchNumber: 'B2',
          batchSpecificationId: null,
          quantity: 10,
          unitCost: 1,
          totalCost: 10,
          reason: 'purchase',
          remarks: null,
          userId,
          purchaseOrderId: null,
          purchaseOrderItemId: null,
          supplierId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-4b',
          productId,
          variantId: null,
          batchNumber: 'B2',
          inboundRecordId: 'inb-4b',
          remainingQty: 10,
          unitCost: 1,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await expect(
      executeOutboundTransaction(
        {
          type: 'sales_outbound',
          productId,
          batchNumber: 'B2',
          quantity: 1,
          customerId,
        },
        userId
      )
    ).rejects.toThrow('同一客户的同一产品必须使用相同批次');
  });

  test('手工出库：FIFO 缺口应在事务内自动补齐后再消耗', async () => {
    const productId = 'prod-5';
    const batchNumber = 'B5';
    const userId = 'user-5';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品E', code: 'P005', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-5',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 5, // 仅作为 hint
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-5',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-5-seed',
          remainingQty: 4,
          unitCost: 5,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await executeOutboundTransaction(
      {
        type: 'normal_outbound',
        productId,
        batchNumber: `  ${batchNumber}  `,
        quantity: 2,
      },
      userId
    );

    // 应自动补录一条 inboundRecord (recordNumber=INBF{inventoryId})
    const backfillRecordNumber = 'INBFinv5';
    const backfillId = store.inboundByRecordNumber.get(backfillRecordNumber);
    expect(backfillId).toBeTruthy();

    // FIFO 总量应先补齐到 10，再消耗 2 => 剩余 8
    const totalRemaining = Array.from(store.fifoById.values()).reduce(
      (acc, e: any) => acc + Number(e.remainingQty),
      0
    );
    expect(totalRemaining).toBe(8);
  });

  test('手工出库：reservedQuantity 大于出库量时应保留剩余预留量', async () => {
    const productId = 'prod-9';
    const batchNumber = 'B9';
    const userId = 'user-9';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品I', code: 'P009', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-9',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 5,
          unitCost: 5,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      inboundRecords: [
        {
          id: 'inb-9',
          recordNumber: 'IN-9',
          productId,
          variantId: null,
          batchNumber,
          batchSpecificationId: null,
          quantity: 10,
          unitCost: 5,
          totalCost: 50,
          reason: 'purchase',
          remarks: null,
          userId,
          purchaseOrderId: null,
          purchaseOrderItemId: null,
          supplierId: null,
          createdAt: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-9',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-9',
          remainingQty: 10,
          unitCost: 5,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await executeOutboundTransaction(
      {
        type: 'normal_outbound',
        productId,
        batchNumber,
        quantity: 4,
      },
      userId
    );

    const inv = store.inventoriesById.get('inv-9') as any;
    expect(inv.quantity).toBe(6);
    expect(inv.reservedQuantity).toBe(1);

    const fifo = store.fifoById.get('q-9') as any;
    expect(fifo.remainingQty).toBe(6);

    const outbound = Array.from(store.outboundById.values())[0] as any;
    expect(outbound.totalCost).toBe(20);
  });

  test('手工出库：出库量等于可用库存(quantity-reserved)时应允许并清零预留量', async () => {
    const productId = 'prod-10';
    const batchNumber = 'B10';
    const userId = 'user-10';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品J', code: 'P010', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-10',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 4,
          unitCost: 5,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-10',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-10',
          remainingQty: 10,
          unitCost: 5,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await executeOutboundTransaction(
      {
        type: 'normal_outbound',
        productId,
        batchNumber,
        quantity: 6, // available = 10-4
      },
      userId
    );

    const inv = store.inventoriesById.get('inv-10') as any;
    expect(inv.quantity).toBe(4);
    expect(inv.reservedQuantity).toBe(0);

    const fifo = store.fifoById.get('q-10') as any;
    expect(fifo.remainingQty).toBe(4);
  });

  test('手工出库：variantId 为空白时应视为未指定（匹配 variantId=null 的库存）', async () => {
    const productId = 'prod-11';
    const batchNumber = 'B11';
    const userId = 'user-11';

    const { store } = resetPrisma({
      inventories: [
        {
          id: 'inv-11',
          productId,
          variantId: null,
          batchNumber,
          quantity: 5,
          reservedQuantity: 0,
          unitCost: 3,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-11',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-11',
          remainingQty: 5,
          unitCost: 3,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await executeOutboundTransaction(
      {
        type: 'normal_outbound',
        productId,
        batchNumber,
        quantity: 1,
        variantId: '   ',
      },
      userId
    );

    const inv = store.inventoriesById.get('inv-11') as any;
    expect(inv.quantity).toBe(4);
  });

  test('手工出库：customerId 为空白应视为无客户（不校验批次一致性且写入 null）', async () => {
    const productId = 'prod-12';
    const batchNumber = 'B12';
    const userId = 'user-12';

    const { store } = resetPrisma({
      inventories: [
        {
          id: 'inv-12',
          productId,
          variantId: null,
          batchNumber,
          quantity: 5,
          reservedQuantity: 0,
          unitCost: 3,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-12',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-12',
          remainingQty: 5,
          unitCost: 3,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await executeOutboundTransaction(
      {
        type: 'sales_outbound',
        productId,
        batchNumber,
        quantity: 1,
        customerId: '   ',
      },
      userId
    );

    expect(store.outboundById.size).toBe(1);
    const outbound = Array.from(store.outboundById.values())[0] as any;
    expect(outbound.customerId).toBeNull();
  });

  test('手工出库：FIFO 为空且库存 unitCost 也为空时应失败且回滚数量更新', async () => {
    const productId = 'prod-13';
    const batchNumber = 'B13';
    const userId = 'user-13';

    const { store } = resetPrisma({
      inventories: [
        {
          id: 'inv-13',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 0,
          unitCost: null,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { executeOutboundTransaction } = await import(
      '@/app/api/inventory/outbound/route'
    );

    await expect(
      executeOutboundTransaction(
        {
          type: 'normal_outbound',
          productId,
          batchNumber,
          quantity: 1,
        },
        userId
      )
    ).rejects.toThrow('无法推断成本');

    const inv = store.inventoriesById.get('inv-13') as any;
    expect(inv.quantity).toBe(10);
    expect(inv.reservedQuantity).toBe(0);
    expect(store.outboundById.size).toBe(0);
    expect(store.fifoById.size).toBe(0);
  });

  test('库存调整（正向）：应创建“surplus”入库记录并补 FIFO 队列', async () => {
    const productId = 'prod-6';
    const batchNumber = 'B6';
    const userId = 'user-6';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品F', code: 'P006', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-6',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 20,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { executeAdjustmentTransaction } = await import(
      '@/app/api/inventory/adjust/route'
    );

    const result = await executeAdjustmentTransaction(
      {
        productId,
        batchNumber: `  ${batchNumber}  `,
        adjustQuantity: 5,
        reason: 'inventory_gain',
        notes: '盘盈',
      },
      userId
    );

    const inv = store.inventoriesById.get('inv-6') as any;
    expect(inv.quantity).toBe(15);

    expect(store.inboundById.size).toBe(1);
    expect(store.fifoById.size).toBe(1);

    const inbound = Array.from(store.inboundById.values())[0] as any;
    expect(inbound.reason).toBe('surplus');
    expect(inbound.quantity).toBe(5);
    expect(inbound.unitCost).toBe(20);

    const adjustment = result.adjustment as any;
    expect(adjustment.beforeQuantity).toBe(10);
    expect(adjustment.afterQuantity).toBe(15);
    expect(adjustment.totalCost).toBe(100);
  });

  test('库存调整（负向）：应按 FIFO 消耗并写入负向成本，且不创建入库记录', async () => {
    const productId = 'prod-7';
    const batchNumber = 'B7';
    const userId = 'user-7';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品G', code: 'P007', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-7',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 0,
          unitCost: 999,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      fifoQueue: [
        {
          id: 'q-7a',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-7a',
          remainingQty: 4,
          unitCost: 5,
          inboundDate: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:01.000Z'),
        },
        {
          id: 'q-7b',
          productId,
          variantId: null,
          batchNumber,
          inboundRecordId: 'inb-7b',
          remainingQty: 6,
          unitCost: 6,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
    });

    const { executeAdjustmentTransaction } = await import(
      '@/app/api/inventory/adjust/route'
    );

    const result = await executeAdjustmentTransaction(
      {
        productId,
        batchNumber: `  ${batchNumber}  `,
        adjustQuantity: -5,
        reason: 'inventory_loss',
        notes: '盘亏',
      },
      userId
    );

    expect(store.inboundById.size).toBe(0);

    // FIFO：4@5 + 1@6 => 总成本 26，单位成本 5.2
    const adjustment = result.adjustment as any;
    expect(adjustment.unitCost).toBe(5.2);
    expect(adjustment.totalCost).toBe(-26);

    const totalRemaining = Array.from(store.fifoById.values()).reduce(
      (acc, e: any) => acc + Number(e.remainingQty),
      0
    );
    expect(totalRemaining).toBe(5);
  });

  test('库存调整：调整后数量不得低于 reservedQuantity', async () => {
    const productId = 'prod-8';
    const batchNumber = 'B8';
    const userId = 'user-8';

    resetPrisma({
      products: [{ id: productId, name: '产品H', code: 'P008', unit: '片' }],
      users: [{ id: userId, name: '操作员' }],
      inventories: [
        {
          id: 'inv-8',
          productId,
          variantId: null,
          batchNumber,
          quantity: 10,
          reservedQuantity: 6,
          unitCost: 1,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { executeAdjustmentTransaction } = await import(
      '@/app/api/inventory/adjust/route'
    );

    await expect(
      executeAdjustmentTransaction(
        {
          productId,
          batchNumber,
          adjustQuantity: -5,
          reason: 'damage_loss',
          notes: '报损',
        },
        userId
      )
    ).rejects.toThrow('不能低于预留数量');
  });

  test('库存调整：批次号缺失应强校验失败', async () => {
    const { executeAdjustmentTransaction } = await import(
      '@/app/api/inventory/adjust/route'
    );

    resetPrisma();

    await expect(
      executeAdjustmentTransaction(
        {
          productId: 'p',
          batchNumber: '   ',
          adjustQuantity: 1,
          reason: 'other',
          notes: 'test',
        },
        'u'
      )
    ).rejects.toThrow('批次号/色号为必填项');
  });

  test('updateInventoryQuantity：当 unitCost 为空时应写入 unitCost', async () => {
    const productId = 'prod-14';
    const batchNumber = 'B14';

    const { tx, store } = resetPrisma({
      inventories: [
        {
          id: 'inv-14',
          productId,
          variantId: null,
          batchNumber,
          quantity: 1,
          reservedQuantity: 0,
          unitCost: null,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { updateInventoryQuantity } = await import(
      '@/lib/api/inbound-handlers'
    );

    await updateInventoryQuantity(
      productId,
      batchNumber,
      1,
      { unitCost: 8.88 },
      tx
    );

    const inv = store.inventoriesById.get('inv-14') as any;
    expect(inv.quantity).toBe(2);
    expect(inv.unitCost).toBe(8.88);
  });
});
