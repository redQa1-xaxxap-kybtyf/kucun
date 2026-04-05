/**
 * FIFO 成本队列核心逻辑单元测试
 *
 * 覆盖：
 * - getFIFOCost：按 FIFO 顺序计算成本
 * - consumeFIFOQueue / consumeFIFOQueueByBatch：按 FIFO 顺序消耗队列（含并发冲突重试）
 * - ensureFIFOQueueMatchesInventory：FIFO 缺口补齐（优先使用现存 FIFO 加权平均成本）
 */

import {
  consumeFIFOQueue,
  consumeFIFOQueueByBatch,
  ensureFIFOQueueMatchesInventory,
  getFIFOCost,
  getWeightedAverageCostFromFIFOByBatch,
} from '@/lib/services/fifo-cost-service';

// --- logger mock -------------------------------------------------------------------
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// --- prisma mock (module imports prisma as fallback, tests pass tx explicitly) ------

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

type QueueEntry = {
  id: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  inboundRecordId: string;
  remainingQty: number;
  unitCost: number;
  inboundDate: Date;
  updatedAt: Date;
};

type InboundRecord = {
  id: string;
  recordNumber: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number;
  unitCost: number;
  createdAt: Date;
};

function createInMemoryTx(params?: {
  queue?: QueueEntry[];
  inbound?: InboundRecord[];
  failFirstUpdateForIds?: string[];
  consumeToZeroOnFirstUpdateForIds?: string[];
}) {
  const queueById = new Map<string, QueueEntry>();
  const inboundByRecordNumber = new Map<string, InboundRecord>();
  const inboundById = new Map<string, InboundRecord>();
  const failFirstUpdateSet = new Set(params?.failFirstUpdateForIds ?? []);
  const consumeToZeroOnFirstUpdateSet = new Set(
    params?.consumeToZeroOnFirstUpdateForIds ?? []
  );
  const failedOnce = new Set<string>();

  for (const entry of params?.queue ?? []) {
    queueById.set(entry.id, { ...entry });
  }

  for (const record of params?.inbound ?? []) {
    inboundByRecordNumber.set(record.recordNumber, { ...record });
    inboundById.set(record.id, { ...record });
  }

  const clone = <T extends Record<string, unknown>>(value: T) => ({ ...value });

  const matchNullable = (value: string | null, expected: unknown) => {
    if (expected === undefined) return true;
    return value === (expected as string | null);
  };

  const applyInventoryCostQueueWhere = (entry: QueueEntry, where: any) => {
    if (!where) return true;
    if (where.id !== undefined && entry.id !== where.id) return false;
    if (where.productId !== undefined && entry.productId !== where.productId) {
      return false;
    }
    if (!matchNullable(entry.variantId, where.variantId)) return false;
    if (!matchNullable(entry.batchNumber, where.batchNumber)) return false;
    if (
      where.inboundRecordId !== undefined &&
      entry.inboundRecordId !== where.inboundRecordId
    ) {
      return false;
    }
    if (where.remainingQty?.gt !== undefined) {
      if (!(entry.remainingQty > where.remainingQty.gt)) return false;
    }
    if (
      where.remainingQty !== undefined &&
      typeof where.remainingQty === 'number'
    ) {
      if (entry.remainingQty !== where.remainingQty) return false;
    }
    if (where.updatedAt !== undefined) {
      const expectedMs =
        where.updatedAt instanceof Date
          ? where.updatedAt.getTime()
          : new Date(where.updatedAt).getTime();
      if (entry.updatedAt.getTime() !== expectedMs) return false;
    }

    if (Array.isArray(where.OR) && where.OR.length > 0) {
      const anyMatch = where.OR.some((cond: any) => {
        if (cond?.inboundDate?.gt) {
          const dt = cond.inboundDate.gt as Date;
          return entry.inboundDate.getTime() > dt.getTime();
        }
        if (cond?.inboundDate && cond?.id?.gt) {
          const dt = cond.inboundDate as Date;
          const idGt = cond.id.gt as string;
          return (
            entry.inboundDate.getTime() === dt.getTime() && entry.id > idGt
          );
        }
        return false;
      });
      if (!anyMatch) return false;
    }

    return true;
  };

  const applyOrderBy = (entries: QueueEntry[], orderBy: any) => {
    const clauses: Array<{ field: 'inboundDate' | 'id'; dir: 'asc' | 'desc' }> =
      Array.isArray(orderBy)
        ? orderBy.map((o: any) => {
            const field = Object.keys(o)[0] as 'inboundDate' | 'id';
            return { field, dir: o[field] as 'asc' | 'desc' };
          })
        : orderBy
          ? [
              {
                field: Object.keys(orderBy)[0] as 'inboundDate' | 'id',
                dir: (orderBy as any)[Object.keys(orderBy)[0]] as
                  | 'asc'
                  | 'desc',
              },
            ]
          : [];

    return [...entries].sort((a, b) => {
      for (const c of clauses) {
        const av = c.field === 'inboundDate' ? a.inboundDate.getTime() : a.id;
        const bv = c.field === 'inboundDate' ? b.inboundDate.getTime() : b.id;
        if (av === bv) continue;
        const cmp = av < bv ? -1 : 1;
        return c.dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  };

  const inventoryCostQueue = {
    create: jest.fn(async (args: any) => {
      const data = args?.data ?? {};
      const id = data.id ?? `q_${queueById.size + 1}`;
      const entry: QueueEntry = {
        id,
        productId: data.productId,
        variantId: data.variantId ?? null,
        batchNumber: data.batchNumber ?? null,
        inboundRecordId: data.inboundRecordId,
        remainingQty: Number(data.remainingQty),
        unitCost: Number(data.unitCost),
        inboundDate:
          data.inboundDate instanceof Date
            ? data.inboundDate
            : new Date(data.inboundDate),
        updatedAt: new Date(),
      };
      queueById.set(entry.id, entry);
      return clone(entry);
    }),

    aggregate: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const sum = Array.from(queueById.values())
        .filter(e => applyInventoryCostQueueWhere(e, where))
        .reduce((acc, e) => acc + e.remainingQty, 0);
      return { _sum: { remainingQty: sum } };
    }),

    findMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const orderBy = args?.orderBy;
      const take = typeof args?.take === 'number' ? args.take : undefined;
      const cursorId: string | undefined = args?.cursor?.id;
      const skip = typeof args?.skip === 'number' ? args.skip : 0;

      let entries = Array.from(queueById.values()).filter(e =>
        applyInventoryCostQueueWhere(e, where)
      );

      entries = applyOrderBy(entries, orderBy);

      if (cursorId) {
        const idx = entries.findIndex(e => e.id === cursorId);
        if (idx >= 0) {
          entries = entries.slice(idx + skip);
        }
      }

      if (take !== undefined) {
        entries = entries.slice(0, take);
      }

      return entries.map(e => clone(e));
    }),

    findUnique: jest.fn(async (args: any) => {
      const id = args?.where?.id as string | undefined;
      if (!id) return null;
      const entry = queueById.get(id);
      return entry ? clone(entry) : null;
    }),

    updateMany: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      const id = where?.id as string | undefined;
      const entry = id ? queueById.get(id) : undefined;
      if (!entry) return { count: 0 };

      if (
        consumeToZeroOnFirstUpdateSet.has(entry.id) &&
        !failedOnce.has(entry.id)
      ) {
        failedOnce.add(entry.id);
        // 模拟并发修改：该批次被其他事务完全消耗
        entry.remainingQty = 0;
        entry.updatedAt = new Date(entry.updatedAt.getTime() + 1000);
        queueById.set(entry.id, entry);
        return { count: 0 };
      }

      if (failFirstUpdateSet.has(entry.id) && !failedOnce.has(entry.id)) {
        failedOnce.add(entry.id);
        // 模拟并发修改：updatedAt 被其他事务更新（remainingQty 不变）
        entry.updatedAt = new Date(entry.updatedAt.getTime() + 1000);
        queueById.set(entry.id, entry);
        return { count: 0 };
      }

      const matches = applyInventoryCostQueueWhere(entry, where);
      if (!matches) return { count: 0 };

      if (args?.data?.remainingQty !== undefined) {
        entry.remainingQty = Number(args.data.remainingQty);
      }

      // Prisma @updatedAt 行为：更新时 updatedAt 变更
      entry.updatedAt = new Date(entry.updatedAt.getTime() + 1);
      queueById.set(entry.id, entry);
      return { count: 1 };
    }),

    update: jest.fn(async (args: any) => {
      const id = args?.where?.id as string | undefined;
      const entry = id ? queueById.get(id) : undefined;
      if (!entry) throw new Error('NotFound');

      const increment = args?.data?.remainingQty?.increment;
      if (typeof increment === 'number') {
        entry.remainingQty += increment;
      } else if (args?.data?.remainingQty !== undefined) {
        entry.remainingQty = Number(args.data.remainingQty);
      }

      entry.updatedAt = new Date(entry.updatedAt.getTime() + 1);
      queueById.set(entry.id, entry);
      return clone(entry);
    }),
  };

  const inboundRecord = {
    findUnique: jest.fn(async (args: any) => {
      const recordNumber = args?.where?.recordNumber as string | undefined;
      if (!recordNumber) return null;
      const found = inboundByRecordNumber.get(recordNumber);
      return found ? clone(found) : null;
    }),

    create: jest.fn(async (args: any) => {
      const data = args?.data ?? {};
      const id = data.id ?? `inb_${inboundById.size + 1}`;
      const createdAt = new Date();
      const record: InboundRecord = {
        id,
        recordNumber: String(data.recordNumber),
        productId: String(data.productId),
        variantId: data.variantId ?? null,
        batchNumber: data.batchNumber ?? null,
        quantity: Number(data.quantity),
        unitCost: Number(data.unitCost),
        createdAt,
      };
      inboundByRecordNumber.set(record.recordNumber, record);
      inboundById.set(record.id, record);
      return clone(record);
    }),

    update: jest.fn(async (args: any) => {
      const id = args?.where?.id as string | undefined;
      const record = id ? inboundById.get(id) : undefined;
      if (!record) throw new Error('NotFound');
      if (args?.data?.quantity !== undefined) {
        record.quantity = Number(args.data.quantity);
      }
      if (args?.data?.unitCost !== undefined) {
        record.unitCost = Number(args.data.unitCost);
      }
      inboundByRecordNumber.set(record.recordNumber, record);
      inboundById.set(record.id, record);
      return clone(record);
    }),
  };

  return {
    tx: { inventoryCostQueue, inboundRecord } as any,
    store: { queueById, inboundByRecordNumber, inboundById },
  };
}

describe('fifo-cost-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getFIFOCost：按 FIFO 顺序计算成本', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: 'v1',
          batchNumber: null,
          inboundRecordId: 'in1',
          remainingQty: 10,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: 'v1',
          batchNumber: null,
          inboundRecordId: 'in2',
          remainingQty: 10,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await getFIFOCost('p1', 'v1', 15, tx);

    expect(result.totalCost).toBe(35);
    expect(result.averageUnitCost).toBe(2.333);
    expect(result.batches).toEqual([
      { inboundRecordId: 'in1', qty: 10, unitCost: 2, batchCost: 20 },
      { inboundRecordId: 'in2', qty: 5, unitCost: 3, batchCost: 15 },
    ]);
  });

  it('getFIFOCost：库存不足应抛错', async () => {
    const { tx } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: null,
          inboundRecordId: 'in1',
          remainingQty: 5,
          unitCost: 2,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
    });

    await expect(getFIFOCost('p1', null, 10, tx)).rejects.toThrow('库存不足');
  });

  it('consumeFIFOQueue：按 FIFO 消耗队列，且能处理并发冲突重试', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: 'v1',
          batchNumber: null,
          inboundRecordId: 'in1',
          remainingQty: 10,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: 'v1',
          batchNumber: null,
          inboundRecordId: 'in2',
          remainingQty: 10,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
      failFirstUpdateForIds: ['0001'],
    });

    const result = await consumeFIFOQueue('p1', 'v1', 15, tx);

    expect(result.totalCost).toBe(35);
    expect(result.averageUnitCost).toBe(2.333);

    // 0001 被完全消耗，0002 还剩 5
    expect(store.queueById.get('0001')?.remainingQty).toBe(0);
    expect(store.queueById.get('0002')?.remainingQty).toBe(5);

    // 并发冲突导致 updateMany 对 0001 至少调用 2 次
    const updateManyCallsFor0001 = (
      tx.inventoryCostQueue.updateMany as jest.Mock
    ).mock.calls.filter(call => call?.[0]?.where?.id === '0001');
    expect(updateManyCallsFor0001.length).toBeGreaterThanOrEqual(2);
  });

  it('consumeFIFOQueue：outboundQty=0 时应直接返回 0 成本且不报错', async () => {
    const { tx } = createInMemoryTx();

    const result = await consumeFIFOQueue('p1', null, 0, tx);

    expect(result).toEqual({ totalCost: 0, averageUnitCost: 0, batches: [] });
    expect(
      (tx.inventoryCostQueue.updateMany as jest.Mock).mock.calls.length
    ).toBe(0);
  });

  it('consumeFIFOQueue：并发下批次被完全消耗应跳过并继续后续批次', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: null,
          inboundRecordId: 'in1',
          remainingQty: 5,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: null,
          inboundRecordId: 'in2',
          remainingQty: 10,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
      consumeToZeroOnFirstUpdateForIds: ['0001'],
    });

    const result = await consumeFIFOQueue('p1', null, 8, tx);

    expect(result.totalCost).toBe(24);
    expect(result.averageUnitCost).toBe(3);
    expect(result.batches).toEqual([
      { inboundRecordId: 'in2', qty: 8, unitCost: 3, batchCost: 24 },
    ]);

    expect(store.queueById.get('0001')?.remainingQty).toBe(0);
    expect(store.queueById.get('0002')?.remainingQty).toBe(2);
  });

  it('consumeFIFOQueueByBatch：仅消耗指定批次', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in1',
          remainingQty: 10,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B2',
          inboundRecordId: 'in2',
          remainingQty: 10,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await consumeFIFOQueueByBatch('p1', null, 'B1', 4, tx);

    expect(result.totalCost).toBe(8);
    expect(result.averageUnitCost).toBe(2);
    expect(store.queueById.get('0001')?.remainingQty).toBe(6);
    expect(store.queueById.get('0002')?.remainingQty).toBe(10);
  });

  it('consumeFIFOQueueByBatch：batchNumber 为空白时等价于全批次 FIFO', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in1',
          remainingQty: 5,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B2',
          inboundRecordId: 'in2',
          remainingQty: 5,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await consumeFIFOQueueByBatch('p1', null, '   ', 6, tx);

    expect(result.totalCost).toBe(13);
    expect(result.averageUnitCost).toBe(2.167);
    expect(result.batches).toEqual([
      { inboundRecordId: 'in1', qty: 5, unitCost: 2, batchCost: 10 },
      { inboundRecordId: 'in2', qty: 1, unitCost: 3, batchCost: 3 },
    ]);

    expect(store.queueById.get('0001')?.remainingQty).toBe(0);
    expect(store.queueById.get('0002')?.remainingQty).toBe(4);
  });

  it('consumeFIFOQueueByBatch：指定批次库存不足时应报错（不影响其他批次）', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');

    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in1',
          remainingQty: 2,
          unitCost: 2,
          inboundDate: t1,
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B2',
          inboundRecordId: 'in2',
          remainingQty: 10,
          unitCost: 3,
          inboundDate: t2,
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    await expect(
      consumeFIFOQueueByBatch('p1', null, 'B1', 3, tx)
    ).rejects.toThrow('库存不足');

    expect(store.queueById.get('0002')?.remainingQty).toBe(10);
  });

  it('ensureFIFOQueueMatchesInventory：FIFO 存在时优先用加权平均成本补齐缺口', async () => {
    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in1',
          remainingQty: 2,
          unitCost: 10,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in2',
          remainingQty: 3,
          unitCost: 20,
          inboundDate: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await ensureFIFOQueueMatchesInventory(
      {
        inventoryId: 'inv-1',
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        expectedInventoryQty: 10,
        unitCostHint: 999, // 应被忽略（FIFO 队列存在）
        userId: 'user-1',
        source: 'test',
      },
      tx
    );

    // FIFO 可用量=5，缺口=5
    expect(result.backfilledQty).toBe(5);
    // 加权平均：(2*10 + 3*20) / 5 = 16
    expect(result.usedUnitCost).toBe(16);

    // 应创建一条系统补录入库记录 + 一条队列记录（remainingQty=5, unitCost=16）
    const backfillRecordNumber = 'INBFinv1';
    const inbound = store.inboundByRecordNumber.get(backfillRecordNumber);
    expect(inbound).toBeTruthy();
    expect(inbound?.quantity).toBe(5);
    expect(inbound?.unitCost).toBe(16);

    const backfillQueue = Array.from(store.queueById.values()).find(
      e => e.inboundRecordId === inbound?.id
    );
    expect(backfillQueue).toBeTruthy();
    expect(backfillQueue?.remainingQty).toBe(5);
    expect(backfillQueue?.unitCost).toBe(16);
    expect(backfillQueue?.batchNumber).toBe('B1');
  });

  it('ensureFIFOQueueMatchesInventory：复用已有补录入库记录时应增量更新队列与入库数量', async () => {
    const backfillRecordNumber = 'INBFinv3';

    const { tx, store } = createInMemoryTx({
      inbound: [
        {
          id: 'inb_backfill',
          recordNumber: backfillRecordNumber,
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          quantity: 5,
          unitCost: 10,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      queue: [
        {
          id: 'q_backfill',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'inb_backfill',
          remainingQty: 5,
          unitCost: 10,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
    });

    const result = await ensureFIFOQueueMatchesInventory(
      {
        inventoryId: 'inv-3',
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        expectedInventoryQty: 9,
        unitCostHint: 999,
        userId: 'user-1',
        source: 'test',
      },
      tx
    );

    expect(result.backfilledQty).toBe(4);
    expect(result.usedUnitCost).toBe(10);

    expect((tx.inboundRecord.create as jest.Mock).mock.calls.length).toBe(0);
    expect((tx.inventoryCostQueue.create as jest.Mock).mock.calls.length).toBe(
      0
    );

    expect(store.queueById.get('q_backfill')?.remainingQty).toBe(9);
    expect(
      store.inboundByRecordNumber.get(backfillRecordNumber)?.quantity
    ).toBe(9);
  });

  it('ensureFIFOQueueMatchesInventory：FIFO 均价为 0 时应回退使用 unitCostHint', async () => {
    const { tx, store } = createInMemoryTx({
      queue: [
        {
          id: '0001',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in1',
          remainingQty: 2,
          unitCost: 0,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: '0002',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'in2',
          remainingQty: 3,
          unitCost: 0,
          inboundDate: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    const result = await ensureFIFOQueueMatchesInventory(
      {
        inventoryId: 'inv-6',
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        expectedInventoryQty: 10,
        unitCostHint: 7.5,
        userId: 'user-1',
        source: 'test',
      },
      tx
    );

    expect(result.backfilledQty).toBe(5);
    expect(result.usedUnitCost).toBe(7.5);

    const backfillRecordNumber = 'INBFinv6';
    const inbound = store.inboundByRecordNumber.get(backfillRecordNumber);
    expect(inbound?.quantity).toBe(5);
    expect(inbound?.unitCost).toBe(7.5);
  });

  it('ensureFIFOQueueMatchesInventory：补录入库记录若与库存不匹配应报错', async () => {
    const { tx } = createInMemoryTx({
      inbound: [
        {
          id: 'inb_mismatch',
          recordNumber: 'INBFinv4',
          productId: 'p2',
          variantId: null,
          batchNumber: null,
          quantity: 1,
          unitCost: 10,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      ensureFIFOQueueMatchesInventory(
        {
          inventoryId: 'inv-4',
          productId: 'p1',
          variantId: null,
          batchNumber: null,
          expectedInventoryQty: 10,
          unitCostHint: 10,
          userId: 'user-1',
          source: 'test',
        },
        tx
      )
    ).rejects.toThrow('不匹配');
  });

  it('ensureFIFOQueueMatchesInventory：同一补录入库记录存在多条成本队列应报错', async () => {
    const { tx } = createInMemoryTx({
      inbound: [
        {
          id: 'inb_dup',
          recordNumber: 'INBFinv5',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          quantity: 2,
          unitCost: 10,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      queue: [
        {
          id: 'q1',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'inb_dup',
          remainingQty: 1,
          unitCost: 10,
          inboundDate: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: 'q2',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          inboundRecordId: 'inb_dup',
          remainingQty: 1,
          unitCost: 10,
          inboundDate: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:01.000Z'),
        },
      ],
    });

    await expect(
      ensureFIFOQueueMatchesInventory(
        {
          inventoryId: 'inv-5',
          productId: 'p1',
          variantId: null,
          batchNumber: 'B1',
          expectedInventoryQty: 10,
          unitCostHint: 10,
          userId: 'user-1',
          source: 'test',
        },
        tx
      )
    ).rejects.toThrow('多条成本队列记录');
  });

  it('ensureFIFOQueueMatchesInventory：无法推断成本时应抛错', async () => {
    const { tx } = createInMemoryTx();

    await expect(
      ensureFIFOQueueMatchesInventory(
        {
          inventoryId: 'inv-2',
          productId: 'p1',
          variantId: null,
          batchNumber: null,
          expectedInventoryQty: 10,
          unitCostHint: null,
          userId: 'user-1',
          source: 'test',
        },
        tx
      )
    ).rejects.toThrow('无法推断成本');
  });

  it('getWeightedAverageCostFromFIFOByBatch：超过 2000 条记录时分页游标应正确累加', async () => {
    const many: QueueEntry[] = Array.from({ length: 2001 }, (_, idx) => {
      const id = String(idx + 1).padStart(4, '0');
      return {
        id,
        productId: 'p1',
        variantId: null,
        batchNumber: 'B1',
        inboundRecordId: `in_${id}`,
        remainingQty: 1,
        unitCost: idx === 2000 ? 100 : 1,
        inboundDate: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:01.000Z'),
      };
    });

    const { tx } = createInMemoryTx({ queue: many });

    const avg = await getWeightedAverageCostFromFIFOByBatch(
      'p1',
      null,
      'B1',
      tx
    );

    // 2000*1 + 1*100 = 2100; 2100/2001 ≈ 1.049... -> 保留 3 位小数为 1.049
    expect(avg).toBe(1.049);
  });
});
