import {
  createCustomer,
  deleteCustomer,
  getCustomerDetail,
  getCustomerList,
  updateCustomer,
} from '@/lib/api/customer-handlers';
import type { CustomerQueryParams } from '@/lib/types/customer';


jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'development',
  },
  customerConfig: {
    searchLimit: 20,
    tagLimit: 10,
  },
  paginationConfig: {
    defaultPageSize: 20,
    maxPageSize: 200,
  },
}));

// Provide a stable prisma export object and mutate its methods per test
jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { prisma } = jest.requireMock('@/lib/db') as { prisma: any };

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  extendedInfo: string | null;
  parentCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SalesOrderRow = {
  id: string;
  customerId: string;
  orderNumber: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  createdAt: Date;
};

type ReturnOrderRow = {
  id: string;
  customerId: string;
  returnNumber: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
};

type InMemoryStore = {
  customersById: Map<string, CustomerRow>;
  salesOrdersById: Map<string, SalesOrderRow>;
  returnOrdersById: Map<string, ReturnOrderRow>;
  factoryShipmentCountByCustomerId: Map<string, number>;
  paymentCountByCustomerId: Map<string, number>;
  refundCountByCustomerId: Map<string, number>;
  outboundCountByCustomerId: Map<string, number>;
  customerProductPriceCountByCustomerId: Map<string, number>;
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

function applyCustomerWhere(row: CustomerRow, where: any): boolean {
  if (!where) return true;

  if (where.id !== undefined) {
    if (typeof where.id === 'string') {
      if (row.id !== where.id) return false;
    } else if (where.id?.not !== undefined) {
      if (row.id === where.id.not) return false;
    }
  }

  if (where.phone !== undefined) {
    if (typeof where.phone === 'string') {
      if ((row.phone ?? '') !== where.phone) return false;
    } else if (where.phone?.contains !== undefined) {
      if (!matchContains(row.phone, String(where.phone.contains))) return false;
    }
  }

  if (where.name?.contains !== undefined) {
    if (!matchContains(row.name, String(where.name.contains))) return false;
  }

  if (where.address?.contains !== undefined) {
    if (!matchContains(row.address, String(where.address.contains)))
      return false;
  }

  if (where.parentCustomerId !== undefined) {
    if ((row.parentCustomerId ?? null) !== (where.parentCustomerId ?? null)) {
      return false;
    }
  }

  if (where.NOT?.id !== undefined) {
    if (row.id === where.NOT.id) return false;
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const anyMatch = where.OR.some((cond: any) =>
      applyCustomerWhere(row, cond)
    );
    if (!anyMatch) return false;
  }

  return true;
}

function pickSelected(row: any, select: any) {
  if (!select) return clone(row);
  const result: any = {};
  for (const key of Object.keys(select)) {
    const selector = select[key];
    if (selector === true) {
      result[key] = clone(row[key]);
      continue;
    }
    if (selector && typeof selector === 'object') {
      if (Array.isArray(row[key])) {
        result[key] = clone(row[key]);
        continue;
      }
      if ('select' in selector) {
        const nextRow = row[key];
        result[key] = nextRow ? pickSelected(nextRow, selector.select) : null;
      } else {
        result[key] = pickSelected(row[key], selector);
      }
    }
  }
  return result;
}

function createInMemoryCustomerPrisma(seed?: {
  customers?: CustomerRow[];
  salesOrders?: SalesOrderRow[];
  returnOrders?: ReturnOrderRow[];
  factoryShipmentCounts?: Array<{ customerId: string; count: number }>;
  paymentCounts?: Array<{ customerId: string; count: number }>;
  refundCounts?: Array<{ customerId: string; count: number }>;
  outboundCounts?: Array<{ customerId: string; count: number }>;
  customerProductPriceCounts?: Array<{ customerId: string; count: number }>;
}) {
  const store: InMemoryStore = {
    customersById: new Map(),
    salesOrdersById: new Map(),
    returnOrdersById: new Map(),
    factoryShipmentCountByCustomerId: new Map(),
    paymentCountByCustomerId: new Map(),
    refundCountByCustomerId: new Map(),
    outboundCountByCustomerId: new Map(),
    customerProductPriceCountByCustomerId: new Map(),
  };

  let nextId = 1;
  const genId = (prefix: string) => {
    while (true) {
      const candidate = `${prefix}-${nextId++}`;
      if (!store.customersById.has(candidate)) {
        return candidate;
      }
    }
  };

  for (const row of seed?.customers ?? []) {
    store.customersById.set(row.id, clone(row));
  }
  for (const row of seed?.salesOrders ?? []) {
    store.salesOrdersById.set(row.id, clone(row));
  }
  for (const row of seed?.returnOrders ?? []) {
    store.returnOrdersById.set(row.id, clone(row));
  }
  for (const row of seed?.factoryShipmentCounts ?? []) {
    store.factoryShipmentCountByCustomerId.set(row.customerId, row.count);
  }
  for (const row of seed?.paymentCounts ?? []) {
    store.paymentCountByCustomerId.set(row.customerId, row.count);
  }
  for (const row of seed?.refundCounts ?? []) {
    store.refundCountByCustomerId.set(row.customerId, row.count);
  }
  for (const row of seed?.outboundCounts ?? []) {
    store.outboundCountByCustomerId.set(row.customerId, row.count);
  }
  for (const row of seed?.customerProductPriceCounts ?? []) {
    store.customerProductPriceCountByCustomerId.set(row.customerId, row.count);
  }

  const memPrisma: any = {
    customer: {
      findMany: async (args: any) => {
        const where = args?.where ?? undefined;
        const orderBy = args?.orderBy ?? undefined;
        const take = typeof args?.take === 'number' ? args.take : undefined;
        const skip = typeof args?.skip === 'number' ? args.skip : 0;
        const cursorId = args?.cursor?.id as string | undefined;

        let rows = Array.from(store.customersById.values()).filter(row =>
          applyCustomerWhere(row, where)
        );

        rows = orderBy ? applyOrderBy(rows, orderBy) : rows;

        if (cursorId) {
          const index = rows.findIndex(r => r.id === cursorId);
          if (index >= 0) {
            rows = rows.slice(index + skip);
          } else if (skip > 0) {
            rows = rows.slice(skip);
          }
        } else if (skip > 0) {
          rows = rows.slice(skip);
        }

        if (typeof take === 'number') {
          rows = rows.slice(0, take);
        }

        return rows.map(row => {
          const parentCustomer = row.parentCustomerId
            ? (store.customersById.get(row.parentCustomerId) ?? null)
            : null;
          const countSales = Array.from(store.salesOrdersById.values()).filter(
            o => o.customerId === row.id
          ).length;
          const countReturns = Array.from(
            store.returnOrdersById.values()
          ).filter(o => o.customerId === row.id).length;
          const decorated = {
            ...clone(row),
            parentCustomer: parentCustomer ? clone(parentCustomer) : null,
            _count: {
              salesOrders: countSales,
              returnOrders: countReturns,
            },
          };
          return pickSelected(decorated, args?.select);
        });
      },

      count: async (args: any) => {
        const where = args?.where ?? undefined;
        return Array.from(store.customersById.values()).filter(row =>
          applyCustomerWhere(row, where)
        ).length;
      },

      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const row = store.customersById.get(id);
        if (!row) return null;

        const include = args?.include ?? undefined;
        const select = args?.select ?? undefined;

        const parentCustomer = row.parentCustomerId
          ? (store.customersById.get(row.parentCustomerId) ?? null)
          : null;
        const childCustomers = Array.from(store.customersById.values()).filter(
          customer => customer.parentCustomerId === row.id
        );
        const salesOrders = Array.from(store.salesOrdersById.values()).filter(
          order => order.customerId === row.id
        );
        const returnOrders = Array.from(store.returnOrdersById.values()).filter(
          order => order.customerId === row.id
        );

        const countSales = salesOrders.length;
        const countReturns = returnOrders.length;

        const decorated: any = {
          ...clone(row),
          parentCustomer: parentCustomer ? clone(parentCustomer) : null,
          childCustomers: childCustomers.map(clone),
          salesOrders: salesOrders.map(clone),
          returnOrders: returnOrders.map(clone),
          _count: {
            salesOrders: countSales,
            returnOrders: countReturns,
          },
        };

        if (include) {
          if (include.parentCustomer && include.parentCustomer.select) {
            decorated.parentCustomer = parentCustomer
              ? pickSelected(parentCustomer, include.parentCustomer.select)
              : null;
          }
          if (include.childCustomers) {
            decorated.childCustomers = childCustomers.map(clone);
          }
          if (include.salesOrders) {
            decorated.salesOrders = salesOrders.map(clone);
          }
          return clone(decorated);
        }

        if (select) {
          // Apply query-time modifiers for relations
          if (select.childCustomers?.orderBy?.createdAt) {
            decorated.childCustomers = applyOrderBy(
              decorated.childCustomers,
              select.childCustomers.orderBy
            );
          }
          if (select.salesOrders?.orderBy?.createdAt) {
            decorated.salesOrders = applyOrderBy(
              decorated.salesOrders,
              select.salesOrders.orderBy
            );
            if (typeof select.salesOrders.take === 'number') {
              decorated.salesOrders = decorated.salesOrders.slice(
                0,
                select.salesOrders.take
              );
            }
          }
          if (select.returnOrders?.orderBy?.createdAt) {
            decorated.returnOrders = applyOrderBy(
              decorated.returnOrders,
              select.returnOrders.orderBy
            );
            if (typeof select.returnOrders.take === 'number') {
              decorated.returnOrders = decorated.returnOrders.slice(
                0,
                select.returnOrders.take
              );
            }
          }

          return pickSelected(decorated, select);
        }

        return clone(row);
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const now = new Date();
        const id = String(data.id ?? genId('cust'));
        const created: CustomerRow = {
          id,
          name: String(data.name ?? ''),
          phone: data.phone ?? null,
          address: data.address ?? null,
          extendedInfo: data.extendedInfo ?? null,
          parentCustomerId: data.parentCustomerId ?? null,
          createdAt: now,
          updatedAt: now,
        };

        store.customersById.set(id, clone(created));

        const parentCustomer = created.parentCustomerId
          ? (store.customersById.get(created.parentCustomerId) ?? null)
          : null;
        const decorated: any = {
          ...clone(created),
          parentCustomer: parentCustomer ? clone(parentCustomer) : null,
        };

        if (args?.include?.parentCustomer?.select) {
          decorated.parentCustomer = parentCustomer
            ? pickSelected(parentCustomer, args.include.parentCustomer.select)
            : null;
        }

        return clone(decorated);
      },

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        const row = store.customersById.get(id);
        if (!row) throw new Error('NotFound');

        const data = args?.data ?? {};
        const updated: CustomerRow = {
          ...clone(row),
          name: data.name ?? row.name,
          phone: data.phone === undefined ? row.phone : data.phone,
          address: data.address === undefined ? row.address : data.address,
          extendedInfo:
            data.extendedInfo === undefined
              ? row.extendedInfo
              : data.extendedInfo,
          parentCustomerId:
            data.parentCustomerId === undefined
              ? row.parentCustomerId
              : data.parentCustomerId,
          updatedAt: new Date(),
        };

        store.customersById.set(id, clone(updated));

        const parentCustomer = updated.parentCustomerId
          ? (store.customersById.get(updated.parentCustomerId) ?? null)
          : null;
        const decorated: any = {
          ...clone(updated),
          parentCustomer: parentCustomer ? clone(parentCustomer) : null,
        };

        if (args?.include?.parentCustomer?.select) {
          decorated.parentCustomer = parentCustomer
            ? pickSelected(parentCustomer, args.include.parentCustomer.select)
            : null;
        }

        return clone(decorated);
      },

      delete: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('MissingId');
        store.customersById.delete(id);
        return { id };
      },
    },

    salesOrder: {
      groupBy: async (args: any) => {
        const where = args?.where ?? {};
        const ids: string[] = where?.customerId?.in ?? [];
        const statusNotIn: string[] = where?.status?.notIn ?? [];
        const statusNot: string | undefined = where?.status?.not ?? undefined;

        const orders = Array.from(store.salesOrdersById.values()).filter(
          order => {
            if (ids.length > 0 && !ids.includes(order.customerId)) return false;
            if (statusNotIn.length > 0 && statusNotIn.includes(order.status)) {
              return false;
            }
            if (statusNot && order.status === statusNot) return false;
            return true;
          }
        );

        const grouped = new Map<string, SalesOrderRow[]>();
        for (const order of orders) {
          const bucket = grouped.get(order.customerId) ?? [];
          bucket.push(order);
          grouped.set(order.customerId, bucket);
        }

        return Array.from(grouped.entries()).map(([customerId, bucket]) => {
          const out: any = { customerId };
          if (args?._sum?.totalAmount) {
            out._sum = out._sum ?? {};
            out._sum.totalAmount = bucket.reduce(
              (sum, row) => sum + Number(row.totalAmount ?? 0),
              0
            );
          }
          if (args?._count?.id) {
            out._count = out._count ?? {};
            out._count.id = bucket.length;
          }
          if (args?._min?.createdAt) {
            out._min = out._min ?? {};
            out._min.createdAt = bucket.reduce<Date | null>((min, row) => {
              if (!min) return row.createdAt;
              return row.createdAt.getTime() < min.getTime()
                ? row.createdAt
                : min;
            }, null);
          }
          if (args?._max?.createdAt) {
            out._max = out._max ?? {};
            out._max.createdAt = bucket.reduce<Date | null>((max, row) => {
              if (!max) return row.createdAt;
              return row.createdAt.getTime() > max.getTime()
                ? row.createdAt
                : max;
            }, null);
          }
          return out;
        });
      },
    },

    returnOrder: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return Array.from(store.returnOrdersById.values()).filter(order =>
          customerId ? order.customerId === customerId : true
        ).length;
      },

      groupBy: async (args: any) => {
        const where = args?.where ?? {};
        const ids: string[] = where?.customerId?.in ?? [];
        const statusNot: string | undefined = where?.status?.not ?? undefined;
        const statusNotIn: string[] = where?.status?.notIn ?? [];

        const orders = Array.from(store.returnOrdersById.values()).filter(
          order => {
            if (ids.length > 0 && !ids.includes(order.customerId)) return false;
            if (statusNot && order.status === statusNot) return false;
            if (statusNotIn.length > 0 && statusNotIn.includes(order.status)) {
              return false;
            }
            return true;
          }
        );

        const grouped = new Map<string, ReturnOrderRow[]>();
        for (const order of orders) {
          const bucket = grouped.get(order.customerId) ?? [];
          bucket.push(order);
          grouped.set(order.customerId, bucket);
        }

        return Array.from(grouped.entries()).map(([customerId, bucket]) => {
          const out: any = { customerId };
          if (args?._count?.id) {
            out._count = out._count ?? {};
            out._count.id = bucket.length;
          }
          return out;
        });
      },
    },

    factoryShipmentOrder: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return (
          store.factoryShipmentCountByCustomerId.get(customerId ?? '') ?? 0
        );
      },
    },

    paymentRecord: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return store.paymentCountByCustomerId.get(customerId ?? '') ?? 0;
      },
    },

    refundRecord: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return store.refundCountByCustomerId.get(customerId ?? '') ?? 0;
      },
    },

    outboundRecord: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return store.outboundCountByCustomerId.get(customerId ?? '') ?? 0;
      },
    },

    customerProductPrice: {
      count: async (args: any) => {
        const where = args?.where ?? {};
        const customerId: string | undefined = where.customerId;
        return (
          store.customerProductPriceCountByCustomerId.get(customerId ?? '') ?? 0
        );
      },
    },
  };

  return { prisma: memPrisma, store };
}

function resetPrisma(
  seed?: Parameters<typeof createInMemoryCustomerPrisma>[0]
) {
  const { prisma: memPrisma, store } = createInMemoryCustomerPrisma(seed);
  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);
  return { store };
}

describe('客户模块（集成回归）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createCustomer：同地区手机号必须唯一；支持创建子客户并回填 parentCustomer', async () => {
    resetPrisma({
      customers: [
        {
          id: 'cust-1',
          name: '已存在客户',
          phone: '13800138000',
          address: null,
          extendedInfo: JSON.stringify({ region: '华东' }),
          parentCustomerId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      createCustomer({
        name: '新客户',
        phone: '13800138000',
        extendedInfo: { region: '华东' },
      })
    ).rejects.toThrow('地区「华东」已存在使用手机号 13800138000 的客户');

    const created = await createCustomer({
      name: '子客户',
      phone: '13800138000',
      parentCustomerId: 'cust-1',
      extendedInfo: { region: '华南', contactPerson: '张三' },
    });

    expect(created.parentCustomerId).toBe('cust-1');
    expect(created.parentCustomer?.id).toBe('cust-1');
    expect(created.parentCustomer?.name).toBe('已存在客户');

    const info = JSON.parse(created.extendedInfo ?? '{}') as {
      region?: string;
    };
    expect(info.region).toBe('华南');
  });

  test('updateCustomer：更新扩展信息应保留未改字段（避免丢失 region 等关键字段）', async () => {
    resetPrisma({
      customers: [
        {
          id: 'cust-1',
          name: '客户A',
          phone: '13800138000',
          address: null,
          extendedInfo: JSON.stringify({
            region: '华东',
            contactPerson: '老王',
          }),
          parentCustomerId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const updated = await updateCustomer('cust-1', {
      extendedInfo: { contactPerson: '张三' },
    });

    const info = JSON.parse(updated.extendedInfo ?? '{}') as {
      region?: string;
      contactPerson?: string;
    };
    expect(info.region).toBe('华东');
    expect(info.contactPerson).toBe('张三');
  });

  test('updateCustomer：父子关系变更应检测循环引用', async () => {
    resetPrisma({
      customers: [
        {
          id: 'A',
          name: 'A',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'B',
          name: 'B',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: 'A',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      updateCustomer('A', { parentCustomerId: 'B' })
    ).rejects.toThrow('无法设置父级客户,会形成循环引用');
  });

  test('deleteCustomer：应阻止删除存在子客户/订单的客户；无关联时可删除', async () => {
    const { store } = resetPrisma({
      customers: [
        {
          id: 'cust-parent',
          name: '父客户',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'cust-child',
          name: '子客户',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: 'cust-parent',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: 'cust-sales',
          name: '有订单客户',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: null,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        },
        {
          id: 'cust-ok',
          name: '可删除客户',
          phone: null,
          address: null,
          extendedInfo: null,
          parentCustomerId: null,
          createdAt: new Date('2026-01-04T00:00:00.000Z'),
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
        },
      ],
      salesOrders: [
        {
          id: 'so-1',
          customerId: 'cust-sales',
          orderNumber: 'SO-1',
          totalAmount: 10,
          paidAmount: 0,
          status: 'confirmed',
          createdAt: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
    });

    await expect(deleteCustomer('cust-parent')).rejects.toThrow('子客户');
    await expect(deleteCustomer('cust-sales')).rejects.toThrow(
      '关联的销售订单'
    );

    await expect(deleteCustomer('cust-ok')).resolves.toBeUndefined();
    expect(store.customersById.has('cust-ok')).toBe(false);
  });

  test('getCustomerList：应聚合交易金额/次数与退货次数，并支持按计算字段排序', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));

    try {
      resetPrisma({
        customers: [
          {
            id: 'cust-1',
            name: '客户1',
            phone: '13800138000',
            address: 'addr1',
            extendedInfo: JSON.stringify({ region: '华东' }),
            parentCustomerId: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            id: 'cust-2',
            name: '客户2',
            phone: '13900139000',
            address: 'addr2',
            extendedInfo: JSON.stringify({ region: '华南' }),
            parentCustomerId: null,
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
        salesOrders: [
          {
            id: 'so-1',
            customerId: 'cust-1',
            orderNumber: 'SO-0001',
            totalAmount: 100,
            paidAmount: 0,
            status: 'confirmed',
            createdAt: new Date('2026-01-05T00:00:00.000Z'),
          },
          {
            id: 'so-2',
            customerId: 'cust-1',
            orderNumber: 'SO-0002',
            totalAmount: 50,
            paidAmount: 0,
            status: 'draft',
            createdAt: new Date('2026-01-06T00:00:00.000Z'),
          },
          {
            id: 'so-3',
            customerId: 'cust-2',
            orderNumber: 'SO-0003',
            totalAmount: 200,
            paidAmount: 0,
            status: 'completed',
            createdAt: new Date('2026-01-03T00:00:00.000Z'),
          },
        ],
        returnOrders: [
          {
            id: 'ro-1',
            customerId: 'cust-1',
            returnNumber: 'RT-0001',
            totalAmount: 10,
            status: 'completed',
            createdAt: new Date('2026-01-07T00:00:00.000Z'),
          },
          {
            id: 'ro-2',
            customerId: 'cust-1',
            returnNumber: 'RT-0002',
            totalAmount: 10,
            status: 'cancelled',
            createdAt: new Date('2026-01-08T00:00:00.000Z'),
          },
          {
            id: 'ro-3',
            customerId: 'cust-2',
            returnNumber: 'RT-0003',
            totalAmount: 5,
            status: 'processing',
            createdAt: new Date('2026-01-09T00:00:00.000Z'),
          },
        ],
      });

      const params: CustomerQueryParams = {
        page: 1,
        limit: 10,
        sortBy: 'totalAmount',
        sortOrder: 'desc',
      };
      const result = await getCustomerList(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe('cust-2');
      expect(result.data[0]?.totalAmount).toBe(200);
      expect(result.data[0]?.transactionCount).toBe(1);
      expect(result.data[0]?.returnOrderCount).toBe(1);
      expect(result.data[0]?.cooperationDays).toBe(7);

      expect(result.data[1]?.id).toBe('cust-1');
      expect(result.data[1]?.totalOrders).toBe(2);
      expect(result.data[1]?.totalAmount).toBe(100);
      expect(result.data[1]?.transactionCount).toBe(1);
      expect(result.data[1]?.returnOrderCount).toBe(1);
      expect(result.data[1]?.cooperationDays).toBe(5);
      expect(result.data[1]?.lastOrderDate).toBe(
        new Date('2026-01-06T00:00:00.000Z').toISOString()
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('getCustomerDetail：应返回子客户/订单摘要，并按 createdAt desc 计算 lastOrderDate', async () => {
    resetPrisma({
      customers: [
        {
          id: 'cust-parent',
          name: '父客户',
          phone: null,
          address: null,
          extendedInfo: JSON.stringify({
            region: '华东',
            contactPerson: '老王',
          }),
          parentCustomerId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'cust-child',
          name: '子客户',
          phone: null,
          address: null,
          extendedInfo: JSON.stringify({ region: '华东' }),
          parentCustomerId: 'cust-parent',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      salesOrders: [
        {
          id: 'so-1',
          customerId: 'cust-parent',
          orderNumber: 'SO-0001',
          totalAmount: 100,
          paidAmount: 0,
          status: 'confirmed',
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        },
        {
          id: 'so-2',
          customerId: 'cust-parent',
          orderNumber: 'SO-0002',
          totalAmount: 50,
          paidAmount: 0,
          status: 'completed',
          createdAt: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
      returnOrders: [
        {
          id: 'ro-1',
          customerId: 'cust-parent',
          returnNumber: 'RT-0001',
          totalAmount: 10,
          status: 'completed',
          createdAt: new Date('2026-01-06T00:00:00.000Z'),
        },
      ],
    });

    const detail = await getCustomerDetail('cust-parent');

    expect(detail.id).toBe('cust-parent');
    expect(detail.childCustomers?.length).toBe(1);
    expect(detail.totalOrders).toBe(2);
    expect(detail.totalAmount).toBe(150);
    expect(detail.salesOrders).toHaveLength(2);
    expect(detail.returnOrders).toHaveLength(1);
    expect(detail.lastOrderDate).toBe(
      new Date('2026-01-05T00:00:00.000Z').toISOString()
    );

    const info = JSON.parse(detail.extendedInfo ?? '{}') as { region?: string };
    expect(info.region).toBe('华东');
  });
});
