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
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentNumber: jest.fn().mockResolvedValue('PAY-0001'),
  generatePayableNumber: jest.fn().mockResolvedValue('YFK-0001'),
}));

jest.mock('@/lib/services/expense-service', () => ({
  ensureCompanyExpenses: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/purchase-order', () => ({
  createPurchaseOrderForTransfer: jest.fn().mockResolvedValue(undefined),
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

const { generateSalesOrderNumber } = jest.requireMock(
  '@/lib/services/simple-order-number-generator'
) as { generateSalesOrderNumber: jest.Mock };

const { generatePaymentNumber, generatePayableNumber } = jest.requireMock(
  '@/lib/utils/payment-number-generator'
) as {
  generatePaymentNumber: jest.Mock;
  generatePayableNumber: jest.Mock;
};

const { createPurchaseOrderForTransfer } = jest.requireMock(
  '@/lib/api/handlers/sales-orders/purchase-order'
) as { createPurchaseOrderForTransfer: jest.Mock };

type PaymentRecordRow = {
  id: string;
  customerId: string;
  userId: string;
  paymentType: string;
  status: string;
  paymentAmount: number;
  appliedAmount: number;
  paymentDate: Date;
  roundingAmount?: number;
  actualPaymentAmount?: number;
  salesOrderId?: string | null;
  remarks?: string | null;
};

type PrepaymentUsageRow = {
  id: string;
  paymentRecordId: string;
  salesOrderId: string;
  appliedAmount: number;
};

type PayableRecordRow = {
  id: string;
  payableNumber: string;
  supplierId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  payableAmount: number;
  remainingAmount: number;
  dueDate: Date;
  status: string;
  paymentTerms?: string | null;
  description?: string | null;
  remarks?: string | null;
};

type Store = {
  paymentRecordsById: Map<string, PaymentRecordRow>;
  prepaymentUsages: PrepaymentUsageRow[];
  payableRecords: PayableRecordRow[];
  customerProductPrices: Array<Record<string, unknown>>;
  salesOrdersById: Map<string, any>;
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

function createInMemorySalesFinanceTx(seed?: {
  prepayments?: PaymentRecordRow[];
}) {
  const store: Store = {
    paymentRecordsById: new Map(),
    prepaymentUsages: [],
    payableRecords: [],
    customerProductPrices: [],
    salesOrdersById: new Map(),
  };

  for (const row of seed?.prepayments ?? []) {
    store.paymentRecordsById.set(row.id, clone(row));
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
            name: 'Customer A',
            address: 'addr',
            phone: '13000000000',
          },
          user: {
            id: args.data.userId,
            name: 'User A',
          },
          items,
          feeItems,
          _count: { items: items.length },
        };

        store.salesOrdersById.set(id, order);
        return order;
      }),

      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) {
          throw new Error('MissingId');
        }
        const existing = store.salesOrdersById.get(id);
        if (!existing) {
          throw new Error('NotFound');
        }

        const data = args?.data ?? {};
        if (data.paidAmount !== undefined) {
          existing.paidAmount = data.paidAmount;
        }

        store.salesOrdersById.set(id, existing);
        return existing;
      }),
    },

    salesOrderItem: {
      update: jest.fn(async (args: any) => ({
        id: args.where.id,
        ...args.data,
      })),
    },

    payableRecord: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('payable'));
        const row: PayableRecordRow = {
          id,
          payableNumber: String(data.payableNumber),
          supplierId: String(data.supplierId),
          userId: String(data.userId),
          sourceType: String(data.sourceType),
          sourceId: String(data.sourceId),
          sourceNumber: String(data.sourceNumber),
          payableAmount: Number(data.payableAmount ?? 0),
          remainingAmount: Number(data.remainingAmount ?? 0),
          dueDate:
            data.dueDate instanceof Date
              ? data.dueDate
              : new Date(data.dueDate),
          status: String(data.status),
          paymentTerms: data.paymentTerms ?? null,
          description: data.description ?? null,
          remarks: data.remarks ?? null,
        };
        store.payableRecords.push(clone(row));
        return clone(row);
      }),
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

        const record: PaymentRecordRow = {
          id,
          customerId: String(data.customerId),
          userId: String(data.userId),
          paymentType: String(data.paymentType),
          status: String(data.status),
          paymentAmount: Number(data.paymentAmount ?? 0),
          appliedAmount: Number(data.appliedAmount ?? 0),
          paymentDate:
            data.paymentDate instanceof Date
              ? data.paymentDate
              : new Date(data.paymentDate),
          roundingAmount:
            data.roundingAmount === undefined
              ? undefined
              : Number(data.roundingAmount),
          actualPaymentAmount:
            data.actualPaymentAmount === undefined
              ? undefined
              : Number(data.actualPaymentAmount),
          salesOrderId: data.salesOrderId ?? null,
          remarks: data.remarks ?? null,
        };

        store.paymentRecordsById.set(id, clone(record));
        return clone(record);
      }),

      findMany: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const select = args?.select as Record<string, boolean> | undefined;
        const cursorId = args?.cursor?.id as string | undefined;
        const skip = typeof args?.skip === 'number' ? args.skip : 0;
        const take = typeof args?.take === 'number' ? args.take : undefined;
        const orderBy = args?.orderBy;

        const statusIn = Array.isArray(where?.status?.in)
          ? (where.status.in as string[])
          : undefined;

        let records = Array.from(store.paymentRecordsById.values()).filter(
          r => {
            if (
              where.customerId !== undefined &&
              r.customerId !== where.customerId
            ) {
              return false;
            }
            if (
              where.paymentType !== undefined &&
              r.paymentType !== where.paymentType
            ) {
              return false;
            }
            if (statusIn && !statusIn.includes(r.status)) {
              return false;
            }
            return true;
          }
        );

        const clauses: Array<{ field: string; dir: 'asc' | 'desc' }> =
          Array.isArray(orderBy)
            ? orderBy.map((o: any) => {
                const field = Object.keys(o)[0] as string;
                return { field, dir: o[field] as 'asc' | 'desc' };
              })
            : orderBy
              ? [
                  {
                    field: Object.keys(orderBy)[0] as string,
                    dir: (orderBy as any)[Object.keys(orderBy)[0]] as
                      | 'asc'
                      | 'desc',
                  },
                ]
              : [];

        const getComparable = (obj: any, field: string) => {
          const value = obj[field];
          if (value instanceof Date) return value.getTime();
          if (
            field.toLowerCase().includes('date') ||
            field.toLowerCase().includes('at')
          ) {
            return new Date(value).getTime();
          }
          return value;
        };

        records = [...records].sort((a, b) => {
          for (const c of clauses) {
            const av = getComparable(a, c.field);
            const bv = getComparable(b, c.field);
            if (av === bv) continue;
            const diff = av < bv ? -1 : 1;
            return c.dir === 'asc' ? diff : -diff;
          }
          return 0;
        });

        if (cursorId) {
          const cursorIndex = records.findIndex(r => r.id === cursorId);
          if (cursorIndex >= 0) {
            records = records.slice(cursorIndex + (skip > 0 ? skip : 0));
          }
        } else if (skip > 0) {
          records = records.slice(skip);
        }

        if (take !== undefined) {
          records = records.slice(0, take);
        }

        if (select) {
          return records.map(r => {
            const projected: Record<string, unknown> = {};
            for (const key of Object.keys(select)) {
              if (select[key]) {
                projected[key] = (r as any)[key];
              }
            }
            return projected;
          });
        }

        return records.map(r => clone(r));
      }),

      updateMany: jest.fn(async (args: any) => {
        const where = args?.where ?? {};
        const id = where?.id as string | undefined;
        if (!id) {
          return { count: 0 };
        }
        const record = store.paymentRecordsById.get(id);
        if (!record) {
          return { count: 0 };
        }

        if (where.appliedAmount !== undefined) {
          const expectedApplied = Number(where.appliedAmount);
          if (Number(record.appliedAmount) !== expectedApplied) {
            return { count: 0 };
          }
        }

        if (where.paymentAmount?.gte !== undefined) {
          const gte = Number(where.paymentAmount.gte);
          if (Number(record.paymentAmount) < gte) {
            return { count: 0 };
          }
        }

        const increment = Number(args?.data?.appliedAmount?.increment ?? 0);
        record.appliedAmount = Number(record.appliedAmount) + increment;
        store.paymentRecordsById.set(id, clone(record));
        return { count: 1 };
      }),

      update: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) {
          throw new Error('MissingId');
        }
        const record = store.paymentRecordsById.get(id);
        if (!record) {
          throw new Error('NotFound');
        }
        const data = args?.data ?? {};
        if (data.status !== undefined) {
          record.status = String(data.status);
        }
        store.paymentRecordsById.set(id, clone(record));
        return clone(record);
      }),
    },

    prepaymentUsage: {
      create: jest.fn(async (args: any) => {
        const data = args?.data ?? {};
        const row: PrepaymentUsageRow = {
          id: String(data.id ?? genId('ppu')),
          paymentRecordId: String(data.paymentRecordId),
          salesOrderId: String(data.salesOrderId),
          appliedAmount: Number(data.appliedAmount ?? 0),
        };
        store.prepaymentUsages.push(clone(row));
        return clone(row);
      }),
    },
  };

  const memPrisma: any = {
    ...tx,
    $transaction: async (fn: any, _options?: any) => fn(tx),
  };

  return { prisma: memPrisma, tx, store };
}

function resetPrisma(
  seed?: Parameters<typeof createInMemorySalesFinanceTx>[0]
) {
  const { prisma: memPrisma, tx, store } = createInMemorySalesFinanceTx(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);

  if (!prisma.product) {
    prisma.product = {};
  }
  prisma.product.findMany = jest.fn().mockResolvedValue([]);

  return { tx, store };
}

describe('财务 × 销售：关键链路（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateSalesOrderNumber.mockResolvedValue('SO-0001');
    generatePaymentNumber.mockResolvedValue('PAY-0001');
    generatePayableNumber.mockResolvedValue('YFK-0001');
  });

  test('confirmed 普通销售 + 预收冲抵：应创建应收、分配预收并回写 paidAmount，同时写入 sales 往来流水', async () => {
    const customerId = 'cust-1';
    const userId = 'user-1';

    const { store } = resetPrisma({
      prepayments: [
        {
          id: 'pp-1',
          customerId,
          userId,
          paymentType: 'prepayment',
          status: 'confirmed',
          paymentAmount: 50,
          appliedAmount: 10,
          paymentDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'pp-2',
          customerId,
          userId,
          paymentType: 'prepayment',
          status: 'confirmed',
          paymentAmount: 30,
          appliedAmount: 0,
          paymentDate: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            isManualProduct: true,
            manualProductName: '手动产品A',
            manualUnit: '片',
            quantity: 100,
            unitPrice: 1,
            subtotal: 100,
          },
        ],
        roundingAdjustment: 0,
        usePrepayment: true,
        prepaymentAmount: 60,
      } as any,
      userId
    );

    // 1) 应收记录（订单确认即生成 pending 应收）
    const receivable = Array.from(store.paymentRecordsById.values()).find(
      r => r.paymentType === 'order_payment'
    );
    expect(receivable).toBeTruthy();
    expect(receivable?.customerId).toBe(customerId);
    expect(receivable?.paymentAmount).toBe(100);
    expect(receivable?.roundingAmount).toBe(0);
    expect(receivable?.status).toBe('pending');
    expect(receivable?.salesOrderId).toBe(result.id);

    // 2) 预收冲抵：pp-1 用尽并置 applied；pp-2 部分使用
    expect(store.paymentRecordsById.get('pp-1')?.appliedAmount).toBe(50);
    expect(store.paymentRecordsById.get('pp-1')?.status).toBe('applied');
    expect(store.paymentRecordsById.get('pp-2')?.appliedAmount).toBe(20);
    expect(store.paymentRecordsById.get('pp-2')?.status).toBe('confirmed');

    // 3) 预收冲抵明细
    expect(store.prepaymentUsages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentRecordId: 'pp-1',
          salesOrderId: result.id,
          appliedAmount: 40,
        }),
        expect.objectContaining({
          paymentRecordId: 'pp-2',
          salesOrderId: result.id,
          appliedAmount: 20,
        }),
      ])
    );

    // 4) paidAmount 回写
    const persistedOrder = store.salesOrdersById.get(result.id);
    expect(Number(persistedOrder?.paidAmount ?? 0)).toBe(60);

    // 5) 往来账：销售订单确认入账（金额按应收，不扣预收）
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 100,
        referenceId: result.id,
        referenceNumber: 'SO-0001',
      }),
      undefined
    );
  });

  test('confirmed 普通销售 + 抹零：应收记录 roundingAmount 生效，往来账金额=应收+抹零；预收超额时按应收上限冲抵', async () => {
    const customerId = 'cust-4';
    const userId = 'user-4';

    const { store } = resetPrisma({
      prepayments: [
        {
          id: 'pp-4-1',
          customerId,
          userId,
          paymentType: 'prepayment',
          status: 'confirmed',
          paymentAmount: 50,
          appliedAmount: 0,
          paymentDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'pp-4-2',
          customerId,
          userId,
          paymentType: 'prepayment',
          status: 'confirmed',
          paymentAmount: 60,
          appliedAmount: 0,
          paymentDate: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    generateSalesOrderNumber.mockResolvedValue('SO-0004');

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            isManualProduct: true,
            manualProductName: '手动产品B',
            manualUnit: '片',
            quantity: 100,
            unitPrice: 1,
            subtotal: 100,
          },
        ],
        roundingAdjustment: -0.5,
        usePrepayment: true,
        prepaymentAmount: 200,
      } as any,
      userId
    );

    // 1) 应收：paymentAmount=totalAmount（不含抹零），roundingAmount=抹零
    const receivable = Array.from(store.paymentRecordsById.values()).find(
      r => r.paymentType === 'order_payment'
    );
    expect(receivable?.paymentAmount).toBe(100);
    expect(receivable?.roundingAmount).toBe(-0.5);
    expect(receivable?.status).toBe('pending');

    // 2) paidAmount 回写：按应收上限（含抹零）冲抵，不应超额
    const persistedOrder = store.salesOrdersById.get(result.id);
    expect(Number(persistedOrder?.paidAmount ?? 0)).toBeCloseTo(99.5, 6);

    // 3) 预收冲抵：pp-4-1 用尽；pp-4-2 部分使用
    expect(store.paymentRecordsById.get('pp-4-1')?.appliedAmount).toBe(50);
    expect(store.paymentRecordsById.get('pp-4-1')?.status).toBe('applied');
    expect(store.paymentRecordsById.get('pp-4-2')?.appliedAmount).toBeCloseTo(
      49.5,
      6
    );
    expect(store.paymentRecordsById.get('pp-4-2')?.status).toBe('confirmed');

    // 4) 往来账：金额=应收+抹零（不扣预收）
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: customerId,
        transactionType: 'sale',
        amount: 99.5,
        referenceId: result.id,
        referenceNumber: 'SO-0004',
      }),
      undefined
    );
  });

  test('confirmed 普通销售（库存产品）：应写入 SALES 价格历史，生成应收并入 sales 往来账', async () => {
    const customerId = 'cust-5';
    const userId = 'user-5';
    const productId = '00000000-0000-4000-8000-000000000005';

    const { store } = resetPrisma();
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P5',
        code: 'P5',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    generateSalesOrderNumber.mockResolvedValue('SO-0005');

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            quantity: 2,
            unitPrice: 3,
            subtotal: 6,
          },
        ],
        usePrepayment: false,
      } as any,
      userId
    );

    const receivable = Array.from(store.paymentRecordsById.values()).find(
      r => r.paymentType === 'order_payment'
    );
    expect(receivable?.paymentAmount).toBe(6);
    expect(receivable?.roundingAmount).toBe(0);
    expect(receivable?.salesOrderId).toBe(result.id);

    expect(store.customerProductPrices).toHaveLength(1);
    expect(store.customerProductPrices[0]).toEqual(
      expect.objectContaining({
        customerId,
        productId,
        priceType: 'SALES',
        unitPrice: 3,
        orderId: result.id,
        orderType: 'SALES_ORDER',
      })
    );

    expect(store.payableRecords).toHaveLength(0);
    expect(createPurchaseOrderForTransfer).not.toHaveBeenCalled();

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: customerId,
        transactionType: 'sale',
        amount: 6,
        referenceId: result.id,
        referenceNumber: 'SO-0005',
      }),
      undefined
    );
  });

  test('confirmed 0元订单（库存产品，单价为0）：不应生成应收/应付，也不应写入往来账', async () => {
    const customerId = 'cust-6';
    const userId = 'user-6';
    const productId = '00000000-0000-4000-8000-000000000006';

    const { store } = resetPrisma();
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P6',
        code: 'P6',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    generateSalesOrderNumber.mockResolvedValue('SO-0006');

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 0,
            subtotal: 0,
          },
        ],
        usePrepayment: false,
      } as any,
      userId
    );

    expect(result.status).toBe('confirmed');
    expect(Array.from(store.paymentRecordsById.values())).toHaveLength(0);
    expect(store.payableRecords).toHaveLength(0);
    expect(store.customerProductPrices).toHaveLength(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });

  test('confirmed 调货直发：应生成应收 + 应付，并记录价格历史，且触发创建调货采购单', async () => {
    const customerId = 'cust-2';
    const userId = 'user-2';
    const supplierId = 'sup-2';
    const productId = '00000000-0000-4000-8000-000000000002';

    const { store } = resetPrisma();
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P2',
        code: 'P2',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    generateSalesOrderNumber.mockResolvedValue('SO-0002');

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

    // 1) 应收
    const receivable = Array.from(store.paymentRecordsById.values()).find(
      r => r.paymentType === 'order_payment'
    );
    expect(receivable?.customerId).toBe(customerId);
    expect(receivable?.paymentAmount).toBe(50);

    // 2) 应付（成本金额）
    expect(store.payableRecords).toHaveLength(1);
    expect(store.payableRecords[0]).toEqual(
      expect.objectContaining({
        supplierId,
        sourceType: 'sales_order',
        sourceId: result.id,
        sourceNumber: 'SO-0002',
        payableAmount: 20,
        remainingAmount: 20,
        status: 'pending',
        paymentTerms: '30天',
      })
    );
    // dueDate = now + 30 days（按日历天）
    const expectedDueDate = new Date();
    expectedDueDate.setDate(expectedDueDate.getDate() + 30);
    expect(store.payableRecords[0]?.dueDate.toDateString()).toBe(
      expectedDueDate.toDateString()
    );

    // 3) 价格历史（FACTORY）
    expect(store.customerProductPrices).toHaveLength(1);
    expect(store.customerProductPrices[0]).toEqual(
      expect.objectContaining({
        customerId,
        productId,
        priceType: 'FACTORY',
        unitPrice: 5,
        orderId: result.id,
        orderType: 'SALES_ORDER',
      })
    );

    // 4) 调货直发：应创建采购单
    expect(createPurchaseOrderForTransfer).toHaveBeenCalledTimes(1);

    // 5) 往来账：确认即记客户 sale + 供应商 purchase 两笔流水
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(2);
    const transferLedgerCalls = recordPartnerTransaction.mock.calls;
    expect(
      transferLedgerCalls.some(
        ([payload]) =>
          payload.partnerId === customerId &&
          payload.transactionType === 'sale' &&
          payload.amount === 50 &&
          payload.referenceId === result.id &&
          payload.referenceNumber === 'SO-0002'
      )
    ).toBe(true);
    expect(
      transferLedgerCalls.some(
        ([payload, txArg]) =>
          payload.partnerId === supplierId &&
          payload.transactionType === 'purchase' &&
          payload.amount === 20 &&
          payload.referenceNumber === 'YFK-0001' &&
          Boolean(txArg)
      )
    ).toBe(true);
  });

  test('confirmed 调货直发 + 公司承担费用：应付金额应包含公司费用分摊，但应收不包含公司费用', async () => {
    const customerId = 'cust-7';
    const userId = 'user-7';
    const supplierId = 'sup-7';
    const productId = '00000000-0000-4000-8000-000000000007';

    const { store } = resetPrisma();
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P7',
        code: 'P7',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    generateSalesOrderNumber.mockResolvedValue('SO-0007');

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
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
            unitCost: 2,
          },
        ],
        feeItems: [
          {
            feeType: 'shipping',
            feeName: '运费',
            feeAmount: 10,
            paidBy: 'company',
          },
        ],
        usePrepayment: false,
      } as any,
      userId
    );

    // 1) 应收仍为销售金额（公司承担费用不计入应收）
    const receivable = Array.from(store.paymentRecordsById.values()).find(
      r => r.paymentType === 'order_payment'
    );
    expect(receivable?.paymentAmount).toBe(50);

    // 2) 应付金额=成本(20)+公司承担费用(10)=30
    expect(store.payableRecords).toHaveLength(1);
    expect(store.payableRecords[0]).toEqual(
      expect.objectContaining({
        supplierId,
        sourceType: 'sales_order',
        sourceId: result.id,
        sourceNumber: 'SO-0007',
        payableAmount: 30,
        remainingAmount: 30,
        status: 'pending',
        paymentTerms: '30天',
      })
    );

    // 3) 价格历史（FACTORY）
    expect(store.customerProductPrices).toHaveLength(1);
    expect(store.customerProductPrices[0]).toEqual(
      expect.objectContaining({
        customerId,
        productId,
        priceType: 'FACTORY',
        unitPrice: 5,
        orderId: result.id,
        orderType: 'SALES_ORDER',
      })
    );

    // 4) 调货直发：应创建采购单
    expect(createPurchaseOrderForTransfer).toHaveBeenCalledTimes(1);

    // 5) 往来账：确认即记客户 sale + 供应商 purchase 两笔流水
    expect(recordPartnerTransaction).toHaveBeenCalledTimes(2);
    const transferWithExpenseLedgerCalls = recordPartnerTransaction.mock.calls;
    expect(
      transferWithExpenseLedgerCalls.some(
        ([payload]) =>
          payload.partnerId === customerId &&
          payload.transactionType === 'sale' &&
          payload.amount === 50 &&
          payload.referenceId === result.id &&
          payload.referenceNumber === 'SO-0007'
      )
    ).toBe(true);
    expect(
      transferWithExpenseLedgerCalls.some(
        ([payload, txArg]) =>
          payload.partnerId === supplierId &&
          payload.transactionType === 'purchase' &&
          payload.amount === 30 &&
          payload.referenceNumber === 'YFK-0001' &&
          Boolean(txArg)
      )
    ).toBe(true);
  });

  test('draft 销售订单：不应生成应收/应付，也不应写入往来账', async () => {
    const customerId = 'cust-3';
    const userId = 'user-3';

    const { store } = resetPrisma();
    generateSalesOrderNumber.mockResolvedValue('SO-0003');

    const result = await createSalesOrder(
      {
        customerId,
        status: 'draft',
        orderType: 'NORMAL',
        items: [],
        usePrepayment: false,
      } as any,
      userId
    );

    expect(result.status).toBe('draft');
    expect(Array.from(store.paymentRecordsById.values()).length).toBe(0);
    expect(store.payableRecords.length).toBe(0);
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });
});
