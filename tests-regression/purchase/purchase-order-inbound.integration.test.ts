import { PURCHASE_ORDER_STATUS } from '@/lib/types/purchase-order';

jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      public readonly body: unknown,
      public readonly status: number
    ) {}

    async json() {
      return this.body;
    }
  }

  return {
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('@/lib/api/middleware', () => ({
  resolveParams: async (params: any) => params,
}));

jest.mock('@/lib/utils/idempotency', () => ({
  checkIdempotency: jest.fn(async () => ({ isNew: true })),
  withIdempotency: jest.fn(
    async (_key: any, _type: any, _id: any, _user: any, _meta: any, fn: any) =>
      fn()
  ),
}));

jest.mock('@/lib/cache', () => ({
  revalidateProducts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  invalidateInventoryCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/purchase-orders/fulfillment', () => ({
  refreshPurchaseOrderFulfillment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePayableNumber: jest
    .fn()
    .mockResolvedValueOnce('PAY-0001')
    .mockResolvedValueOnce('PAY-0002')
    .mockResolvedValue('PAY-000X'),
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

type Store = {
  productsById: Map<
    string,
    { id: string; name: string; code: string; unit: string }
  >;
  usersById: Map<string, { id: string; name: string }>;
  purchaseOrdersById: Map<string, any>;
  purchaseOrderItemsById: Map<string, any>;
  purchaseOrderItemIdsByOrderId: Map<string, string[]>;
  expenseRecords: Array<{
    id: string;
    relatedType: string;
    relatedId: string;
    supplierId: string | null;
    expenseAmount: number;
    voidedAt: Date | null;
  }>;
  payableRecords: any[];
  inboundRecordsById: Map<string, any>;
  inventoryById: Map<string, any>;
  inventoryIdByKey: Map<string, string>;
  fifoById: Map<string, any>;
};

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clone(item);
  }
  return out as T;
}

function inventoryKey(params: {
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
}) {
  return `${params.productId}::${params.variantId ?? 'null'}::${params.batchNumber ?? 'null'}`;
}

function createInMemoryPurchaseInboundTx(seed?: {
  products?: Array<{ id: string; name: string; code: string; unit: string }>;
  users?: Array<{ id: string; name: string }>;
  purchaseOrders?: Array<any>;
  purchaseOrderItems?: Array<any>;
  expenseRecords?: Array<any>;
  payableRecords?: Array<any>;
  inboundRecords?: Array<any>;
  inventories?: Array<any>;
  fifoQueue?: Array<any>;
}) {
  const store: Store = {
    productsById: new Map(),
    usersById: new Map(),
    purchaseOrdersById: new Map(),
    purchaseOrderItemsById: new Map(),
    purchaseOrderItemIdsByOrderId: new Map(),
    expenseRecords: [],
    payableRecords: [],
    inboundRecordsById: new Map(),
    inventoryById: new Map(),
    inventoryIdByKey: new Map(),
    fifoById: new Map(),
  };

  for (const p of seed?.products ?? []) store.productsById.set(p.id, clone(p));
  for (const u of seed?.users ?? []) store.usersById.set(u.id, clone(u));

  for (const order of seed?.purchaseOrders ?? []) {
    store.purchaseOrdersById.set(order.id, clone(order));
  }

  for (const raw of seed?.purchaseOrderItems ?? []) {
    const item = clone(raw);
    store.purchaseOrderItemsById.set(item.id, item);
    const list =
      store.purchaseOrderItemIdsByOrderId.get(item.purchaseOrderId) ?? [];
    list.push(item.id);
    store.purchaseOrderItemIdsByOrderId.set(item.purchaseOrderId, list);
  }

  store.expenseRecords.push(
    ...(seed?.expenseRecords ?? []).map((e: any) => clone(e))
  );
  store.payableRecords.push(
    ...(seed?.payableRecords ?? []).map((p: any) => clone(p))
  );

  for (const raw of seed?.inboundRecords ?? []) {
    store.inboundRecordsById.set(raw.id, clone(raw));
  }

  for (const raw of seed?.inventories ?? []) {
    const inv = clone(raw);
    store.inventoryById.set(inv.id, inv);
    store.inventoryIdByKey.set(
      inventoryKey({
        productId: inv.productId,
        variantId: inv.variantId ?? null,
        batchNumber: inv.batchNumber ?? null,
      }),
      inv.id
    );
  }

  for (const raw of seed?.fifoQueue ?? []) {
    store.fifoById.set(raw.id, clone(raw));
  }

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  const tx = {
    purchaseOrder: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const order = store.purchaseOrdersById.get(id);
        if (!order) return null;

        if (args?.include?.items?.select) {
          const itemIds = store.purchaseOrderItemIdsByOrderId.get(id) ?? [];
          const items = itemIds
            .map(itemId => store.purchaseOrderItemsById.get(itemId))
            .filter(Boolean)
            .map(row => ({
              id: row.id,
              productId: row.productId ?? null,
              quantity: row.quantity ?? 0,
              unitPrice: row.unitPrice ?? null,
              unitCostWithExpense: row.unitCostWithExpense ?? null,
              batchNumber: row.batchNumber ?? null,
            }));

          return clone({ ...order, items });
        }

        if (args?.select) {
          const selected: any = { id: order.id };
          if (args.select.expenseAmount)
            selected.expenseAmount = order.expenseAmount ?? 0;
          if (args.select.items?.select) {
            const itemIds = store.purchaseOrderItemIdsByOrderId.get(id) ?? [];
            selected.items = itemIds
              .map(itemId => store.purchaseOrderItemsById.get(itemId))
              .filter(Boolean)
              .map(row => ({
                id: row.id,
                quantity: row.quantity ?? 0,
                unitPrice: row.unitPrice ?? 0,
              }));
          }
          return clone(selected);
        }

        return clone(order);
      }),

      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const existing = store.purchaseOrdersById.get(id);
        if (!existing) throw new Error('NotFound');
        const data = args?.data ?? {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        store.purchaseOrdersById.set(id, updated);
        return clone(updated);
      }),

      updateMany: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return { count: 0 };
        const existing = store.purchaseOrdersById.get(id);
        if (!existing) return { count: 0 };
        const expectedStatus = args?.where?.status as string | undefined;
        if (expectedStatus !== undefined && existing.status !== expectedStatus) {
          return { count: 0 };
        }
        const data = args?.data ?? {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        store.purchaseOrdersById.set(id, updated);
        return { count: 1 };
      }),
    },

    purchaseOrderItem: {
      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const existing = store.purchaseOrderItemsById.get(id);
        if (!existing) throw new Error('NotFound');
        const updated = { ...existing, ...(args?.data ?? {}) };
        store.purchaseOrderItemsById.set(id, updated);
        return clone(updated);
      }),

      groupBy: jest.fn(async (args: any) => {
        const by = args?.by ?? [];
        if (!Array.isArray(by) || !by.includes('supplierId')) {
          throw new Error('UnsupportedGroupBy');
        }
        const orderId = args?.where?.purchaseOrderId as string | undefined;
        const groups = new Map<string, number>();
        for (const row of store.purchaseOrderItemsById.values()) {
          if (orderId && row.purchaseOrderId !== orderId) continue;
          const supplierId = row.supplierId as string | undefined;
          if (!supplierId) continue;
          const amount = Number(row.totalPrice ?? 0);
          groups.set(supplierId, (groups.get(supplierId) ?? 0) + amount);
        }

        return Array.from(groups.entries()).map(([supplierId, sum]) => ({
          supplierId,
          _sum: { totalPrice: sum },
        }));
      }),
    },

    expenseRecord: {
      aggregate: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        let sum = 0;
        for (const row of store.expenseRecords) {
          if (
            where.relatedType !== undefined &&
            row.relatedType !== where.relatedType
          )
            continue;
          if (
            where.relatedId !== undefined &&
            row.relatedId !== where.relatedId
          )
            continue;
          if (where.voidedAt === null && row.voidedAt !== null) continue;
          sum += Number(row.expenseAmount ?? 0);
        }
        return { _sum: { expenseAmount: sum } };
      }),

      groupBy: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const groups = new Map<string, number>();
        for (const row of store.expenseRecords) {
          if (
            where.relatedType !== undefined &&
            row.relatedType !== where.relatedType
          )
            continue;
          if (
            where.relatedId !== undefined &&
            row.relatedId !== where.relatedId
          )
            continue;
          if (where.supplierId?.not === null && row.supplierId === null)
            continue;
          const supplierId = row.supplierId;
          if (!supplierId) continue;
          const amount = Number(row.expenseAmount ?? 0);
          groups.set(supplierId, (groups.get(supplierId) ?? 0) + amount);
        }
        return Array.from(groups.entries()).map(([supplierId, sum]) => ({
          supplierId,
          _sum: { expenseAmount: sum },
        }));
      }),
    },

    payableRecord: {
      findMany: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const sourceType = where.sourceType as string | undefined;
        const sourceId = where.sourceId as string | undefined;
        const rows = store.payableRecords.filter(row => {
          if (sourceType !== undefined && row.sourceType !== sourceType)
            return false;
          if (sourceId !== undefined && row.sourceId !== sourceId) return false;
          return true;
        });
        return rows.map(row => ({ supplierId: row.supplierId }));
      }),

      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('payable'));
        const createdAt = new Date();
        const record = {
          id,
          payableNumber: String(data.payableNumber),
          supplierId: String(data.supplierId),
          userId: String(data.userId),
          sourceType: String(data.sourceType),
          sourceId: String(data.sourceId),
          sourceNumber: String(data.sourceNumber),
          payableAmount: Number(data.payableAmount ?? 0),
          paidAmount: Number(data.paidAmount ?? 0),
          remainingAmount: Number(data.remainingAmount ?? 0),
          dueDate:
            data.dueDate instanceof Date
              ? data.dueDate
              : new Date(data.dueDate),
          status: String(data.status),
          paymentTerms: data.paymentTerms ?? null,
          remarks: data.remarks ?? null,
          createdAt,
        };
        store.payableRecords.push(clone(record));
        return clone({
          id: record.id,
          createdAt: record.createdAt,
          dueDate: record.dueDate,
        });
      }),
    },

    inboundRecord: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('inb'));
        const createdAt = new Date();
        const updatedAt = new Date();
        const record = {
          id,
          recordNumber: String(data.recordNumber),
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          batchSpecificationId: data.batchSpecificationId ?? null,
          quantity: Number(data.quantity ?? 0),
          unitCost: Number(data.unitCost ?? 0),
          totalCost: Number(data.totalCost ?? 0),
          reason: String(data.reason),
          remarks: data.remarks ?? null,
          userId: String(data.userId),
          purchaseOrderId: data.purchaseOrderId ?? null,
          purchaseOrderItemId: data.purchaseOrderItemId ?? null,
          supplierId: data.supplierId ?? null,
          createdAt,
          updatedAt,
        };
        store.inboundRecordsById.set(id, clone(record));

        const product = store.productsById.get(record.productId);
        const user = store.usersById.get(record.userId);
        if (!product) throw new Error('MissingProductSeed');
        if (!user) throw new Error('MissingUserSeed');

        return {
          ...clone(record),
          product: clone(product),
          user: clone(user),
        };
      }),

      groupBy: jest.fn(async (args: any) => {
        const by = args?.by ?? [];
        if (!Array.isArray(by) || !by.includes('purchaseOrderItemId')) {
          throw new Error('UnsupportedGroupBy');
        }
        const where = args?.where ?? {};
        const purchaseOrderId = where.purchaseOrderId as string | undefined;
        const inIds = where.purchaseOrderItemId?.in as string[] | undefined;

        const sumByItem = new Map<string, number>();
        for (const rec of store.inboundRecordsById.values()) {
          if (purchaseOrderId && rec.purchaseOrderId !== purchaseOrderId)
            continue;
          const itemId = rec.purchaseOrderItemId as string | null;
          if (!itemId) continue;
          if (Array.isArray(inIds) && !inIds.includes(itemId)) continue;
          sumByItem.set(
            itemId,
            (sumByItem.get(itemId) ?? 0) + Number(rec.quantity ?? 0)
          );
        }

        return Array.from(sumByItem.entries()).map(
          ([purchaseOrderItemId, sum]) => ({
            purchaseOrderItemId,
            _sum: { quantity: sum },
          })
        );
      }),
    },

    inventoryCostQueue: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('q'));
        const row = {
          id,
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          inboundRecordId: String(data.inboundRecordId),
          remainingQty: Number(data.remainingQty ?? 0),
          unitCost: Number(data.unitCost ?? 0),
          inboundDate:
            data.inboundDate instanceof Date
              ? data.inboundDate
              : new Date(data.inboundDate),
          updatedAt: new Date(),
        };
        store.fifoById.set(id, clone(row));
        return clone(row);
      }),
    },

    inventory: {
      findFirst: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const key = inventoryKey({
          productId: String(where.productId),
          variantId: where.variantId ?? null,
          batchNumber: where.batchNumber ?? null,
        });
        const id = store.inventoryIdByKey.get(key);
        if (!id) return null;
        return clone(store.inventoryById.get(id));
      }),

      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const existing = store.inventoryById.get(id);
        if (!existing) throw new Error('NotFound');
        const data = args?.data ?? {};

        const next = { ...existing };
        if (data.quantity?.increment !== undefined) {
          next.quantity =
            Number(next.quantity ?? 0) + Number(data.quantity.increment ?? 0);
        } else if (data.quantity !== undefined) {
          next.quantity = Number(data.quantity ?? 0);
        }
        if (data.unitCost !== undefined) {
          next.unitCost = data.unitCost;
        }
        if (data.updatedAt !== undefined) {
          next.updatedAt = data.updatedAt;
        }

        store.inventoryById.set(id, next);
        return clone(next);
      }),

      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('inv'));
        const record = {
          id,
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          quantity: Number(data.quantity ?? 0),
          reservedQuantity: Number(data.reservedQuantity ?? 0),
          unitCost: data.unitCost ?? null,
          updatedAt: new Date(),
        };
        store.inventoryById.set(id, clone(record));
        store.inventoryIdByKey.set(
          inventoryKey({
            productId: record.productId,
            variantId: record.variantId ?? null,
            batchNumber: record.batchNumber ?? null,
          }),
          id
        );
        return clone(record);
      }),
    },
  };

  const memPrisma: any = {
    ...tx,
    $transaction: async (fn: any) => fn(tx),
  };

  return { prisma: memPrisma, tx, store };
}

function resetPrisma(
  seed?: Parameters<typeof createInMemoryPurchaseInboundTx>[0]
) {
  const {
    prisma: memPrisma,
    tx,
    store,
  } = createInMemoryPurchaseInboundTx(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { tx, store };
}

describe('采购进货（到货入库）集成回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('采购单到货：应先分摊费用再入库，并自动生成应付（含费用兜底）', async () => {
    const productId = 'prod-1';
    const userId = 'user-1';
    const supplierId = 'sup-1';
    const orderId = 'po-1';
    const itemId = 'poi-1';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品A', code: 'P001', unit: '片' }],
      users: [{ id: userId, name: '采购员' }],
      purchaseOrders: [
        {
          id: orderId,
          orderNumber: 'PO-0001',
          status: PURCHASE_ORDER_STATUS.IN_TRANSIT,
          supplierId,
          userId,
          totalAmount: 20,
          expenseAmount: 0,
          costAmount: 0,
          arrivalDate: null,
          containerNumber: null,
          shippingCompany: null,
        },
      ],
      purchaseOrderItems: [
        {
          id: itemId,
          purchaseOrderId: orderId,
          supplierId,
          productId,
          quantity: 10,
          unitPrice: 2,
          totalPrice: 20,
          batchNumber: 'B-PO1',
          allocatedExpense: 0,
          unitCostWithExpense: null,
          unitCost: null,
        },
      ],
      expenseRecords: [
        {
          id: 'exp-1',
          relatedType: 'purchase_order',
          relatedId: orderId,
          supplierId: null, // 无供应商的费用：走兜底计入订单主供应商
          expenseAmount: 10,
          voidedAt: null,
        },
      ],
    });

    const { PUT } = await import('@/app/api/purchase-orders/[id]/status/route');

    const payload = {
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      status: PURCHASE_ORDER_STATUS.ARRIVED,
      containerNumber: 'CONT-1',
      shippingCompany: 'MSC',
      estimatedArrival: '',
      remarks: '',
      orderDate: '',
      shipmentDate: '',
      arrivalDate: '2026-01-10T00:00:00.000Z',
    };

    const response = await PUT(
      {
        json: async () => payload,
      } as any,
      {
        user: { id: userId },
        params: { id: orderId },
      } as any
    );

    expect((response as any).status).toBe(200);

    const order = store.purchaseOrdersById.get(orderId);
    expect(order?.status).toBe(PURCHASE_ORDER_STATUS.ARRIVED);

    // 1) 费用分摊：10 元分摊到 10 片 => 含费单位成本 = 2 + 1 = 3
    const updatedItem = store.purchaseOrderItemsById.get(itemId);
    expect(updatedItem?.allocatedExpense).toBe(10);
    expect(updatedItem?.unitCostWithExpense).toBe(3);
    expect(updatedItem?.unitCost).toBe(3);

    // 2) 入库：应创建入库记录 + FIFO + 库存，且成本使用含费单位成本
    expect(store.inboundRecordsById.size).toBe(1);
    const inbound = Array.from(store.inboundRecordsById.values())[0];
    expect(inbound).toEqual(
      expect.objectContaining({
        productId,
        batchNumber: 'B-PO1',
        quantity: 10,
        unitCost: 3,
        reason: 'purchase',
        purchaseOrderId: orderId,
        purchaseOrderItemId: itemId,
        supplierId,
      })
    );

    expect(store.fifoById.size).toBe(1);
    const fifo = Array.from(store.fifoById.values())[0];
    expect(fifo).toEqual(
      expect.objectContaining({
        productId,
        batchNumber: 'B-PO1',
        remainingQty: 10,
        unitCost: 3,
        inboundRecordId: inbound.id,
      })
    );

    expect(store.inventoryById.size).toBe(1);
    const inventory = Array.from(store.inventoryById.values())[0];
    expect(inventory).toEqual(
      expect.objectContaining({
        productId,
        batchNumber: 'B-PO1',
        quantity: 10,
        reservedQuantity: 0,
        unitCost: 3,
      })
    );

    // 3) 应付：货款(20)+费用兜底(10) => 30
    expect(store.payableRecords).toHaveLength(1);
    expect(store.payableRecords[0]).toEqual(
      expect.objectContaining({
        supplierId,
        sourceType: 'purchase_order',
        sourceId: orderId,
        sourceNumber: 'PO-0001',
        payableAmount: 30,
        remainingAmount: 30,
        status: 'pending',
        paymentTerms: '30天',
      })
    );

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: supplierId,
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount: 30,
        referenceId: store.payableRecords[0].id,
        referenceNumber: 'PAY-0001',
        metadata: expect.objectContaining({
          sourceType: 'purchase_order',
          sourceId: orderId,
          sourceNumber: 'PO-0001',
          payableRecordId: store.payableRecords[0].id,
        }),
      }),
      expect.anything()
    );
  });

  test('采购单到货：已部分入库时仅补齐剩余数量', async () => {
    const productId = 'prod-2';
    const userId = 'user-2';
    const supplierId = 'sup-2';
    const orderId = 'po-2';
    const itemId = 'poi-2';

    const { store } = resetPrisma({
      products: [{ id: productId, name: '产品B', code: 'P002', unit: '片' }],
      users: [{ id: userId, name: '采购员' }],
      purchaseOrders: [
        {
          id: orderId,
          orderNumber: 'PO-0002',
          status: PURCHASE_ORDER_STATUS.IN_TRANSIT,
          supplierId,
          userId,
          totalAmount: 10,
          expenseAmount: 0,
          costAmount: 0,
          arrivalDate: null,
          containerNumber: null,
          shippingCompany: null,
        },
      ],
      purchaseOrderItems: [
        {
          id: itemId,
          purchaseOrderId: orderId,
          supplierId,
          productId,
          quantity: 10,
          unitPrice: 1,
          totalPrice: 10,
          batchNumber: 'B-PO2',
          allocatedExpense: 0,
          unitCostWithExpense: null,
          unitCost: null,
        },
      ],
      inboundRecords: [
        {
          id: 'inb-seed',
          recordNumber: 'IN-SEED',
          productId,
          variantId: null,
          batchNumber: 'B-PO2',
          batchSpecificationId: null,
          quantity: 4,
          unitCost: 1,
          totalCost: 4,
          reason: 'purchase',
          remarks: null,
          userId,
          purchaseOrderId: orderId,
          purchaseOrderItemId: itemId,
          supplierId,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { PUT } = await import('@/app/api/purchase-orders/[id]/status/route');

    const payload = {
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
      status: PURCHASE_ORDER_STATUS.ARRIVED,
      containerNumber: 'CONT-2',
      shippingCompany: 'MSC',
      estimatedArrival: '',
      remarks: '',
      orderDate: '',
      shipmentDate: '',
      arrivalDate: '2026-01-10T00:00:00.000Z',
    };

    await PUT(
      { json: async () => payload } as any,
      { user: { id: userId }, params: { id: orderId } } as any
    );

    // 原有 4 + 新增 6 = 10
    expect(store.inboundRecordsById.size).toBe(2);
    const quantities = Array.from(store.inboundRecordsById.values()).map(r =>
      Number(r.quantity)
    );
    expect(quantities.sort((a, b) => a - b)).toEqual([4, 6]);
  });

  test('采购单到货：事务开始前状态已被推进时应拒绝旧请求且不重复入库', async () => {
    const productId = 'prod-race';
    const userId = 'user-race';
    const supplierId = 'sup-race';
    const orderId = 'po-race';
    const itemId = 'poi-race';

    const { tx, store } = resetPrisma({
      products: [{ id: productId, name: '竞态产品', code: 'P-RACE', unit: '片' }],
      users: [{ id: userId, name: '采购员' }],
      purchaseOrders: [
        {
          id: orderId,
          orderNumber: 'PO-RACE',
          status: PURCHASE_ORDER_STATUS.IN_TRANSIT,
          supplierId,
          userId,
          totalAmount: 10,
          expenseAmount: 0,
          costAmount: 0,
          arrivalDate: null,
          containerNumber: null,
          shippingCompany: null,
        },
      ],
      purchaseOrderItems: [
        {
          id: itemId,
          purchaseOrderId: orderId,
          supplierId,
          productId,
          quantity: 10,
          unitPrice: 1,
          totalPrice: 10,
          batchNumber: 'B-RACE',
          allocatedExpense: 0,
          unitCostWithExpense: null,
          unitCost: null,
        },
      ],
    });

    prisma.$transaction = jest.fn(async (fn: any) => {
      const order = store.purchaseOrdersById.get(orderId)!;
      store.purchaseOrdersById.set(orderId, {
        ...order,
        status: PURCHASE_ORDER_STATUS.ARRIVED,
      });
      return fn(tx);
    });

    const { PUT } = await import('@/app/api/purchase-orders/[id]/status/route');

    const response = await PUT(
      {
        json: async () => ({
          idempotencyKey: '00000000-0000-4000-8000-000000000003',
          status: PURCHASE_ORDER_STATUS.ARRIVED,
          containerNumber: 'CONT-RACE',
          shippingCompany: 'MSC',
          estimatedArrival: '',
          remarks: '',
          orderDate: '',
          shipmentDate: '',
          arrivalDate: '2026-01-10T00:00:00.000Z',
        }),
      } as any,
      { user: { id: userId }, params: { id: orderId } } as any
    );

    expect((response as any).status).toBe(409);
    await expect((response as any).json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '采购订单状态已变更，请刷新后重试',
      })
    );

    expect(store.purchaseOrdersById.get(orderId)?.status).toBe(
      PURCHASE_ORDER_STATUS.ARRIVED
    );
    expect(store.inboundRecordsById.size).toBe(0);
    expect(store.fifoById.size).toBe(0);
    expect(store.inventoryById.size).toBe(0);
    expect(store.payableRecords).toHaveLength(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });
});
