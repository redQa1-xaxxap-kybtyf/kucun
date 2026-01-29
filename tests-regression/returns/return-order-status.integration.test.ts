import { updateReturnOrderStatus } from '@/lib/api/handlers/return-order-status';

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/simple-order-number-generator', () => ({
  generateRefundNumber: jest.fn().mockResolvedValue('RF-0001'),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

const { recordPartnerTransaction } = jest.requireMock(
  '@/lib/services/partner-ledger-service'
) as {
  recordPartnerTransaction: jest.Mock;
};

const { generateRefundNumber } = jest.requireMock(
  '@/lib/services/simple-order-number-generator'
) as {
  generateRefundNumber: jest.Mock;
};

type ReturnOrderRow = {
  id: string;
  returnNumber: string;
  status: string;
  remarks: string | null;
  refundAmount: unknown;
  totalAmount: unknown;
  salesOrderId: string | null;
  customerId: string;
  processType: string;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  processedAt?: Date | null;
  completedAt?: Date | null;
  updatedAt: Date;
};

type ReturnOrderItemRow = {
  id: string;
  returnOrderId: string;
  salesOrderItemId: string;
  subtotal: number;
};

type RefundRecordRow = {
  id: string;
  refundNumber: string;
  returnOrderId: string | null;
  returnOrderNumber: string | null;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  status: string;
  refundDate: Date;
  reason: string;
  remarks: string | null;
};

type SalesOrderRow = {
  id: string;
  itemsAmount: number;
  costAmount: number;
  profitAmount: number;
};

type InMemoryReturnStore = {
  returnOrdersById: Map<string, ReturnOrderRow>;
  returnOrderItemsById: Map<string, ReturnOrderItemRow>;
  refundRecordsById: Map<string, RefundRecordRow>;
  salesOrdersById: Map<string, SalesOrderRow>;
};

function clone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => clone(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clone(item);
  }
  return out as T;
}

function pickSelected(row: any, select: any) {
  if (!select) return clone(row);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      result[key] = row[key];
    }
  }
  return result;
}

function createInMemoryReturnPrisma(seed?: {
  returnOrders?: ReturnOrderRow[];
  returnOrderItems?: ReturnOrderItemRow[];
  refundRecords?: RefundRecordRow[];
  salesOrders?: SalesOrderRow[];
}) {
  const store: InMemoryReturnStore = {
    returnOrdersById: new Map(),
    returnOrderItemsById: new Map(),
    refundRecordsById: new Map(),
    salesOrdersById: new Map(),
  };

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  for (const order of seed?.returnOrders ?? []) {
    store.returnOrdersById.set(order.id, clone(order));
  }
  for (const item of seed?.returnOrderItems ?? []) {
    store.returnOrderItemsById.set(item.id, clone(item));
  }
  for (const refund of seed?.refundRecords ?? []) {
    store.refundRecordsById.set(refund.id, clone(refund));
  }
  for (const order of seed?.salesOrders ?? []) {
    store.salesOrdersById.set(order.id, clone(order));
  }

  const snapshotStore = () => ({
    returnOrdersById: new Map(
      Array.from(store.returnOrdersById.entries()).map(([k, v]) => [
        k,
        clone(v),
      ])
    ),
    returnOrderItemsById: new Map(
      Array.from(store.returnOrderItemsById.entries()).map(([k, v]) => [
        k,
        clone(v),
      ])
    ),
    refundRecordsById: new Map(
      Array.from(store.refundRecordsById.entries()).map(([k, v]) => [
        k,
        clone(v),
      ])
    ),
    salesOrdersById: new Map(
      Array.from(store.salesOrdersById.entries()).map(([k, v]) => [k, clone(v)])
    ),
  });

  const restoreSnapshot = (snapshot: ReturnType<typeof snapshotStore>) => {
    const restoreMap = (target: Map<any, any>, source: Map<any, any>) => {
      target.clear();
      for (const [k, v] of source.entries()) {
        target.set(k, clone(v));
      }
    };

    restoreMap(store.returnOrdersById, snapshot.returnOrdersById);
    restoreMap(store.returnOrderItemsById, snapshot.returnOrderItemsById);
    restoreMap(store.refundRecordsById, snapshot.refundRecordsById);
    restoreMap(store.salesOrdersById, snapshot.salesOrdersById);
  };

  const tx = {
    returnOrder: {
      update: async (args: any) => {
        const id = String(args?.where?.id ?? '');
        const row = store.returnOrdersById.get(id);
        if (!row) {
          throw new Error('NotFound');
        }

        const data = args?.data ?? {};
        const updated: ReturnOrderRow = {
          ...clone(row),
          status: data.status ?? row.status,
          remarks: data.remarks ?? row.remarks,
          refundAmount:
            data.refundAmount === undefined
              ? row.refundAmount
              : data.refundAmount,
          submittedAt:
            data.submittedAt === undefined ? row.submittedAt : data.submittedAt,
          approvedAt:
            data.approvedAt === undefined ? row.approvedAt : data.approvedAt,
          processedAt:
            data.processedAt === undefined ? row.processedAt : data.processedAt,
          completedAt:
            data.completedAt === undefined ? row.completedAt : data.completedAt,
          updatedAt: data.updatedAt ?? new Date(),
        };

        store.returnOrdersById.set(id, clone(updated));
        return pickSelected(updated, args?.select);
      },
    },

    returnOrderItem: {
      aggregate: async (args: any) => {
        const where = args?.where ?? {};
        const returnOrderId = where.returnOrderId as string | undefined;
        const sum = Array.from(store.returnOrderItemsById.values())
          .filter(item =>
            returnOrderId ? item.returnOrderId === returnOrderId : true
          )
          .reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0);
        return { _sum: { subtotal: sum } };
      },
    },

    refundRecord: {
      findFirst: async (args: any) => {
        const returnOrderId = args?.where?.returnOrderId as string | undefined;
        if (!returnOrderId) return null;
        const found = Array.from(store.refundRecordsById.values()).find(
          r => r.returnOrderId === returnOrderId
        );
        return found ? clone(found) : null;
      },

      update: async (args: any) => {
        const id = String(args?.where?.id ?? '');
        const row = store.refundRecordsById.get(id);
        if (!row) {
          throw new Error('NotFound');
        }
        const data = args?.data ?? {};
        const updated: RefundRecordRow = {
          ...clone(row),
          refundAmount:
            data.refundAmount === undefined
              ? row.refundAmount
              : Number(data.refundAmount),
          remainingAmount:
            data.remainingAmount === undefined
              ? row.remainingAmount
              : Number(data.remainingAmount),
          status: data.status ?? row.status,
        };
        store.refundRecordsById.set(id, clone(updated));
        return clone(updated);
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('refund'));
        const created: RefundRecordRow = {
          id,
          refundNumber: String(data.refundNumber),
          returnOrderId: data.returnOrderId ?? null,
          returnOrderNumber: data.returnOrderNumber ?? null,
          salesOrderId: String(data.salesOrderId),
          customerId: String(data.customerId),
          userId: String(data.userId),
          refundAmount: Number(data.refundAmount ?? 0),
          processedAmount: Number(data.processedAmount ?? 0),
          remainingAmount: Number(data.remainingAmount ?? 0),
          status: String(data.status ?? 'pending'),
          refundDate:
            data.refundDate instanceof Date
              ? data.refundDate
              : new Date(data.refundDate),
          reason: String(data.reason ?? ''),
          remarks: data.remarks ?? null,
        };
        store.refundRecordsById.set(id, clone(created));
        return clone(created);
      },
    },

    salesOrder: {
      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const row = store.salesOrdersById.get(id);
        if (!row) return null;
        return pickSelected(row, args?.select);
      },

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const row = store.salesOrdersById.get(id);
        if (!row) throw new Error('NotFound');
        const data = args?.data ?? {};
        const updated: SalesOrderRow = {
          ...clone(row),
          profitAmount:
            data.profitAmount === undefined
              ? row.profitAmount
              : Number(data.profitAmount),
        };
        store.salesOrdersById.set(id, clone(updated));
        return clone(updated);
      },
    },
  };

  const memPrisma: any = {
    ...tx,
    $transaction: async (fn: any, _options?: any) => {
      const snapshot = snapshotStore();
      const idSnapshot = nextId;
      try {
        return await fn(tx);
      } catch (error) {
        restoreSnapshot(snapshot);
        nextId = idSnapshot;
        throw error;
      }
    },
  };

  return { prisma: memPrisma, tx, store };
}

function resetPrisma(seed?: Parameters<typeof createInMemoryReturnPrisma>[0]) {
  const { prisma: memPrisma, tx, store } = createInMemoryReturnPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { tx, store };
}

describe('退货状态流转（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateRefundNumber.mockResolvedValue('RF-0001');
    recordPartnerTransaction.mockResolvedValue(undefined);
  });

  test('退款型退货完成：应创建退款记录、写入 sales_return 往来流水，并按比例回退原订单利润', async () => {
    const { tx, store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-1',
          returnNumber: 'RT-001',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-1',
          customerId: 'cust-1',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-1',
          returnOrderId: 'ro-1',
          salesOrderItemId: 'soi-1',
          subtotal: 10,
        },
      ],
      salesOrders: [
        {
          id: 'so-1',
          itemsAmount: 100,
          costAmount: 60,
          profitAmount: 40,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-1',
      'completed',
      'approved',
      'refund',
      { refundAmount: 10 },
      'user-1'
    );

    expect(result.refundCreated).toBe(true);

    const updatedOrder = store.returnOrdersById.get('ro-1');
    expect(updatedOrder?.status).toBe('completed');
    expect(Number(updatedOrder?.refundAmount ?? 0)).toBe(10);
    expect(updatedOrder?.completedAt).toBeInstanceOf(Date);

    expect(store.refundRecordsById.size).toBe(1);
    const refund = Array.from(store.refundRecordsById.values())[0]!;
    expect(refund.refundNumber).toBe('RF-0001');
    expect(refund.returnOrderId).toBe('ro-1');
    expect(refund.salesOrderId).toBe('so-1');
    expect(refund.customerId).toBe('cust-1');
    expect(refund.refundAmount).toBe(10);
    expect(refund.processedAmount).toBe(0);
    expect(refund.remainingAmount).toBe(10);
    expect(refund.status).toBe('pending');

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    const [ledgerInput, passedTx] = recordPartnerTransaction.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(passedTx).toBe(tx);
    expect(ledgerInput).toEqual(
      expect.objectContaining({
        partnerId: 'cust-1',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sales_return',
        amount: 10,
        referenceId: 'ro-1',
        referenceNumber: 'RT-001',
      })
    );

    const updatedSalesOrder = store.salesOrdersById.get('so-1');
    // refundRatio = 10/100 => returnCost=6 => profitDelta=4 => newProfit=36
    expect(updatedSalesOrder?.profitAmount).toBe(36);
  });

  test('提交后直达完成：应自动推断退款金额并生成应退货款 + 入账 + 利润回退', async () => {
    const { tx, store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-1b',
          returnNumber: 'RT-001B',
          status: 'submitted',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-1b',
          customerId: 'cust-1b',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-1b',
          returnOrderId: 'ro-1b',
          salesOrderItemId: 'soi-1b',
          subtotal: 12,
        },
      ],
      salesOrders: [
        {
          id: 'so-1b',
          itemsAmount: 120,
          costAmount: 60,
          profitAmount: 60,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-1b',
      'completed',
      'submitted',
      'refund',
      {},
      'user-1b'
    );

    expect(result.refundCreated).toBe(true);

    const updatedOrder = store.returnOrdersById.get('ro-1b');
    expect(updatedOrder?.status).toBe('completed');
    expect(Number(updatedOrder?.refundAmount ?? 0)).toBe(12);
    expect(updatedOrder?.completedAt).toBeInstanceOf(Date);

    expect(store.refundRecordsById.size).toBe(1);
    const refund = Array.from(store.refundRecordsById.values())[0]!;
    expect(refund.refundAmount).toBe(12);
    expect(refund.remainingAmount).toBe(12);

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    const [, passedTx] = recordPartnerTransaction.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(passedTx).toBe(tx);

    const updatedSalesOrder = store.salesOrdersById.get('so-1b');
    // refundRatio = 12/120 => returnCost=6 => profitDelta=6 => newProfit=54
    expect(updatedSalesOrder?.profitAmount).toBe(54);
  });

  test('退款金额缺失：应根据明细小计自动推断并回写到退货单 + 创建退款记录（approved）', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-2',
          returnNumber: 'RT-002',
          status: 'submitted',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-2',
          customerId: 'cust-2',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-2a',
          returnOrderId: 'ro-2',
          salesOrderItemId: 'soi-2a',
          subtotal: 6,
        },
        {
          id: 'roi-2b',
          returnOrderId: 'ro-2',
          salesOrderItemId: 'soi-2b',
          subtotal: 4,
        },
      ],
      salesOrders: [
        {
          id: 'so-2',
          itemsAmount: 0,
          costAmount: 0,
          profitAmount: 0,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-2',
      'approved',
      'submitted',
      'refund',
      {},
      'user-2'
    );

    expect(result.refundCreated).toBe(true);

    const updatedOrder = store.returnOrdersById.get('ro-2');
    expect(updatedOrder?.status).toBe('approved');
    expect(Number(updatedOrder?.refundAmount ?? 0)).toBe(10);

    expect(store.refundRecordsById.size).toBe(1);
    const refund = Array.from(store.refundRecordsById.values())[0]!;
    expect(refund.refundAmount).toBe(10);
    expect(refund.remainingAmount).toBe(10);

    // approved 阶段不应入账 sales_return，也不应调整利润
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });

  test('退款金额缺失且明细为0：应使用退货单总额兜底并生成退款记录', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-2b',
          returnNumber: 'RT-002B',
          status: 'submitted',
          remarks: null,
          refundAmount: 0,
          totalAmount: 15,
          salesOrderId: 'so-2b',
          customerId: 'cust-2b',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      salesOrders: [
        {
          id: 'so-2b',
          itemsAmount: 0,
          costAmount: 0,
          profitAmount: 0,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-2b',
      'approved',
      'submitted',
      'refund',
      {},
      'user-2b'
    );

    expect(result.refundCreated).toBe(true);
    expect(Number(store.returnOrdersById.get('ro-2b')?.refundAmount ?? 0)).toBe(
      15
    );

    expect(store.refundRecordsById.size).toBe(1);
    const refund = Array.from(store.refundRecordsById.values())[0]!;
    expect(refund.refundAmount).toBe(15);
    expect(refund.remainingAmount).toBe(15);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });

  test('退款型退货缺少 salesOrderId：应失败并回滚状态/应退货款', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-2c',
          returnNumber: 'RT-002C',
          status: 'submitted',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: null,
          customerId: 'cust-2c',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-2c',
          returnOrderId: 'ro-2c',
          salesOrderItemId: 'soi-2c',
          subtotal: 10,
        },
      ],
    });

    await expect(
      updateReturnOrderStatus(
        'ro-2c',
        'approved',
        'submitted',
        'refund',
        {},
        'user-2c'
      )
    ).rejects.toThrow('缺少关联的销售订单');

    expect(store.returnOrdersById.get('ro-2c')?.status).toBe('submitted');
    expect(store.refundRecordsById.size).toBe(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });

  test('已存在退款记录：应根据 processedAmount 自动修正 remainingAmount 与状态（processing）', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-3',
          returnNumber: 'RT-003',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-3',
          customerId: 'cust-3',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-3',
          returnOrderId: 'ro-3',
          salesOrderItemId: 'soi-3',
          subtotal: 10,
        },
      ],
      refundRecords: [
        {
          id: 'refund-3',
          refundNumber: 'RF-OLD',
          returnOrderId: 'ro-3',
          returnOrderNumber: 'RT-003',
          salesOrderId: 'so-3',
          customerId: 'cust-3',
          userId: 'user-3',
          refundAmount: 8,
          processedAmount: 5,
          remainingAmount: 3,
          status: 'pending',
          refundDate: new Date('2026-01-01T00:00:00.000Z'),
          reason: 'old',
          remarks: null,
        },
      ],
      salesOrders: [
        {
          id: 'so-3',
          itemsAmount: 100,
          costAmount: 50,
          profitAmount: 50,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-3',
      'processing',
      'approved',
      'refund',
      {},
      'user-3'
    );

    expect(result.refundCreated).toBe(false);

    const updatedRefund = store.refundRecordsById.get('refund-3')!;
    expect(updatedRefund.refundAmount).toBe(10);
    expect(updatedRefund.remainingAmount).toBe(5);
    expect(updatedRefund.status).toBe('processing');
  });

  test('已存在退款记录：processedAmount >= refundAmount 时应标记 completed 且 remaining=0', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-3b',
          returnNumber: 'RT-003B',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-3b',
          customerId: 'cust-3b',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-3b',
          returnOrderId: 'ro-3b',
          salesOrderItemId: 'soi-3b',
          subtotal: 10,
        },
      ],
      refundRecords: [
        {
          id: 'refund-3b',
          refundNumber: 'RF-3B',
          returnOrderId: 'ro-3b',
          returnOrderNumber: 'RT-003B',
          salesOrderId: 'so-3b',
          customerId: 'cust-3b',
          userId: 'user-3b',
          refundAmount: 8,
          processedAmount: 12,
          remainingAmount: 0,
          status: 'pending',
          refundDate: new Date('2026-01-01T00:00:00.000Z'),
          reason: 'seed',
          remarks: null,
        },
      ],
      salesOrders: [
        {
          id: 'so-3b',
          itemsAmount: 100,
          costAmount: 50,
          profitAmount: 50,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-3b',
      'processing',
      'approved',
      'refund',
      {},
      'user-3b'
    );

    expect(result.refundCreated).toBe(false);

    const updatedRefund = store.refundRecordsById.get('refund-3b')!;
    expect(updatedRefund.refundAmount).toBe(10);
    expect(updatedRefund.remainingAmount).toBe(0);
    expect(updatedRefund.status).toBe('completed');
  });

  test('已存在退款记录：rejected/cancelled 状态应保持不被自动重开', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-3c',
          returnNumber: 'RT-003C',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-3c',
          customerId: 'cust-3c',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-3c',
          returnOrderId: 'ro-3c',
          salesOrderItemId: 'soi-3c',
          subtotal: 10,
        },
      ],
      refundRecords: [
        {
          id: 'refund-3c',
          refundNumber: 'RF-3C',
          returnOrderId: 'ro-3c',
          returnOrderNumber: 'RT-003C',
          salesOrderId: 'so-3c',
          customerId: 'cust-3c',
          userId: 'user-3c',
          refundAmount: 8,
          processedAmount: 0,
          remainingAmount: 8,
          status: 'rejected',
          refundDate: new Date('2026-01-01T00:00:00.000Z'),
          reason: 'seed',
          remarks: null,
        },
      ],
      salesOrders: [
        {
          id: 'so-3c',
          itemsAmount: 100,
          costAmount: 50,
          profitAmount: 50,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-3c',
      'processing',
      'approved',
      'refund',
      {},
      'user-3c'
    );

    expect(result.refundCreated).toBe(false);

    const updatedRefund = store.refundRecordsById.get('refund-3c')!;
    expect(updatedRefund.refundAmount).toBe(10);
    expect(updatedRefund.remainingAmount).toBe(10);
    expect(updatedRefund.status).toBe('rejected');
  });

  test('退款金额为0：允许完成但不生成应退货款/不入账/不回退利润', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-3d',
          returnNumber: 'RT-003D',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-3d',
          customerId: 'cust-3d',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      salesOrders: [
        {
          id: 'so-3d',
          itemsAmount: 100,
          costAmount: 60,
          profitAmount: 40,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-3d',
      'completed',
      'approved',
      'refund',
      {},
      'user-3d'
    );

    expect(result.refundCreated).toBe(false);
    expect(store.returnOrdersById.get('ro-3d')?.status).toBe('completed');
    expect(store.refundRecordsById.size).toBe(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
    expect(store.salesOrdersById.get('so-3d')?.profitAmount).toBe(40);
  });

  test('换货型退货：状态流转不应触发退款记录/往来账/利润回退', async () => {
    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-4',
          returnNumber: 'RT-004',
          status: 'submitted',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-4',
          customerId: 'cust-4',
          processType: 'exchange',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-4',
          returnOrderId: 'ro-4',
          salesOrderItemId: 'soi-4',
          subtotal: 10,
        },
      ],
      salesOrders: [
        {
          id: 'so-4',
          itemsAmount: 100,
          costAmount: 60,
          profitAmount: 40,
        },
      ],
    });

    const result = await updateReturnOrderStatus(
      'ro-4',
      'completed',
      'submitted',
      'exchange',
      {},
      'user-4'
    );

    expect(result.refundCreated).toBe(false);
    expect(store.refundRecordsById.size).toBe(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
    expect(store.salesOrdersById.get('so-4')?.profitAmount).toBe(40);
  });

  test('退货完成入账失败：应回滚退货状态与退款记录变更', async () => {
    recordPartnerTransaction.mockRejectedValueOnce(new Error('ledger fail'));

    const { store } = resetPrisma({
      returnOrders: [
        {
          id: 'ro-5',
          returnNumber: 'RT-005',
          status: 'approved',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-5',
          customerId: 'cust-5',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      returnOrderItems: [
        {
          id: 'roi-5',
          returnOrderId: 'ro-5',
          salesOrderItemId: 'soi-5',
          subtotal: 10,
        },
      ],
      salesOrders: [
        {
          id: 'so-5',
          itemsAmount: 100,
          costAmount: 60,
          profitAmount: 40,
        },
      ],
    });

    await expect(
      updateReturnOrderStatus(
        'ro-5',
        'completed',
        'approved',
        'refund',
        { refundAmount: 10 },
        'user-5'
      )
    ).rejects.toThrow('退货完成后同步往来账失败');

    // rollback: 状态、退款记录、利润都不应变更
    expect(store.returnOrdersById.get('ro-5')?.status).toBe('approved');
    expect(store.refundRecordsById.size).toBe(0);
    expect(store.salesOrdersById.get('so-5')?.profitAmount).toBe(40);
  });

  test('非法状态流转：应直接失败且不进入事务', async () => {
    resetPrisma({
      returnOrders: [
        {
          id: 'ro-6',
          returnNumber: 'RT-006',
          status: 'draft',
          remarks: null,
          refundAmount: 0,
          totalAmount: 0,
          salesOrderId: 'so-6',
          customerId: 'cust-6',
          processType: 'refund',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      updateReturnOrderStatus(
        'ro-6',
        'completed',
        'draft',
        'refund',
        {},
        'user-6'
      )
    ).rejects.toThrow('订单状态不能从 draft 变更为 completed');
  });
});
