import { createSalesOrder } from '@/lib/api/handlers/sales-orders/create';

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
  generatePurchaseOrderNumber: jest.fn(),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentNumber: jest.fn().mockResolvedValue('PAY-0001'),
}));

jest.mock('@/lib/services/expense-service', () => ({
  ensureCompanyExpenses: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/validation', () => ({
  ensureCustomerExists: jest.fn().mockResolvedValue(undefined),
  ensureSupplierExists: jest.fn().mockResolvedValue(undefined),
  ensureProductsExist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/inventory', () => ({
  reserveInventory: jest.fn().mockResolvedValue([]),
  shouldReserveInventory: jest.fn(() => false),
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

const { generateSalesOrderNumber, generatePurchaseOrderNumber } =
  jest.requireMock('@/lib/services/simple-order-number-generator') as {
    generateSalesOrderNumber: jest.Mock;
    generatePurchaseOrderNumber: jest.Mock;
  };

const { reserveInventory } = jest.requireMock(
  '@/lib/api/handlers/sales-orders/inventory'
) as {
  reserveInventory: jest.Mock;
};

type Store = {
  productsById: Map<string, any>;
  customersById: Map<string, any>;
  salesOrdersById: Map<string, any>;
  paymentRecordsById: Map<string, any>;
  payableRecords: any[];
  customerProductPrices: any[];
  purchaseOrdersById: Map<string, any>;
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

function createInMemoryDirectShipmentTx(seed?: {
  products?: Array<any>;
  customers?: Array<any>;
}) {
  const store: Store = {
    productsById: new Map(),
    customersById: new Map(),
    salesOrdersById: new Map(),
    paymentRecordsById: new Map(),
    payableRecords: [],
    customerProductPrices: [],
    purchaseOrdersById: new Map(),
  };

  for (const p of seed?.products ?? []) {
    store.productsById.set(p.id, clone(p));
  }
  for (const c of seed?.customers ?? []) {
    store.customersById.set(c.id, clone(c));
  }

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  const tx = {
    salesOrder: {
      create: jest.fn(async (args: any) => {
        const id = String(args?.data?.id ?? genId('so'));
        const createdAt = new Date();
        const updatedAt = new Date();

        const itemsCreate = (args?.data?.items?.create ?? []) as any[];
        const items = itemsCreate.map((item, index) => ({
          ...item,
          id: `item-${index + 1}`,
          salesOrderId: id,
        }));

        const feeItemsCreate = (args?.data?.feeItems?.create ?? []) as any[];
        const feeItems = feeItemsCreate.map((fee, index) => ({
          id: `fee-${index + 1}`,
          ...fee,
        }));

        const order = {
          id,
          orderNumber: args.data.orderNumber,
          customerId: args.data.customerId,
          userId: args.data.userId,
          supplierId: args.data.supplierId ?? null,
          status: args.data.status,
          orderType: args.data.orderType,
          transferMode: args.data.transferMode ?? null,
          itemsAmount: args.data.itemsAmount,
          additionalFees: args.data.additionalFees,
          expenseAmount: args.data.expenseAmount,
          roundingAdjustment: args.data.roundingAdjustment,
          costAmount: args.data.costAmount,
          profitAmount: args.data.profitAmount,
          totalAmount: args.data.totalAmount,
          paidAmount: 0,
          remarks: args.data.remarks ?? null,
          shippedAt: null,
          createdAt,
          updatedAt,
          customer: {
            id: args.data.customerId,
            name: 'Customer',
            address: 'addr',
            phone: '13000000000',
          },
          user: { id: args.data.userId, name: 'User' },
          items,
          feeItems,
          _count: { items: items.length },
        };

        store.salesOrdersById.set(id, clone(order));
        return clone(order);
      }),

      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const existing = store.salesOrdersById.get(id);
        if (!existing) throw new Error('NotFound');
        const data = args?.data ?? {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        store.salesOrdersById.set(id, updated);
        return clone(updated);
      }),
    },

    salesOrderItem: {
      update: jest.fn(async (args: any) => ({
        id: args.where.id,
        ...args.data,
      })),
    },

    customerProductPrice: {
      createMany: jest.fn(async (args: any) => {
        const rows = Array.isArray(args?.data) ? (args.data as any[]) : [];
        store.customerProductPrices.push(...rows.map(row => clone(row)));
        return { count: rows.length };
      }),
    },

    paymentRecord: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('pay'));
        const record = {
          id,
          paymentNumber: data.paymentNumber,
          salesOrderId: data.salesOrderId ?? null,
          customerId: data.customerId,
          userId: data.userId,
          paymentType: data.paymentType,
          paymentMethod: data.paymentMethod,
          paymentAmount: Number(data.paymentAmount ?? 0),
          actualPaymentAmount: Number(data.actualPaymentAmount ?? 0),
          roundingAmount: Number(data.roundingAmount ?? 0),
          appliedAmount: Number(data.appliedAmount ?? 0),
          paymentDate:
            data.paymentDate instanceof Date
              ? data.paymentDate
              : new Date(data.paymentDate),
          status: data.status,
          remarks: data.remarks ?? null,
        };
        store.paymentRecordsById.set(id, clone(record));
        return clone(record);
      }),
    },

    payableRecord: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('payable'));
        const record = {
          id,
          payableNumber: data.payableNumber,
          supplierId: data.supplierId,
          userId: data.userId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          sourceNumber: data.sourceNumber,
          payableAmount: Number(data.payableAmount ?? 0),
          remainingAmount: Number(data.remainingAmount ?? 0),
          dueDate:
            data.dueDate instanceof Date
              ? data.dueDate
              : new Date(data.dueDate),
          status: data.status,
          paymentTerms: data.paymentTerms ?? null,
          description: data.description ?? null,
          remarks: data.remarks ?? null,
        };
        store.payableRecords.push(clone(record));
        return clone(record);
      }),
    },

    customer: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const customer = store.customersById.get(id);
        if (!customer) return null;
        return { name: customer.name };
      }),
    },

    purchaseOrder: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('po'));
        const itemsCreate = (data?.items?.create ?? []) as any[];
        const order = {
          id,
          orderNumber: data.orderNumber,
          supplierId: data.supplierId,
          userId: data.userId,
          status: data.status,
          totalAmount: Number(data.totalAmount ?? 0),
          orderDate:
            data.orderDate instanceof Date
              ? data.orderDate
              : new Date(data.orderDate),
          remarks: data.remarks ?? null,
          salesOrderId: data.salesOrderId ?? null,
          items: itemsCreate.map((item, index) => ({
            ...item,
            id: `poi-${index + 1}`,
            purchaseOrderId: id,
          })),
        };
        store.purchaseOrdersById.set(id, clone(order));
        return clone(order);
      }),
    },
  };

  const memPrisma: any = {
    ...tx,
    product: {
      findMany: jest.fn(async (args: any) => {
        const ids = args?.where?.id?.in as string[] | undefined;
        const rows = Array.from(store.productsById.values());
        if (!Array.isArray(ids)) return clone(rows);
        return clone(rows.filter(p => ids.includes(p.id)));
      }),
    },
    $transaction: async (fn: any) => fn(tx),
  };

  return { prisma: memPrisma, tx, store };
}

function resetPrisma(
  seed?: Parameters<typeof createInMemoryDirectShipmentTx>[0]
) {
  const { prisma: memPrisma, tx, store } = createInMemoryDirectShipmentTx(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { tx, store };
}

describe('销售开单：调货直发（厂家直发）完整集成回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateSalesOrderNumber.mockResolvedValue('SO-0001');
    generatePurchaseOrderNumber.mockResolvedValue('PO-0001');
  });

  test('confirmed 调货直发：应创建应收+应付，并自动创建关联采购订单（不触发本地库存预留）', async () => {
    const customerId = '00000000-0000-4000-8000-000000000011';
    const userId = '00000000-0000-4000-8000-000000000012';
    const supplierId = '00000000-0000-4000-8000-000000000013';
    const productId = '00000000-0000-4000-8000-000000000014';

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
      customers: [{ id: customerId, name: '客户A' }],
    });

    const result = await createSalesOrder(
      {
        customerId,
        supplierId,
        status: 'confirmed',
        orderType: 'TRANSFER',
        transferMode: 'SUPPLIER_ONLY',
        items: [
          {
            productId,
            productCode: 'P1',
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
            unitCost: 2,
          },
        ],
        usePrepayment: false,
      } as any,
      userId
    );

    // 不触发本地库存预留
    expect(reserveInventory).not.toHaveBeenCalled();

    // 1) 销售应收：订单确认即生成 pending 应收
    expect(store.paymentRecordsById.size).toBe(1);
    const receivable = Array.from(store.paymentRecordsById.values())[0];
    expect(receivable).toEqual(
      expect.objectContaining({
        paymentType: 'order_payment',
        status: 'pending',
        paymentAmount: 50,
        roundingAmount: 0,
        salesOrderId: result.id,
      })
    );

    // 2) 调货直发应付：按成本金额生成 payableRecord（sourceType=sales_order）
    expect(store.payableRecords).toHaveLength(1);
    expect(store.payableRecords[0]).toEqual(
      expect.objectContaining({
        supplierId,
        sourceType: 'sales_order',
        sourceId: result.id,
        sourceNumber: 'SO-0001',
        payableAmount: 20,
        remainingAmount: 20,
        status: 'pending',
        paymentTerms: '30天',
      })
    );

    // 3) 自动创建采购订单并关联销售订单（status=confirmed, totalAmount=成本）
    expect(store.purchaseOrdersById.size).toBe(1);
    const purchaseOrder = Array.from(store.purchaseOrdersById.values())[0];
    expect(purchaseOrder).toEqual(
      expect.objectContaining({
        orderNumber: 'PO-0001',
        supplierId,
        userId,
        status: 'confirmed',
        totalAmount: 20,
        salesOrderId: result.id,
      })
    );
    expect(purchaseOrder.items).toHaveLength(1);
    expect(purchaseOrder.items[0]).toEqual(
      expect.objectContaining({
        productId,
        supplierId,
        productCode: 'P1',
        quantity: 10,
        unitPrice: 2,
        totalPrice: 20,
      })
    );

    // 4) 往来账：确认即记一笔 sale（金额按应收，不扣预收）
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: customerId,
        transactionType: 'sale',
        amount: 50,
        referenceId: result.id,
        referenceNumber: 'SO-0001',
      })
    );
  });
});
