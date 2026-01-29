type OrderDirection = 'asc' | 'desc';

export type InMemoryPrismaStore = {
  productsById: Map<string, Record<string, unknown>>;
  usersById: Map<string, Record<string, unknown>>;
  inventoriesById: Map<string, Record<string, unknown>>;
  inventoriesByKey: Map<string, string>;
  inboundById: Map<string, Record<string, unknown>>;
  inboundByRecordNumber: Map<string, string>;
  fifoById: Map<string, Record<string, unknown>>;
  outboundById: Map<string, Record<string, unknown>>;
  adjustmentsById: Map<string, Record<string, unknown>>;
  orderSequencesByKey: Map<string, Record<string, unknown>>;
};

type SeedData = Partial<{
  products: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  inventories: Array<Record<string, unknown>>;
  inboundRecords: Array<Record<string, unknown>>;
  fifoQueue: Array<Record<string, unknown>>;
  outboundRecords: Array<Record<string, unknown>>;
}>;

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

function inventoryKey(params: {
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
}): string {
  return `${params.productId}::${params.variantId ?? 'null'}::${params.batchNumber ?? 'null'}`;
}

function matchNullable(value: string | null, expected: unknown): boolean {
  if (expected === undefined) return true;
  return value === (expected as string | null);
}

function applyInventoryWhere(entry: any, where: any): boolean {
  if (!where) return true;
  if (where.id !== undefined && entry.id !== where.id) return false;
  if (where.productId !== undefined && entry.productId !== where.productId) {
    return false;
  }
  if (!matchNullable(entry.variantId ?? null, where.variantId)) return false;
  if (!matchNullable(entry.batchNumber ?? null, where.batchNumber))
    return false;
  if (where.quantity?.gte !== undefined) {
    if (!(Number(entry.quantity) >= Number(where.quantity.gte))) return false;
  }
  return true;
}

function applyFifoWhere(entry: any, where: any): boolean {
  if (!where) return true;
  if (where.id !== undefined && entry.id !== where.id) return false;
  if (where.productId !== undefined && entry.productId !== where.productId) {
    return false;
  }
  if (!matchNullable(entry.variantId ?? null, where.variantId)) return false;
  if (!matchNullable(entry.batchNumber ?? null, where.batchNumber))
    return false;
  if (
    where.inboundRecordId !== undefined &&
    entry.inboundRecordId !== where.inboundRecordId
  ) {
    return false;
  }
  if (where.remainingQty?.gt !== undefined) {
    if (!(Number(entry.remainingQty) > Number(where.remainingQty.gt))) {
      return false;
    }
  }
  if (
    where.remainingQty !== undefined &&
    typeof where.remainingQty === 'number'
  ) {
    if (Number(entry.remainingQty) !== Number(where.remainingQty)) return false;
  }
  if (where.updatedAt !== undefined) {
    const expectedMs =
      where.updatedAt instanceof Date
        ? where.updatedAt.getTime()
        : new Date(where.updatedAt).getTime();
    if (new Date(entry.updatedAt).getTime() !== expectedMs) return false;
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const anyMatch = where.OR.some((cond: any) => {
      if (cond?.inboundDate?.gt) {
        const dt = cond.inboundDate.gt as Date;
        return new Date(entry.inboundDate).getTime() > dt.getTime();
      }
      if (cond?.inboundDate && cond?.id?.gt) {
        const dt = cond.inboundDate as Date;
        const idGt = cond.id.gt as string;
        return (
          new Date(entry.inboundDate).getTime() === dt.getTime() &&
          String(entry.id) > idGt
        );
      }
      return false;
    });
    if (!anyMatch) return false;
  }

  return true;
}

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

export function createInMemoryPrisma(seed?: SeedData): {
  prisma: any;
  tx: any;
  store: InMemoryPrismaStore;
} {
  const seedNow = new Date('2026-01-01T00:00:00.000Z');
  const now = () => new Date();
  const store: InMemoryPrismaStore = {
    productsById: new Map(),
    usersById: new Map(),
    inventoriesById: new Map(),
    inventoriesByKey: new Map(),
    inboundById: new Map(),
    inboundByRecordNumber: new Map(),
    fifoById: new Map(),
    outboundById: new Map(),
    adjustmentsById: new Map(),
    orderSequencesByKey: new Map(),
  };

  let nextId = 1;
  const genId = (prefix: string) => `${prefix}-${nextId++}`;

  for (const p of seed?.products ?? []) {
    if (typeof p.id === 'string') {
      store.productsById.set(p.id, clone(p));
    }
  }
  for (const u of seed?.users ?? []) {
    if (typeof u.id === 'string') {
      store.usersById.set(u.id, clone(u));
    }
  }

  for (const raw of seed?.inventories ?? []) {
    const inv: any = {
      id: String(raw.id ?? genId('inv')),
      productId: String(raw.productId),
      variantId: raw.variantId ?? null,
      batchNumber: raw.batchNumber ?? null,
      quantity: Number(raw.quantity ?? 0),
      reservedQuantity: Number(raw.reservedQuantity ?? 0),
      unitCost:
        raw.unitCost === undefined || raw.unitCost === null
          ? null
          : Number(raw.unitCost),
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : seedNow,
    };
    store.inventoriesById.set(inv.id, clone(inv));
    store.inventoriesByKey.set(
      inventoryKey({
        productId: inv.productId,
        variantId: inv.variantId ?? null,
        batchNumber: inv.batchNumber ?? null,
      }),
      inv.id
    );
  }

  for (const raw of seed?.inboundRecords ?? []) {
    const rec: any = {
      id: String(raw.id ?? genId('inb')),
      recordNumber: String(raw.recordNumber),
      productId: String(raw.productId),
      variantId: raw.variantId ?? null,
      batchNumber: raw.batchNumber ?? null,
      batchSpecificationId: raw.batchSpecificationId ?? null,
      quantity: Number(raw.quantity ?? 0),
      unitCost:
        raw.unitCost === undefined || raw.unitCost === null
          ? null
          : Number(raw.unitCost),
      totalCost:
        raw.totalCost === undefined || raw.totalCost === null
          ? null
          : Number(raw.totalCost),
      reason: String(raw.reason ?? 'other'),
      remarks: raw.remarks ?? null,
      userId: String(raw.userId),
      purchaseOrderId: raw.purchaseOrderId ?? null,
      purchaseOrderItemId: raw.purchaseOrderItemId ?? null,
      supplierId: raw.supplierId ?? null,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : seedNow,
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : seedNow,
    };
    store.inboundById.set(rec.id, clone(rec));
    store.inboundByRecordNumber.set(rec.recordNumber, rec.id);
  }

  for (const raw of seed?.fifoQueue ?? []) {
    const rec: any = {
      id: String(raw.id ?? genId('fifo')),
      productId: String(raw.productId),
      variantId: raw.variantId ?? null,
      batchNumber: raw.batchNumber ?? null,
      inboundRecordId: String(raw.inboundRecordId),
      remainingQty: Number(raw.remainingQty ?? 0),
      unitCost: Number(raw.unitCost ?? 0),
      inboundDate: raw.inboundDate instanceof Date ? raw.inboundDate : seedNow,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : seedNow,
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : seedNow,
    };
    store.fifoById.set(rec.id, clone(rec));
  }

  for (const raw of seed?.outboundRecords ?? []) {
    const rec: any = {
      id: String(raw.id ?? genId('out')),
      recordNumber: String(raw.recordNumber),
      productId: String(raw.productId),
      variantId: raw.variantId ?? null,
      batchNumber: raw.batchNumber ?? null,
      inventoryId: String(raw.inventoryId),
      quantity: Number(raw.quantity ?? 0),
      unitCost:
        raw.unitCost === undefined || raw.unitCost === null
          ? null
          : Number(raw.unitCost),
      totalCost:
        raw.totalCost === undefined || raw.totalCost === null
          ? null
          : Number(raw.totalCost),
      reason: String(raw.reason ?? 'manual_outbound'),
      notes: raw.notes ?? null,
      customerId: raw.customerId ?? null,
      operatorId: String(raw.operatorId),
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : seedNow,
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : seedNow,
    };
    store.outboundById.set(rec.id, clone(rec));
  }

  const tx: any = {
    inventory: {
      findFirst: async (args: any) => {
        const where = args?.where ?? {};
        const orderBy = args?.orderBy;
        const entries = Array.from(store.inventoriesById.values()).filter(e =>
          applyInventoryWhere(e, where)
        );
        const sorted = applyOrderBy(entries, orderBy);
        return sorted.length > 0 ? clone(sorted[0]) : null;
      },

      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const inv = store.inventoriesById.get(id);
        if (!inv) return null;
        const include = args?.include;
        if (include?.product?.select) {
          return {
            ...clone(inv),
            product: clone(
              store.productsById.get(String((inv as any).productId)) ?? null
            ),
          };
        }
        return clone(inv);
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const inv: any = {
          id: String(data.id ?? genId('inv')),
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          quantity: Number(data.quantity ?? 0),
          reservedQuantity: Number(data.reservedQuantity ?? 0),
          unitCost:
            data.unitCost === undefined || data.unitCost === null
              ? null
              : Number(data.unitCost),
          updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now(),
        };

        const key = inventoryKey({
          productId: inv.productId,
          variantId: inv.variantId ?? null,
          batchNumber: inv.batchNumber ?? null,
        });
        if (store.inventoriesByKey.has(key)) {
          throw new Error(`Unique inventory key conflict: ${key}`);
        }

        store.inventoriesById.set(inv.id, clone(inv));
        store.inventoriesByKey.set(key, inv.id);

        const include = args?.include;
        if (include?.product?.select) {
          return {
            ...clone(inv),
            product: clone(
              store.productsById.get(String((inv as any).productId)) ?? null
            ),
          };
        }
        return clone(inv);
      },

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('Missing inventory id');
        const existing = store.inventoriesById.get(id);
        if (!existing) throw new Error('NotFound');

        const data = args?.data ?? {};
        const updated: any = clone(existing);

        if (data.quantity?.increment !== undefined) {
          updated.quantity =
            Number(updated.quantity) + Number(data.quantity.increment);
        } else if (data.quantity?.decrement !== undefined) {
          updated.quantity =
            Number(updated.quantity) - Number(data.quantity.decrement);
        } else if (typeof data.quantity === 'number') {
          updated.quantity = Number(data.quantity);
        }

        if (data.reservedQuantity?.increment !== undefined) {
          updated.reservedQuantity =
            Number(updated.reservedQuantity) +
            Number(data.reservedQuantity.increment);
        } else if (data.reservedQuantity?.decrement !== undefined) {
          updated.reservedQuantity =
            Number(updated.reservedQuantity) -
            Number(data.reservedQuantity.decrement);
          if (updated.reservedQuantity < 0) updated.reservedQuantity = 0;
        } else if (typeof data.reservedQuantity === 'number') {
          updated.reservedQuantity = Number(data.reservedQuantity);
        }

        if (data.unitCost !== undefined) {
          updated.unitCost =
            data.unitCost === null ? null : Number(data.unitCost);
        }

        updated.updatedAt =
          data.updatedAt instanceof Date ? data.updatedAt : now();
        store.inventoriesById.set(updated.id, clone(updated));

        const include = args?.include;
        if (include?.product?.select) {
          return {
            ...clone(updated),
            product: clone(
              store.productsById.get(String((updated as any).productId)) ?? null
            ),
          };
        }
        return clone(updated);
      },

      updateMany: async (args: any) => {
        const where = args?.where ?? {};
        const id = where?.id as string | undefined;
        if (!id) return { count: 0 };
        const existing = store.inventoriesById.get(id);
        if (!existing) return { count: 0 };
        if (!applyInventoryWhere(existing, where)) return { count: 0 };

        const data = args?.data ?? {};
        const updated: any = clone(existing);

        if (data.quantity?.decrement !== undefined) {
          updated.quantity =
            Number(updated.quantity) - Number(data.quantity.decrement);
        } else if (data.quantity?.increment !== undefined) {
          updated.quantity =
            Number(updated.quantity) + Number(data.quantity.increment);
        }

        if (data.reservedQuantity?.decrement !== undefined) {
          updated.reservedQuantity =
            Number(updated.reservedQuantity) -
            Number(data.reservedQuantity.decrement);
          if (updated.reservedQuantity < 0) updated.reservedQuantity = 0;
        } else if (data.reservedQuantity?.increment !== undefined) {
          updated.reservedQuantity =
            Number(updated.reservedQuantity) +
            Number(data.reservedQuantity.increment);
        }

        updated.updatedAt =
          data.updatedAt instanceof Date ? data.updatedAt : now();
        store.inventoriesById.set(updated.id, clone(updated));
        return { count: 1 };
      },
    },

    inboundRecord: {
      findUnique: async (args: any) => {
        const recordNumber = args?.where?.recordNumber as string | undefined;
        if (recordNumber) {
          const id = store.inboundByRecordNumber.get(recordNumber);
          const rec = id ? store.inboundById.get(id) : undefined;
          return rec ? clone(rec) : null;
        }
        const id = args?.where?.id as string | undefined;
        if (id) {
          const rec = store.inboundById.get(id);
          return rec ? clone(rec) : null;
        }
        return null;
      },

      findFirst: async (args: any) => {
        const where = args?.where ?? {};
        const rec = Array.from(store.inboundById.values()).find((r: any) => {
          if (
            where.productId !== undefined &&
            r.productId !== where.productId
          ) {
            return false;
          }
          if (!matchNullable(r.variantId ?? null, where.variantId))
            return false;
          if (!matchNullable(r.batchNumber ?? null, where.batchNumber))
            return false;
          if (where.reason !== undefined) {
            if (typeof where.reason === 'string') {
              if (r.reason !== where.reason) return false;
            } else if (where.reason?.not !== undefined) {
              if (r.reason === where.reason.not) return false;
            }
          }
          return true;
        });
        return rec ? clone(rec) : null;
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const recordNumber = String(data.recordNumber);
        if (store.inboundByRecordNumber.has(recordNumber)) {
          throw new Error(
            `Unique inboundRecord.recordNumber conflict: ${recordNumber}`
          );
        }
        const id = String(data.id ?? genId('inb'));
        const createdAt = now();
        const rec: any = {
          id,
          recordNumber,
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          batchSpecificationId: data.batchSpecificationId ?? null,
          quantity: Number(data.quantity ?? 0),
          unitCost:
            data.unitCost === undefined || data.unitCost === null
              ? null
              : Number(data.unitCost),
          totalCost:
            data.totalCost === undefined || data.totalCost === null
              ? null
              : Number(data.totalCost),
          reason: String(data.reason ?? 'other'),
          remarks: data.remarks ?? null,
          userId: String(data.userId),
          purchaseOrderId: data.purchaseOrderId ?? null,
          purchaseOrderItemId: data.purchaseOrderItemId ?? null,
          supplierId: data.supplierId ?? null,
          createdAt,
          updatedAt: createdAt,
        };

        store.inboundById.set(rec.id, clone(rec));
        store.inboundByRecordNumber.set(rec.recordNumber, rec.id);

        const include = args?.include;
        return {
          ...clone(rec),
          ...(include?.product?.select
            ? { product: clone(store.productsById.get(rec.productId) ?? null) }
            : {}),
          ...(include?.user?.select
            ? { user: clone(store.usersById.get(rec.userId) ?? null) }
            : {}),
        };
      },

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('Missing inboundRecord id');
        const existing = store.inboundById.get(id);
        if (!existing) throw new Error('NotFound');
        const updated: any = clone(existing);
        const data = args?.data ?? {};
        if (data.quantity !== undefined)
          updated.quantity = Number(data.quantity);
        if (data.unitCost !== undefined) {
          updated.unitCost =
            data.unitCost === null || data.unitCost === undefined
              ? null
              : Number(data.unitCost);
        }
        if (data.totalCost !== undefined) {
          updated.totalCost =
            data.totalCost === null || data.totalCost === undefined
              ? null
              : Number(data.totalCost);
        }
        updated.updatedAt = now();
        store.inboundById.set(updated.id, clone(updated));
        store.inboundByRecordNumber.set(updated.recordNumber, updated.id);
        return clone(updated);
      },
    },

    inventoryCostQueue: {
      aggregate: async (args: any) => {
        const where = args?.where ?? {};
        const sum = Array.from(store.fifoById.values())
          .filter(e => applyFifoWhere(e, where))
          .reduce((acc, e: any) => acc + Number(e.remainingQty), 0);
        return { _sum: { remainingQty: sum } };
      },

      findMany: async (args: any) => {
        const where = args?.where ?? {};
        const orderBy = args?.orderBy;
        const take = typeof args?.take === 'number' ? args.take : undefined;
        const cursorId: string | undefined = args?.cursor?.id;
        const skip = typeof args?.skip === 'number' ? args.skip : 0;

        let entries = Array.from(store.fifoById.values()).filter(e =>
          applyFifoWhere(e, where)
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
      },

      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        const entry = store.fifoById.get(id);
        return entry ? clone(entry) : null;
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const createdAt = now();
        const rec: any = {
          id: String(data.id ?? genId('fifo')),
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          inboundRecordId: String(data.inboundRecordId),
          remainingQty: Number(data.remainingQty ?? 0),
          unitCost: Number(data.unitCost ?? 0),
          inboundDate:
            data.inboundDate instanceof Date ? data.inboundDate : createdAt,
          createdAt,
          updatedAt: createdAt,
        };
        store.fifoById.set(rec.id, clone(rec));
        return clone(rec);
      },

      update: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) throw new Error('Missing fifo id');
        const existing = store.fifoById.get(id);
        if (!existing) throw new Error('NotFound');
        const updated: any = clone(existing);
        const data = args?.data ?? {};
        if (typeof data.remainingQty?.increment === 'number') {
          updated.remainingQty =
            Number(updated.remainingQty) + Number(data.remainingQty.increment);
        } else if (data.remainingQty !== undefined) {
          updated.remainingQty = Number(data.remainingQty);
        }
        updated.updatedAt = now();
        store.fifoById.set(updated.id, clone(updated));
        return clone(updated);
      },

      updateMany: async (args: any) => {
        const where = args?.where ?? {};
        const id = where?.id as string | undefined;
        if (!id) return { count: 0 };
        const existing = store.fifoById.get(id);
        if (!existing) return { count: 0 };
        if (!applyFifoWhere(existing, where)) return { count: 0 };
        const updated: any = clone(existing);
        const data = args?.data ?? {};
        if (data.remainingQty !== undefined)
          updated.remainingQty = Number(data.remainingQty);
        updated.updatedAt = now();
        store.fifoById.set(updated.id, clone(updated));
        return { count: 1 };
      },

      deleteMany: async (args: any) => {
        const where = args?.where ?? {};
        const before = store.fifoById.size;
        for (const [id, entry] of store.fifoById.entries()) {
          if (where.remainingQty?.lte !== undefined) {
            if (
              Number((entry as any).remainingQty) <=
              Number(where.remainingQty.lte)
            ) {
              store.fifoById.delete(id);
            }
          }
        }
        return { count: before - store.fifoById.size };
      },
    },

    outboundRecord: {
      findMany: async (args: any) => {
        const where = args?.where ?? {};
        const records = Array.from(store.outboundById.values()).filter(
          (r: any) => {
            if (
              where.customerId !== undefined &&
              r.customerId !== where.customerId
            ) {
              return false;
            }
            if (
              where.productId !== undefined &&
              r.productId !== where.productId
            ) {
              return false;
            }
            return true;
          }
        );

        const distinct = Array.isArray(args?.distinct)
          ? (args.distinct as string[])
          : [];
        const select = args?.select as any;

        let result = records;
        if (distinct.includes('batchNumber')) {
          const seen = new Set<string>();
          const out: any[] = [];
          for (const r of records) {
            const key =
              typeof (r as any).batchNumber === 'string'
                ? ((r as any).batchNumber as string)
                : 'null';
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(r);
          }
          result = out;
        }

        const take = typeof args?.take === 'number' ? args.take : undefined;
        if (take !== undefined) {
          result = result.slice(0, take);
        }

        if (select && Object.keys(select).length > 0) {
          return result.map(r => {
            const projected: Record<string, unknown> = {};
            for (const key of Object.keys(select)) {
              if (select[key]) projected[key] = (r as any)[key];
            }
            return projected;
          });
        }

        return result.map(r => clone(r));
      },

      create: async (args: any) => {
        const data = args?.data ?? {};
        const createdAt = now();
        const rec: any = {
          id: String(data.id ?? genId('out')),
          recordNumber: String(data.recordNumber),
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          inventoryId: String(data.inventoryId),
          quantity: Number(data.quantity ?? 0),
          unitCost:
            data.unitCost === undefined || data.unitCost === null
              ? null
              : Number(data.unitCost),
          totalCost:
            data.totalCost === undefined || data.totalCost === null
              ? null
              : Number(data.totalCost),
          reason: String(data.reason ?? 'manual_outbound'),
          notes: data.notes ?? null,
          customerId: data.customerId ?? null,
          operatorId: String(data.operatorId),
          createdAt,
          updatedAt: createdAt,
        };
        store.outboundById.set(rec.id, clone(rec));
        return clone(rec);
      },
    },

    inventoryAdjustment: {
      create: async (args: any) => {
        const data = args?.data ?? {};
        const createdAt = now();
        const rec: any = {
          id: String(data.id ?? genId('adj')),
          adjustmentNumber: String(data.adjustmentNumber),
          productId: String(data.productId),
          variantId: data.variantId ?? null,
          batchNumber: data.batchNumber ?? null,
          beforeQuantity: Number(data.beforeQuantity ?? 0),
          adjustQuantity: Number(data.adjustQuantity ?? 0),
          afterQuantity: Number(data.afterQuantity ?? 0),
          unitCost:
            data.unitCost === undefined || data.unitCost === null
              ? null
              : Number(data.unitCost),
          totalCost:
            data.totalCost === undefined || data.totalCost === null
              ? null
              : Number(data.totalCost),
          reason: String(data.reason),
          notes: data.notes ?? null,
          status: String(data.status ?? 'draft'),
          operatorId: String(data.operatorId),
          approverId: data.approverId ?? null,
          approvedAt: data.approvedAt ?? null,
          createdAt,
          updatedAt: createdAt,
        };
        store.adjustmentsById.set(rec.id, clone(rec));
        return clone(rec);
      },
    },

    orderSequence: {
      upsert: async (args: any) => {
        const where = args?.where?.sequenceType_dateKey;
        const create = args?.create ?? {};
        const update = args?.update ?? {};
        const sequenceType = String(where?.sequenceType ?? create.sequenceType);
        const dateKey = String(where?.dateKey ?? create.dateKey);
        const key = `${sequenceType}::${dateKey}`;

        const existing = store.orderSequencesByKey.get(key) as any | undefined;
        if (!existing) {
          const createdAt = now();
          const rec: any = {
            id: genId('seq'),
            sequenceType,
            dateKey,
            currentSequence: Number(create.currentSequence ?? 0),
            createdAt,
            updatedAt: createdAt,
          };
          store.orderSequencesByKey.set(key, clone(rec));
          return clone(rec);
        }

        const updated: any = clone(existing);
        if (typeof update.currentSequence?.increment === 'number') {
          updated.currentSequence =
            Number(updated.currentSequence) +
            Number(update.currentSequence.increment);
        } else if (update.currentSequence !== undefined) {
          updated.currentSequence = Number(update.currentSequence);
        }
        updated.updatedAt = now();
        store.orderSequencesByKey.set(key, clone(updated));
        return clone(updated);
      },
    },

    product: {
      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        return clone(store.productsById.get(id) ?? null);
      },
    },

    user: {
      findUnique: async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (!id) return null;
        return clone(store.usersById.get(id) ?? null);
      },
    },
  };

  const snapshotStore = () => ({
    productsById: new Map(
      Array.from(store.productsById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    usersById: new Map(
      Array.from(store.usersById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    inventoriesById: new Map(
      Array.from(store.inventoriesById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    inventoriesByKey: new Map(store.inventoriesByKey.entries()),
    inboundById: new Map(
      Array.from(store.inboundById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    inboundByRecordNumber: new Map(store.inboundByRecordNumber.entries()),
    fifoById: new Map(
      Array.from(store.fifoById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    outboundById: new Map(
      Array.from(store.outboundById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    adjustmentsById: new Map(
      Array.from(store.adjustmentsById.entries()).map(([k, v]) => [k, clone(v)])
    ),
    orderSequencesByKey: new Map(
      Array.from(store.orderSequencesByKey.entries()).map(([k, v]) => [
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
    restoreMap(store.usersById, snapshot.usersById);
    restoreMap(store.inventoriesById, snapshot.inventoriesById);

    store.inventoriesByKey.clear();
    for (const [k, v] of snapshot.inventoriesByKey.entries()) {
      store.inventoriesByKey.set(k, v);
    }

    restoreMap(store.inboundById, snapshot.inboundById);

    store.inboundByRecordNumber.clear();
    for (const [k, v] of snapshot.inboundByRecordNumber.entries()) {
      store.inboundByRecordNumber.set(k, v);
    }

    restoreMap(store.fifoById, snapshot.fifoById);
    restoreMap(store.outboundById, snapshot.outboundById);
    restoreMap(store.adjustmentsById, snapshot.adjustmentsById);
    restoreMap(store.orderSequencesByKey, snapshot.orderSequencesByKey);
  };

  const prisma: any = {
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

  return { prisma, tx, store };
}
