import type { Prisma } from '@prisma/client';

import {
  createSupplier,
  deleteSupplier,
  ensureSupplierCanBeDeactivated,
  ensureSupplierCanBeDeleted,
  getSuppliers,
  updateSupplier,
} from '@/lib/services/supplier-service';

jest.mock('@/lib/utils/supplier-utils', () => ({
  generateSupplierCode: jest.fn(),
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

const { generateSupplierCode } = jest.requireMock(
  '@/lib/utils/supplier-utils'
) as {
  generateSupplierCode: jest.Mock;
};

type SupplierRow = {
  id: string;
  name: string;
  supplierCode: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type Store = {
  suppliersById: Map<string, SupplierRow>;
  salesOrderCountBySupplierId: Map<string, number>;
  shipmentItemCountBySupplierId: Map<string, number>;
  payableCountBySupplierId: Map<string, number>;
  paymentOutCountBySupplierId: Map<string, number>;
  temporaryProductCountBySupplierId: Map<string, number>;
  purchaseOrderCountBySupplierId: Map<string, number>;
  purchaseOrderItemCountBySupplierId: Map<string, number>;
  activeShipmentCountBySupplierId: Map<string, number>;
  unpaidPayablesCountBySupplierId: Map<string, number>;
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

type OrderDirection = 'asc' | 'desc';

function applyOrderBy(entries: any[], orderBy: any): any[] {
  const clauses: Array<{ field: string; dir: OrderDirection }> = Array.isArray(
    orderBy
  )
    ? orderBy.map((o: any) => {
        const field = Object.keys(o)[0] as string;
        return { field, dir: o[field] as OrderDirection };
      })
    : orderBy
      ? [
          {
            field: Object.keys(orderBy)[0] as string,
            dir: (orderBy as any)[Object.keys(orderBy)[0]] as OrderDirection,
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

  return [...entries].sort((a, b) => {
    for (const c of clauses) {
      const av = getComparable(a, c.field);
      const bv = getComparable(b, c.field);
      if (av === bv) continue;
      const diff = av < bv ? -1 : 1;
      return c.dir === 'asc' ? diff : -diff;
    }
    return 0;
  });
}

function matchContains(value: string | null, needle: string) {
  if (!needle) return true;
  const hay = (value ?? '').toLowerCase();
  return hay.includes(needle.toLowerCase());
}

function applySupplierWhere(row: SupplierRow, where: any): boolean {
  if (!where) return true;

  if (where.name !== undefined) {
    if (typeof where.name === 'string') {
      if (row.name !== where.name) return false;
    } else if (where.name?.contains !== undefined) {
      if (!matchContains(row.name, String(where.name.contains))) return false;
    }
  }

  if (where.supplierCode !== undefined) {
    if (typeof where.supplierCode === 'string') {
      if ((row.supplierCode ?? '') !== where.supplierCode) return false;
    }
  }

  if (where.phone?.contains !== undefined) {
    if (!matchContains(row.phone, String(where.phone.contains))) return false;
  }

  if (where.status !== undefined) {
    if (row.status !== where.status) return false;
  }

  if (where.id?.not !== undefined) {
    if (row.id === where.id.not) return false;
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const anyMatch = where.OR.some((cond: any) =>
      applySupplierWhere(row, cond)
    );
    if (!anyMatch) return false;
  }

  return true;
}

function pickSelected(row: any, select: any) {
  if (!select) return clone(row);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      result[key] = clone(row[key]);
    }
  }
  return result;
}

function createInMemorySupplierPrisma(seed?: {
  suppliers?: SupplierRow[];
  counts?: Partial<{
    salesOrders: Array<{ supplierId: string; count: number }>;
    shipmentItems: Array<{ supplierId: string; count: number }>;
    payables: Array<{ supplierId: string; count: number }>;
    paymentOuts: Array<{ supplierId: string; count: number }>;
    temporaryProducts: Array<{ supplierId: string; count: number }>;
    purchaseOrders: Array<{ supplierId: string; count: number }>;
    purchaseOrderItems: Array<{ supplierId: string; count: number }>;
    activeShipments: Array<{ supplierId: string; count: number }>;
    unpaidPayables: Array<{ supplierId: string; count: number }>;
  }>;
}) {
  const store: Store = {
    suppliersById: new Map(),
    salesOrderCountBySupplierId: new Map(),
    shipmentItemCountBySupplierId: new Map(),
    payableCountBySupplierId: new Map(),
    paymentOutCountBySupplierId: new Map(),
    temporaryProductCountBySupplierId: new Map(),
    purchaseOrderCountBySupplierId: new Map(),
    purchaseOrderItemCountBySupplierId: new Map(),
    activeShipmentCountBySupplierId: new Map(),
    unpaidPayablesCountBySupplierId: new Map(),
  };

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  for (const row of seed?.suppliers ?? []) {
    store.suppliersById.set(row.id, clone(row));
  }

  for (const row of seed?.counts?.salesOrders ?? []) {
    store.salesOrderCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.shipmentItems ?? []) {
    store.shipmentItemCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.payables ?? []) {
    store.payableCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.paymentOuts ?? []) {
    store.paymentOutCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.temporaryProducts ?? []) {
    store.temporaryProductCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.purchaseOrders ?? []) {
    store.purchaseOrderCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.purchaseOrderItems ?? []) {
    store.purchaseOrderItemCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.activeShipments ?? []) {
    store.activeShipmentCountBySupplierId.set(row.supplierId, row.count);
  }
  for (const row of seed?.counts?.unpaidPayables ?? []) {
    store.unpaidPayablesCountBySupplierId.set(row.supplierId, row.count);
  }

  const snapshotStore = () => ({
    suppliersById: new Map(
      Array.from(store.suppliersById.entries()).map(([k, v]) => [k, clone(v)])
    ),
  });

  const restoreSnapshot = (snapshot: ReturnType<typeof snapshotStore>) => {
    store.suppliersById.clear();
    for (const [k, v] of snapshot.suppliersById.entries()) {
      store.suppliersById.set(k, clone(v));
    }
  };

  const tx = {
    supplier: {
      findFirst: async (args: any) => {
        const where = args?.where ?? undefined;
        const found = Array.from(store.suppliersById.values()).find(row =>
          applySupplierWhere(row, where)
        );
        if (!found) return null;
        return pickSelected(found, args?.select);
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const id = String(data.id ?? genId('sup'));
        const now = new Date();
        const created: SupplierRow = {
          id,
          name: String(data.name ?? ''),
          supplierCode: data.supplierCode ?? null,
          phone: data.phone ?? null,
          address: data.address ?? null,
          status: String(data.status ?? 'active'),
          createdAt: now,
          updatedAt: now,
        };
        store.suppliersById.set(id, clone(created));
        return pickSelected(created, args?.select);
      },
    },
  };

  const memPrisma: any = {
    supplier: {
      findMany: async (args: any) => {
        const where = args?.where ?? undefined;
        const orderBy = args?.orderBy ?? undefined;
        const skip = typeof args?.skip === 'number' ? args.skip : 0;
        const take = typeof args?.take === 'number' ? args.take : undefined;

        let rows = Array.from(store.suppliersById.values()).filter(row =>
          applySupplierWhere(row, where)
        );

        rows = orderBy ? applyOrderBy(rows, orderBy) : rows;

        if (skip > 0) {
          rows = rows.slice(skip);
        }
        if (typeof take === 'number') {
          rows = rows.slice(0, take);
        }

        return rows.map(row => pickSelected(row, args?.select));
      },

      count: async (args: any) => {
        const where = args?.where ?? undefined;
        return Array.from(store.suppliersById.values()).filter(row =>
          applySupplierWhere(row, where)
        ).length;
      },

      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const row = store.suppliersById.get(id);
        if (!row) return null;
        return pickSelected(row, args?.select);
      },

      findFirst: tx.supplier.findFirst,

      create: tx.supplier.create,

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const row = store.suppliersById.get(id);
        if (!row) throw new Error('NotFound');

        const data = args?.data ?? {};
        const updated: SupplierRow = {
          ...clone(row),
          name: data.name ?? row.name,
          phone: data.phone === undefined ? row.phone : data.phone,
          address: data.address === undefined ? row.address : data.address,
          status: data.status ?? row.status,
          updatedAt: new Date(),
        };
        store.suppliersById.set(id, clone(updated));
        return pickSelected(updated, args?.select);
      },
    },

    factoryShipmentOrder: {
      count: async (args: any) => {
        const supplierId = args?.where?.items?.some?.supplierId as
          | string
          | undefined;
        return store.activeShipmentCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    payableRecord: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        const statusNotIn = args?.where?.status?.notIn as string[] | undefined;
        if (statusNotIn && statusNotIn.includes('paid')) {
          return (
            store.unpaidPayablesCountBySupplierId.get(supplierId ?? '') ?? 0
          );
        }
        return store.payableCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    paymentOutRecord: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return store.paymentOutCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    salesOrder: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return store.salesOrderCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    factoryShipmentOrderItem: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return store.shipmentItemCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    temporaryProduct: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return (
          store.temporaryProductCountBySupplierId.get(supplierId ?? '') ?? 0
        );
      },
    },

    purchaseOrder: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return store.purchaseOrderCountBySupplierId.get(supplierId ?? '') ?? 0;
      },
    },

    purchaseOrderItem: {
      count: async (args: any) => {
        const supplierId = args?.where?.supplierId as string | undefined;
        return (
          store.purchaseOrderItemCountBySupplierId.get(supplierId ?? '') ?? 0
        );
      },
    },

    $transaction: async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg !== 'function') {
        throw new Error('Unsupported $transaction signature');
      }
      const snapshot = snapshotStore();
      const idSnapshot = nextId;
      try {
        return await arg(tx as Prisma.TransactionClient);
      } catch (error) {
        restoreSnapshot(snapshot);
        nextId = idSnapshot;
        throw error;
      }
    },
  };

  return { prisma: memPrisma, tx, store };
}

function resetPrisma(
  seed?: Parameters<typeof createInMemorySupplierPrisma>[0]
) {
  const { prisma: memPrisma, store } = createInMemorySupplierPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { store };
}

describe('供应商模块（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateSupplierCode.mockResolvedValue('SUP-0001');
  });

  test('createSupplier：名称唯一；未传 supplierCode 时自动生成', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(createSupplier({ name: '供应商A' })).rejects.toThrow(
      '供应商名称已存在'
    );

    const created = await createSupplier({
      name: '供应商B',
      phone: '13800138000',
    });

    expect(created.name).toBe('供应商B');
    expect(created.supplierCode).toBe('SUP-0001');
    expect(generateSupplierCode).toHaveBeenCalledTimes(1);
  });

  test('createSupplier：自定义编码需唯一（trim 生效）', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      createSupplier({ name: '供应商B', supplierCode: ' S-001 ' })
    ).rejects.toThrow('供应商编码已存在');

    const created = await createSupplier({
      name: '供应商B',
      supplierCode: '  S-002  ',
    });
    expect(created.supplierCode).toBe('S-002');
  });

  test('updateSupplier：禁止重名；允许更新基本信息', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: '111',
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sup-2',
          name: '供应商B',
          supplierCode: 'S-002',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    await expect(updateSupplier('sup-2', { name: '供应商A' })).rejects.toThrow(
      '供应商名称已存在'
    );

    const updated = await updateSupplier('sup-2', {
      name: '供应商B(新)',
      phone: '222',
      address: 'addr',
    });
    expect(updated.name).toBe('供应商B(新)');
    expect(updated.phone).toBe('222');
    expect(updated.address).toBe('addr');
  });

  test('getSuppliers：支持 search/status 过滤与分页', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: '13800138000',
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sup-2',
          name: '供应商B',
          supplierCode: 'S-002',
          phone: '13900139000',
          address: null,
          status: 'inactive',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    const result = await getSuppliers({
      page: 1,
      limit: 10,
      search: '1380',
      status: 'active',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0]?.id).toBe('sup-1');
    expect(result.pagination.total).toBe(1);
  });

  test('ensureSupplierCanBeDeactivated：存在进行中发货或未结清应付时应阻止', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      counts: {
        activeShipments: [{ supplierId: 'sup-1', count: 2 }],
      },
    });

    await expect(
      ensureSupplierCanBeDeactivated('sup-1', '供应商A')
    ).rejects.toThrow('进行中的发货订单');

    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      counts: {
        activeShipments: [{ supplierId: 'sup-1', count: 0 }],
        unpaidPayables: [{ supplierId: 'sup-1', count: 3 }],
      },
    });

    await expect(
      ensureSupplierCanBeDeactivated('sup-1', '供应商A')
    ).rejects.toThrow('未结清的应付账款');
  });

  test('ensureSupplierCanBeDeleted：存在任一关联业务数据时应阻止', async () => {
    resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      counts: {
        salesOrders: [{ supplierId: 'sup-1', count: 1 }],
      },
    });

    await expect(
      ensureSupplierCanBeDeleted('sup-1', '供应商A')
    ).rejects.toThrow('关联的销售订单');

    await expect(
      ensureSupplierCanBeDeleted('sup-1', '供应商A')
    ).rejects.toThrow('关联的销售订单');

    // 无关联应通过
    resetPrisma({
      suppliers: [
        {
          id: 'sup-2',
          name: '供应商B',
          supplierCode: 'S-002',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      counts: {},
    });

    await expect(
      ensureSupplierCanBeDeleted('sup-2', '供应商B')
    ).resolves.toBeUndefined();
  });

  test('deleteSupplier：应软删除为 inactive', async () => {
    const { store } = resetPrisma({
      suppliers: [
        {
          id: 'sup-1',
          name: '供应商A',
          supplierCode: 'S-001',
          phone: null,
          address: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await deleteSupplier('sup-1');

    expect(store.suppliersById.get('sup-1')?.status).toBe('inactive');
  });
});
