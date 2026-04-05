import { updateReturnOrderStatus } from '@/lib/api/handlers/return-order-status';
import { createSalesOrder } from '@/lib/api/handlers/sales-orders/create';

jest.mock('@/app/actions/return-orders.utils', () => {
  const actual = jest.requireActual('@/app/actions/return-orders.utils');
  return {
    ...actual,
    applyCompletionEffects: jest.fn().mockImplementation(
      async (
        _tx: unknown,
        returnOrder: {
          items: Array<{ productId: string }>;
        }
      ) =>
        returnOrder.items.map(item => ({
          productId: item.productId,
        }))
    ),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => {
  const actual = jest.requireActual('@/lib/env');
  return {
    ...actual,
    env: {
      ...(actual as any).env,
      EXPENSE_AUTO_CREATE: false,
    },
  };
});

jest.mock('@/lib/db/transaction-options', () => ({
  getLongTransactionOptions: jest.fn(() => ({})),
}));

jest.mock('@/lib/cache/invalidation-strategy', () => ({
  executeInvalidation: jest.fn().mockResolvedValue(undefined),
  ORDER_STATUS_CHANGE_INVALIDATION: { key: 'ORDER_STATUS_CHANGE_INVALIDATION' },
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/simple-order-number-generator', () => ({
  generateSalesOrderNumber: jest.fn(),
  generateRefundNumber: jest.fn(),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentNumber: jest.fn().mockResolvedValue('PAY-0001'),
}));

jest.mock('@/lib/services/expense-service', () => ({
  ensureCompanyExpenses: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/price-history', () => ({
  recordCustomerPriceHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/payable', () => ({
  maybeCreatePayable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/purchase-order', () => ({
  createPurchaseOrderForTransfer: jest.fn(),
}));

jest.mock('@/lib/api/handlers/sales-orders/prepayment', () => ({
  applyPrepaymentToOrder: jest.fn().mockResolvedValue({ totalApplied: 0 }),
}));

jest.mock('@/lib/api/handlers/sales-orders/validation', () => ({
  ensureCustomerExists: jest.fn().mockResolvedValue(undefined),
  ensureSupplierExists: jest.fn().mockResolvedValue(undefined),
  ensureProductsExist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/inventory', () => ({
  shouldReserveInventory: jest.fn(() => false),
  reserveInventory: jest.fn(),
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

const { generateSalesOrderNumber, generateRefundNumber } = jest.requireMock(
  '@/lib/services/simple-order-number-generator'
) as {
  generateSalesOrderNumber: jest.Mock;
  generateRefundNumber: jest.Mock;
};

type ProductRow = {
  id: string;
  name: string;
  code: string;
  unit: string;
  specification: string | null;
  piecesPerUnit: number;
  weight: number | null;
};

type SalesOrderRow = {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  supplierId: string | null;
  status: string;
  orderType: string;
  transferMode: string;
  itemsAmount: number;
  additionalFees: number;
  expenseAmount: number;
  roundingAdjustment: number;
  costAmount: number;
  profitAmount: number;
  totalAmount: number;
  paidAmount: number;
  remarks: string | null;
  shippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  user: {
    id: string;
    name: string;
  };
  items: any[];
  feeItems: any[];
  _count: { items: number };
};

type PaymentRecordRow = {
  id: string;
  paymentNumber: string;
  salesOrderId: string;
  customerId: string;
  userId: string;
  paymentType: string;
  paymentMethod: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  appliedAmount: number;
  paymentDate: Date;
  status: string;
  remarks: string | null;
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
  damagedQuantity?: number | null;
  id: string;
  productId?: string;
  returnOrderId: string;
  returnQuantity?: number;
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

type InMemoryStore = {
  productsById: Map<string, ProductRow>;
  salesOrdersById: Map<string, SalesOrderRow>;
  paymentRecordsById: Map<string, PaymentRecordRow>;
  returnOrdersById: Map<string, ReturnOrderRow>;
  returnOrderItemsById: Map<string, ReturnOrderItemRow>;
  refundRecordsById: Map<string, RefundRecordRow>;
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

function createInMemoryPrisma(seed?: {
  products?: ProductRow[];
  salesOrders?: SalesOrderRow[];
  paymentRecords?: PaymentRecordRow[];
  returnOrders?: ReturnOrderRow[];
  returnOrderItems?: ReturnOrderItemRow[];
  refundRecords?: RefundRecordRow[];
}) {
  const store: InMemoryStore = {
    productsById: new Map(),
    salesOrdersById: new Map(),
    paymentRecordsById: new Map(),
    returnOrdersById: new Map(),
    returnOrderItemsById: new Map(),
    refundRecordsById: new Map(),
  };

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  for (const product of seed?.products ?? []) {
    store.productsById.set(product.id, clone(product));
  }
  for (const order of seed?.salesOrders ?? []) {
    store.salesOrdersById.set(order.id, clone(order));
  }
  for (const payment of seed?.paymentRecords ?? []) {
    store.paymentRecordsById.set(payment.id, clone(payment));
  }
  for (const order of seed?.returnOrders ?? []) {
    store.returnOrdersById.set(order.id, clone(order));
  }
  for (const item of seed?.returnOrderItems ?? []) {
    store.returnOrderItemsById.set(item.id, clone(item));
  }
  for (const refund of seed?.refundRecords ?? []) {
    store.refundRecordsById.set(refund.id, clone(refund));
  }

  const snapshotStore = () => ({
    productsById: new Map(
      Array.from(store.productsById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    salesOrdersById: new Map(
      Array.from(store.salesOrdersById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    paymentRecordsById: new Map(
      Array.from(store.paymentRecordsById.entries()).map(([k, v]) => [
        k,
        clone(v),
      ])
    ),
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
  });

  const restoreSnapshot = (snapshot: ReturnType<typeof snapshotStore>) => {
    const restoreMap = (target: Map<any, any>, source: Map<any, any>) => {
      target.clear();
      for (const [k, v] of source.entries()) {
        target.set(k, clone(v));
      }
    };

    restoreMap(store.productsById, snapshot.productsById);
    restoreMap(store.salesOrdersById, snapshot.salesOrdersById);
    restoreMap(store.paymentRecordsById, snapshot.paymentRecordsById);
    restoreMap(store.returnOrdersById, snapshot.returnOrdersById);
    restoreMap(store.returnOrderItemsById, snapshot.returnOrderItemsById);
    restoreMap(store.refundRecordsById, snapshot.refundRecordsById);
  };

  const tx = {
    salesOrder: {
      create: async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('so'));
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        const updatedAt = new Date('2026-01-01T00:00:00.000Z');

        const itemsCreate = (data?.items?.create ?? []) as any[];
        const items = itemsCreate.map((item, index) => ({
          ...clone(item),
          id: `soi-${index + 1}`,
          salesOrderId: id,
        }));

        const feeItemsCreate = (data?.feeItems?.create ?? []) as any[];
        const feeItems = feeItemsCreate.map((fee, index) => ({
          id: `sof-${index + 1}`,
          ...clone(fee),
        }));

        const order: SalesOrderRow = {
          id,
          orderNumber: String(data.orderNumber ?? ''),
          customerId: String(data.customerId ?? ''),
          userId: String(data.userId ?? ''),
          supplierId: data.supplierId ?? null,
          status: String(data.status ?? 'draft'),
          orderType: String(data.orderType ?? 'NORMAL'),
          transferMode: String(data.transferMode ?? 'SUPPLIER_ONLY'),
          itemsAmount: Number(data.itemsAmount ?? 0),
          additionalFees: Number(data.additionalFees ?? 0),
          expenseAmount: Number(data.expenseAmount ?? 0),
          roundingAdjustment: Number(data.roundingAdjustment ?? 0),
          costAmount: Number(data.costAmount ?? 0),
          profitAmount: Number(data.profitAmount ?? 0),
          totalAmount: Number(data.totalAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          remarks: data.remarks ?? null,
          shippedAt: null,
          createdAt,
          updatedAt,
          customer: {
            id: String(data.customerId ?? ''),
            name: 'Customer A',
            address: 'addr',
            phone: '13000000000',
          },
          user: {
            id: String(data.userId ?? ''),
            name: 'User A',
          },
          items,
          feeItems,
          _count: { items: items.length },
        };

        store.salesOrdersById.set(id, clone(order));
        return pickSelected(order, args?.select);
      },

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
          paidAmount:
            data.paidAmount === undefined
              ? row.paidAmount
              : Number(data.paidAmount),
          profitAmount:
            data.profitAmount === undefined
              ? row.profitAmount
              : Number(data.profitAmount),
          updatedAt: data.updatedAt ?? new Date(),
        };

        store.salesOrdersById.set(id, clone(updated));
        return pickSelected(updated, args?.select);
      },
    },

    paymentRecord: {
      create: async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('pay'));
        const created: PaymentRecordRow = {
          id,
          paymentNumber: String(data.paymentNumber ?? ''),
          salesOrderId: String(data.salesOrderId ?? ''),
          customerId: String(data.customerId ?? ''),
          userId: String(data.userId ?? ''),
          paymentType: String(data.paymentType ?? ''),
          paymentMethod: String(data.paymentMethod ?? ''),
          paymentAmount: Number(data.paymentAmount ?? 0),
          actualPaymentAmount: Number(data.actualPaymentAmount ?? 0),
          roundingAmount: Number(data.roundingAmount ?? 0),
          appliedAmount: Number(data.appliedAmount ?? 0),
          paymentDate:
            data.paymentDate instanceof Date
              ? data.paymentDate
              : new Date(data.paymentDate),
          status: String(data.status ?? 'pending'),
          remarks: data.remarks ?? null,
        };
        store.paymentRecordsById.set(id, clone(created));
        return clone(created);
      },
    },

    returnOrder: {
      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const row = store.returnOrdersById.get(id);
        if (!row) return null;

        const items = Array.from(store.returnOrderItemsById.values())
          .filter(item => item.returnOrderId === id)
          .map(item => ({
            damagedQuantity: item.damagedQuantity ?? 0,
            productId: item.productId ?? `prod-${item.salesOrderItemId}`,
            returnQuantity: item.returnQuantity ?? 1,
            salesOrderItemId: item.salesOrderItemId,
            subtotal: item.subtotal,
          }));

        if (!args?.select?.items) {
          return pickSelected(row, args?.select);
        }

        const result = pickSelected(row, {
          ...args.select,
          items: false,
        }) as Record<string, unknown>;
        result.items = items;
        return result;
      },

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

    salesOrderItem: {
      findMany: async (args: any) => {
        const ids = (args?.where?.id?.in ?? []) as string[];
        return ids.map(id => ({
          batchNumber: null,
          id,
        }));
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
  };

  const memPrisma: any = {
    ...tx,
    product: {
      findMany: async (args: any) => {
        const ids = (args?.where?.id?.in ?? []) as string[];
        const found = ids
          .map(id => store.productsById.get(id))
          .filter(Boolean)
          .map(row => ({
            id: row!.id,
            name: row!.name,
            code: row!.code,
            unit: row!.unit,
            specification: row!.specification,
            piecesPerUnit: row!.piecesPerUnit,
            weight: row!.weight,
          }));
        return clone(found);
      },
    },
    $transaction: async (fn: any, _options?: any) => {
      if (typeof fn !== 'function') {
        throw new Error('Only callback transaction supported in tests');
      }
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

function resetPrisma(seed?: Parameters<typeof createInMemoryPrisma>[0]) {
  const { prisma: memPrisma, tx, store } = createInMemoryPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { tx, store };
}

describe('销售订单 × 退货订单（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateSalesOrderNumber.mockResolvedValue('SO-0001');
    generateRefundNumber.mockResolvedValue('RF-0001');
    recordPartnerTransaction.mockResolvedValue(undefined);
  });

  test('confirmed 销售开单后完成退款型退货：应创建应收/应退+两笔往来流水，并按比例回退原订单利润', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';

    const { tx, store } = resetPrisma({
      products: [
        {
          id: productId,
          name: 'P1',
          code: 'P1',
          unit: '片',
          specification: 'spec',
          piecesPerUnit: 1,
          weight: null,
        },
      ],
    });

    const order = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            colorCode: 'C01',
            quantity: 10,
            unitPrice: 10,
            subtotal: 100,
            unitCost: 6,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(order.orderNumber).toBe('SO-0001');
    expect(order.itemsAmount).toBe(100);
    expect(order.costAmount).toBe(60);
    expect(order.profitAmount).toBe(40);
    expect(order.totalAmount).toBe(100);

    expect(store.paymentRecordsById.size).toBe(1);
    const payment = Array.from(store.paymentRecordsById.values())[0]!;
    expect(payment.paymentNumber).toBe('PAY-0001');
    expect(payment.salesOrderId).toBe(order.id);
    expect(payment.paymentAmount).toBe(100);

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction.mock.calls[0]!.length).toBe(1);
    expect(recordPartnerTransaction.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        partnerId: customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 100,
        referenceId: order.id,
        referenceNumber: 'SO-0001',
      })
    );

    store.returnOrdersById.set('ro-1', {
      id: 'ro-1',
      returnNumber: 'RT-001',
      status: 'approved',
      remarks: null,
      refundAmount: 0,
      totalAmount: 0,
      salesOrderId: order.id,
      customerId,
      processType: 'refund',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    store.returnOrderItemsById.set('roi-1', {
      id: 'roi-1',
      returnOrderId: 'ro-1',
      salesOrderItemId: 'soi-1',
      subtotal: 25,
    });

    const result = await updateReturnOrderStatus(
      'ro-1',
      'completed',
      'approved',
      'refund',
      { refundAmount: 25 },
      userId
    );

    expect(result.refundCreated).toBe(true);
    expect(store.refundRecordsById.size).toBe(1);
    const refund = Array.from(store.refundRecordsById.values())[0]!;
    expect(refund.refundNumber).toBe('RF-0001');
    expect(refund.salesOrderId).toBe(order.id);
    expect(refund.customerId).toBe(customerId);
    expect(refund.refundAmount).toBe(25);
    expect(refund.remainingAmount).toBe(25);
    expect(refund.status).toBe('pending');

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(2);
    expect(recordPartnerTransaction.mock.calls[1]!.length).toBe(2);
    const [returnLedger, passedTx] = recordPartnerTransaction.mock.calls[1] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(passedTx).toBe(tx);
    expect(returnLedger).toEqual(
      expect.objectContaining({
        partnerId: customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sales_return',
        amount: 25,
        referenceId: 'ro-1',
        referenceNumber: 'RT-001',
      })
    );

    const updatedSalesOrder = store.salesOrdersById.get(order.id);
    // refundRatio = 25/100 => returnCost=15 => profitDelta=10 => newProfit=30
    expect(updatedSalesOrder?.profitAmount).toBe(30);
  });

  test('退款金额缺失：approved 阶段不自动生成退款记录；completed 阶段统一生成并入账', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';

    const { store } = resetPrisma({
      products: [
        {
          id: productId,
          name: 'P1',
          code: 'P1',
          unit: '片',
          specification: 'spec',
          piecesPerUnit: 1,
          weight: null,
        },
      ],
    });

    const order = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            colorCode: 'C01',
            quantity: 10,
            unitPrice: 10,
            subtotal: 100,
            unitCost: 6,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);

    store.returnOrdersById.set('ro-2', {
      id: 'ro-2',
      returnNumber: 'RT-002',
      status: 'submitted',
      remarks: null,
      refundAmount: 0,
      totalAmount: 0,
      salesOrderId: order.id,
      customerId,
      processType: 'refund',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    store.returnOrderItemsById.set('roi-2a', {
      id: 'roi-2a',
      returnOrderId: 'ro-2',
      salesOrderItemId: 'soi-1',
      subtotal: 6,
    });
    store.returnOrderItemsById.set('roi-2b', {
      id: 'roi-2b',
      returnOrderId: 'ro-2',
      salesOrderItemId: 'soi-1',
      subtotal: 4,
    });

    const approved = await updateReturnOrderStatus(
      'ro-2',
      'approved',
      'submitted',
      'refund',
      {},
      userId
    );

    expect(approved.refundCreated).toBe(false);
    expect(generateRefundNumber).toHaveBeenCalledTimes(0);
    expect(store.refundRecordsById.size).toBe(0);
    expect(Number(store.returnOrdersById.get('ro-2')?.refundAmount ?? 0)).toBe(0);
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(store.salesOrdersById.get(order.id)?.profitAmount).toBe(40);

    const completed = await updateReturnOrderStatus(
      'ro-2',
      'completed',
      'approved',
      'refund',
      {},
      userId
    );

    expect(completed.refundCreated).toBe(true);
    expect(generateRefundNumber).toHaveBeenCalledTimes(1);
    expect(store.refundRecordsById.size).toBe(1);
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(2);

    const updatedSalesOrder = store.salesOrdersById.get(order.id);
    // refundRatio = 10/100 => returnCost=6 => profitDelta=4 => newProfit=36
    expect(updatedSalesOrder?.profitAmount).toBe(36);
  });
});
