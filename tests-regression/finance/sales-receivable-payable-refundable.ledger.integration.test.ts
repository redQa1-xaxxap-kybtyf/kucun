import {
  getFinanceSummary,
  getTotalReceivable,
  getTotalRefundable,
} from '@/lib/services/finance-statistics';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';

jest.mock('@/lib/cache/pubsub', () => ({
  publishFinanceChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

const { getSystemMode } = jest.requireMock(
  '@/lib/services/system-mode-service'
) as {
  getSystemMode: jest.Mock;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

type AccountStatementRow = {
  id: string;
  entityId: string;
  entityName: string;
  entityType: string;
  partnerRole: string;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  overdueAmount: number;
  creditLimit: number;
  paymentTerms: string;
  status: string;
  lastTransactionDate: Date | null;
  lastPaymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RefundRecordRow = {
  id: string;
  remainingAmount: number;
  status: string;
  voidedAt: Date | null;
  dataTag?: string | null;
};

type Store = {
  customersById: Map<string, CustomerRow>;
  suppliersById: Map<string, SupplierRow>;
  statementsById: Map<string, AccountStatementRow>;
  statementIdByEntityId: Map<string, string>;
  refundRecordsById: Map<string, RefundRecordRow>;
  systemLogs: Array<Record<string, unknown>>;
  statementTransactions: Array<Record<string, unknown>>;
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

function matchesIn(
  value: string | null | undefined,
  expected: unknown
): boolean {
  if (!expected) return true;
  if (typeof expected === 'string') return value === expected;
  if (
    typeof expected === 'object' &&
    expected &&
    Array.isArray((expected as any).in)
  ) {
    const list = (expected as any).in as unknown[];
    return list.includes(value);
  }
  return true;
}

function matchesNumberFilter(value: number, filter: any): boolean {
  if (!filter) return true;
  if (typeof filter === 'number') return value === filter;
  if (filter.gt !== undefined && !(value > Number(filter.gt))) return false;
  if (filter.gte !== undefined && !(value >= Number(filter.gte))) return false;
  if (filter.lt !== undefined && !(value < Number(filter.lt))) return false;
  if (filter.lte !== undefined && !(value <= Number(filter.lte))) return false;
  return true;
}

function createInMemoryLedgerPrisma(seed?: {
  customers?: CustomerRow[];
  suppliers?: SupplierRow[];
  refundRecords?: RefundRecordRow[];
}) {
  const store: Store = {
    customersById: new Map(),
    suppliersById: new Map(),
    statementsById: new Map(),
    statementIdByEntityId: new Map(),
    refundRecordsById: new Map(),
    systemLogs: [],
    statementTransactions: [],
  };

  for (const row of seed?.customers ?? []) {
    store.customersById.set(row.id, clone(row));
  }
  for (const row of seed?.suppliers ?? []) {
    store.suppliersById.set(row.id, clone(row));
  }
  for (const row of seed?.refundRecords ?? []) {
    store.refundRecordsById.set(row.id, clone(row));
  }

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;
  const now = () => new Date();

  const accountStatement = {
    findUnique: async (args: any) => {
      const where = args?.where ?? {};
      const id = where?.id as string | undefined;
      const entityId = where?.entityId as string | undefined;

      const row = id
        ? store.statementsById.get(id)
        : entityId
          ? store.statementsById.get(
              store.statementIdByEntityId.get(entityId) ?? ''
            )
          : undefined;
      if (!row) return null;
      return pickSelected(row, args?.select);
    },

    create: async (args: any) => {
      const data = args?.data ?? {};
      const entityId = String(data.entityId);
      const id = String(data.id ?? `stmt-${entityId}`);
      const timestamp = now();

      const created: AccountStatementRow = {
        id,
        entityId,
        entityName: String(data.entityName ?? entityId),
        entityType: String(data.entityType ?? 'customer'),
        partnerRole: String(data.partnerRole ?? 'customer'),
        totalOrders: Number(data.totalOrders ?? 0),
        totalAmount: Number(data.totalAmount ?? 0),
        paidAmount: Number(data.paidAmount ?? 0),
        pendingAmount: Number(data.pendingAmount ?? 0),
        currentBalance: Number(data.currentBalance ?? 0),
        overdueAmount: Number(data.overdueAmount ?? 0),
        creditLimit: Number(data.creditLimit ?? 0),
        paymentTerms: String(data.paymentTerms ?? '30天'),
        status: String(data.status ?? 'active'),
        lastTransactionDate: data.lastTransactionDate ?? null,
        lastPaymentDate: data.lastPaymentDate ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.statementsById.set(id, clone(created));
      store.statementIdByEntityId.set(entityId, id);
      return pickSelected(created, args?.select);
    },

    update: async (args: any) => {
      const where = args?.where ?? {};
      const id = where?.id as string | undefined;
      const entityId = where?.entityId as string | undefined;
      const resolvedId =
        id ??
        (entityId ? store.statementIdByEntityId.get(entityId) : undefined);
      if (!resolvedId) throw new Error('MissingStatementId');

      const row = store.statementsById.get(resolvedId);
      if (!row) throw new Error('NotFound');

      const data = args?.data ?? {};
      const updated: AccountStatementRow = clone(row);

      if (data.entityName !== undefined)
        updated.entityName = String(data.entityName);
      if (data.partnerRole !== undefined)
        updated.partnerRole = String(data.partnerRole);
      if (data.entityType !== undefined)
        updated.entityType = String(data.entityType);
      if (data.currentBalance !== undefined)
        updated.currentBalance = Number(data.currentBalance);
      if (data.pendingAmount !== undefined)
        updated.pendingAmount = Number(data.pendingAmount);
      if (data.lastTransactionDate !== undefined)
        updated.lastTransactionDate = data.lastTransactionDate;
      if (data.lastPaymentDate !== undefined)
        updated.lastPaymentDate = data.lastPaymentDate;
      if (data.status !== undefined) updated.status = String(data.status);

      if (data.totalOrders?.increment) {
        updated.totalOrders += Number(data.totalOrders.increment);
      }
      if (data.totalAmount?.increment) {
        updated.totalAmount += Number(data.totalAmount.increment);
      }
      if (data.paidAmount?.increment) {
        updated.paidAmount += Number(data.paidAmount.increment);
      }

      updated.updatedAt = now();
      store.statementsById.set(resolvedId, clone(updated));
      return pickSelected(updated, args?.select);
    },

    aggregate: async (args: any) => {
      const where = args?.where ?? {};
      const sumSpec = args?._sum ?? {};

      const rows = Array.from(store.statementsById.values()).filter(
        statement => {
          if (!matchesIn(statement.partnerRole, where?.partnerRole))
            return false;
          if (
            !matchesNumberFilter(
              statement.currentBalance,
              where?.currentBalance
            )
          )
            return false;
          return true;
        }
      );

      const sums: Record<string, number> = {};
      for (const key of Object.keys(sumSpec)) {
        sums[key] = rows.reduce(
          (acc, row: any) => acc + Number(row[key] ?? 0),
          0
        );
      }

      return { _sum: sums };
    },

    count: async (args: any) => {
      const where = args?.where ?? {};
      const rows = Array.from(store.statementsById.values()).filter(
        statement => {
          if (!matchesIn(statement.partnerRole, where?.partnerRole))
            return false;
          if (
            !matchesNumberFilter(
              statement.currentBalance,
              where?.currentBalance
            )
          )
            return false;
          return true;
        }
      );
      return rows.length;
    },
  };

  const statementTransaction = {
    findFirst: async (_args: any) => null,
    create: async (args: any) => {
      const data = args?.data ?? {};
      const row = {
        id: String(data.id ?? genId('tx')),
        ...clone(data),
        createdAt: now(),
      };
      store.statementTransactions.push(clone(row));
      return clone(row);
    },
  };

  const refundRecord = {
    aggregate: async (args: any) => {
      const where = args?.where ?? {};
      const sumSpec = args?._sum ?? {};

      const rows = Array.from(store.refundRecordsById.values()).filter(row => {
        if (where?.voidedAt === null && row.voidedAt !== null) return false;
        if (where?.dataTag !== undefined && row.dataTag !== where.dataTag)
          return false;
        if (where?.remainingAmount?.gt !== undefined) {
          if (!(row.remainingAmount > Number(where.remainingAmount.gt)))
            return false;
        }
        if (where?.status?.in) {
          const list = where.status.in as string[];
          if (!list.includes(row.status)) return false;
        } else if (where?.status !== undefined) {
          if (row.status !== where.status) return false;
        }
        return true;
      });

      const sums: Record<string, number> = {};
      for (const key of Object.keys(sumSpec)) {
        sums[key] = rows.reduce(
          (acc, row: any) => acc + Number(row[key] ?? 0),
          0
        );
      }

      return { _sum: sums };
    },
  };

  const systemLog = {
    create: async (args: any) => {
      store.systemLogs.push(clone(args?.data ?? {}));
      return { id: genId('log') };
    },
  };

  const customer = {
    findUnique: async (args: any) => {
      const id = args?.where?.id as string | undefined;
      if (!id) return null;
      const row = store.customersById.get(id);
      if (!row) return null;
      return pickSelected(row, args?.select);
    },
  };

  const supplier = {
    findUnique: async (args: any) => {
      const id = args?.where?.id as string | undefined;
      if (!id) return null;
      const row = store.suppliersById.get(id);
      if (!row) return null;
      return pickSelected(row, args?.select);
    },
  };

  const memPrisma: any = {
    accountStatement,
    statementTransaction,
    refundRecord,
    systemLog,
    customer,
    supplier,
  };

  return { prisma: memPrisma, store };
}

function resetPrisma(seed?: Parameters<typeof createInMemoryLedgerPrisma>[0]) {
  const { prisma: memPrisma, store } = createInMemoryLedgerPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { store };
}

describe('销售/应收/应付/应退（账本 + 统计）集成回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSystemMode.mockResolvedValue('trial');
  });

  test('sale/payment_in/sales_return + purchase/payment_out + refundRecord => totals 应一致', async () => {
    const { store } = resetPrisma({
      customers: [
        {
          id: 'cust-a',
          name: '客户A',
          phone: null,
          address: null,
          role: 'customer',
        },
        {
          id: 'cust-b',
          name: '客户B',
          phone: null,
          address: null,
          role: 'customer',
        },
      ],
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商1',
          phone: null,
          address: null,
        },
      ],
      refundRecords: [
        {
          id: 'refund-pending-1',
          remainingAmount: 10,
          status: 'pending',
          voidedAt: null,
        },
      ],
    });

    // 客户A：应收 150（200 - 50）
    await recordPartnerTransaction(
      {
        partnerId: 'cust-a',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 200,
        referenceId: 'so-a',
        referenceNumber: 'SO-A',
        description: '销售 SO-A',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );
    await recordPartnerTransaction(
      {
        partnerId: 'cust-a',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'payment_in',
        amount: 50,
        referenceId: 'pay-a',
        referenceNumber: 'PAY-A',
        description: '收款 PAY-A',
        occurredAt: new Date('2026-01-02T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );

    // 客户B：全额收款后退货 10，账面余额应为 -10（出现应退）
    await recordPartnerTransaction(
      {
        partnerId: 'cust-b',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 100,
        referenceId: 'so-b',
        referenceNumber: 'SO-B',
        description: '销售 SO-B',
        occurredAt: new Date('2026-01-03T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );
    await recordPartnerTransaction(
      {
        partnerId: 'cust-b',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'payment_in',
        amount: 100,
        referenceId: 'pay-b',
        referenceNumber: 'PAY-B',
        description: '收款 PAY-B',
        occurredAt: new Date('2026-01-04T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );
    await recordPartnerTransaction(
      {
        partnerId: 'cust-b',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sales_return',
        amount: 10,
        referenceId: 'rt-b',
        referenceNumber: 'RT-B',
        description: '销售退货 RT-B',
        occurredAt: new Date('2026-01-05T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );

    // 供应商：采购 50 + 付款 20 => 应付 30
    await recordPartnerTransaction(
      {
        partnerId: 'sup-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount: 50,
        referenceId: 'po-1',
        referenceNumber: 'PO-1',
        description: '采购 PO-1',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );
    await recordPartnerTransaction(
      {
        partnerId: 'sup-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'payment_out',
        amount: 20,
        referenceId: 'payout-1',
        referenceNumber: 'PAYOUT-1',
        description: '付款 PAYOUT-1',
        occurredAt: new Date('2026-01-02T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );

    const stmtAId = store.statementIdByEntityId.get('cust-a')!;
    const stmtBId = store.statementIdByEntityId.get('cust-b')!;
    const stmtSupId = store.statementIdByEntityId.get('sup-1')!;

    expect(store.statementsById.get(stmtAId)?.currentBalance).toBe(150);
    expect(store.statementsById.get(stmtBId)?.currentBalance).toBe(-10);
    expect(store.statementsById.get(stmtSupId)?.currentBalance).toBe(-30);

    const receivable = await getTotalReceivable();
    expect(receivable.pendingAmount).toBe(150);

    const summary = await getFinanceSummary();
    expect(summary).toEqual(
      expect.objectContaining({
        totalCustomers: 2,
        totalSuppliers: 1,
        totalReceivable: 150,
        totalPayable: 30,
      })
    );

    const totalRefundable = await getTotalRefundable();
    expect(totalRefundable).toBe(10);
  });

  test('同一伙伴兼客户/供应商：partnerRole 应合并为 both，并在汇总中同时计入客户/供应商数量', async () => {
    resetPrisma({
      customers: [
        {
          id: 'partner-1',
          name: '往来伙伴',
          phone: null,
          address: null,
          role: 'both',
        },
      ],
    });

    await recordPartnerTransaction(
      {
        partnerId: 'partner-1',
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: 100,
        referenceId: 'so-partner',
        referenceNumber: 'SO-P',
        description: '销售 SO-P',
        occurredAt: new Date('2026-02-01T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );

    await recordPartnerTransaction(
      {
        partnerId: 'partner-1',
        partnerRole: 'supplier',
        entityType: 'supplier',
        transactionType: 'purchase',
        amount: 60,
        referenceId: 'po-partner',
        referenceNumber: 'PO-P',
        description: '采购 PO-P',
        occurredAt: new Date('2026-02-02T00:00:00.000Z'),
        userId: 'user-1',
      },
      prisma
    );

    const summary = await getFinanceSummary();
    expect(summary).toEqual(
      expect.objectContaining({
        totalCustomers: 1,
        totalSuppliers: 1,
        totalReceivable: 40,
        totalPayable: 0,
      })
    );
  });

  test('应退统计：仅 pending/processing 且 remaining>0 且未作废的退款计入 totalRefundable', async () => {
    resetPrisma({
      customers: [
        {
          id: 'cust-1',
          name: '客户1',
          phone: null,
          address: null,
          role: 'customer',
        },
      ],
      refundRecords: [
        {
          id: 'rf-1',
          remainingAmount: 10,
          status: 'pending',
          voidedAt: null,
        },
        {
          id: 'rf-2',
          remainingAmount: 5,
          status: 'processing',
          voidedAt: null,
        },
        {
          id: 'rf-3',
          remainingAmount: 7,
          status: 'completed',
          voidedAt: null,
        },
        {
          id: 'rf-4',
          remainingAmount: 3,
          status: 'pending',
          voidedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'rf-5',
          remainingAmount: 0,
          status: 'pending',
          voidedAt: null,
        },
      ],
    });

    const totalRefundable = await getTotalRefundable();
    expect(totalRefundable).toBe(15);
  });
});
