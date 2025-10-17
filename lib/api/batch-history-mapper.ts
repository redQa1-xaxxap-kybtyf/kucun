import type {
  BatchMovementGroup,
  InventoryMovementEntry,
} from '@/lib/types/inventory';

type InboundRecordSource = {
  id: string;
  recordNumber: string | null;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number | null | undefined;
  createdAt: Date;
  remarks?: string | null;
  reason: string | null;
  product: MovementProductSource;
  variant: MovementVariantSource | null;
  user: MovementUserSource | null;
};

type OutboundRecordSource = {
  id: string;
  recordNumber: string | null;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number | null | undefined;
  createdAt: Date;
  notes?: string | null;
  reason?: string | null;
  product: MovementProductSource;
  variant: MovementVariantSource | null;
  operator: MovementUserSource;
  customer: MovementCustomerSource | null;
  salesOrder: MovementSalesOrderSource | null;
};

type AdjustmentRecordSource = {
  id: string;
  adjustmentNumber: string | null;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  adjustQuantity: number;
  beforeQuantity: number | null | undefined;
  afterQuantity: number | null | undefined;
  createdAt: Date;
  notes?: string | null;
  reason?: string | null;
  product: MovementProductSource;
  variant: MovementVariantSource | null;
  operator: MovementUserSource;
  approver: MovementUserSource | null;
};

export type MovementSource =
  | { kind: 'inbound'; data: InboundRecordSource }
  | { kind: 'outbound'; data: OutboundRecordSource }
  | { kind: 'adjustment'; data: AdjustmentRecordSource };

type MovementProductSource = {
  id: string;
  code: string;
  name: string;
  unit: string;
  specification: string | null;
  piecesPerUnit: number;
};

type MovementVariantSource = {
  id: string;
  colorCode: string;
  colorName: string | null;
};

type MovementUserSource = {
  id: string;
  name: string | null;
};

type MovementCustomerSource = {
  id: string;
  name: string;
};

type MovementSalesOrderSource = {
  id: string;
  orderNumber: string;
};

type MovementProduct = NonNullable<InventoryMovementEntry['product']>;

export function toMovementProduct(
  product:
    | (MovementProductSource & { piecesPerUnit?: number | null })
    | null
    | undefined
): MovementProduct | undefined {
  if (!product) {
    return undefined;
  }

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    unit: product.unit as MovementProduct['unit'],
    specification: product.specification ?? undefined,
    piecesPerUnit: product.piecesPerUnit ?? 0,
  };
}

export function buildGroupKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId ?? 'default'}`;
}

type TimelineBounds = {
  firstEventAt?: string;
  lastEventAt?: string;
};

export function mapSourcesToEntries(
  sources: MovementSource[],
  currentInventoryMap: Map<string, number>
) {
  const groups = new Map<string, BatchMovementGroup>();
  const bounds: TimelineBounds = {};

  for (const source of sources) {
    processSource(source, groups, bounds);
  }

  const finalizedGroups = finalizeGroups(groups, currentInventoryMap);

  return {
    groups: finalizedGroups,
    firstEventAt: bounds.firstEventAt,
    lastEventAt: bounds.lastEventAt,
  };
}

function processSource(
  source: MovementSource,
  groups: Map<string, BatchMovementGroup>,
  bounds: TimelineBounds
) {
  const { kind, data } = source;
  const productInfo = toMovementProduct(data.product);
  if (!productInfo) {
    return;
  }

  const variantInfo = data.variant
    ? {
        id: data.variant.id,
        colorCode: data.variant.colorCode,
        colorName: data.variant.colorName,
      }
    : undefined;

  const groupKey = buildGroupKey(data.productId, data.variantId);
  const group = ensureGroup(groups, groupKey, productInfo, variantInfo);

  const entry = buildMovementEntry(kind, data, productInfo, variantInfo);
  group.movements.push(entry);
  updateGroupTotals(group, entry);
  updateTimelineBounds(bounds, entry.createdAt);
}

function ensureGroup(
  groups: Map<string, BatchMovementGroup>,
  key: string,
  product: InventoryMovementEntry['product'],
  variant: InventoryMovementEntry['variant']
) {
  const existing = groups.get(key);
  if (existing) {
    return existing;
  }

  const group: BatchMovementGroup = {
    key,
    product,
    variant,
    currentQuantity: 0,
    totalInbound: 0,
    totalOutbound: 0,
    totalAdjustment: 0,
    movements: [],
  };

  groups.set(key, group);
  return group;
}

function buildMovementEntry(
  kind: MovementSource['kind'],
  source: MovementSource['data'],
  productInfo: InventoryMovementEntry['product'],
  variantInfo: InventoryMovementEntry['variant']
): InventoryMovementEntry {
  if (kind === 'inbound') {
    const data = source as InboundRecordSource;
    return {
      id: data.id,
      recordNumber: data.recordNumber ?? data.id,
      type: kind,
      productId: data.productId,
      variantId: data.variantId ?? undefined,
      batchNumber: data.batchNumber ?? undefined,
      quantityChange: Number(data.quantity ?? 0),
      createdAt: data.createdAt.toISOString(),
      remarks: data.remarks ?? undefined,
      reason: data.reason ?? undefined,
      operator: data.user
        ? { id: data.user.id, name: data.user.name ?? '—' }
        : undefined,
      product: productInfo,
      variant: variantInfo,
    };
  }

  if (kind === 'outbound') {
    const data = source as OutboundRecordSource;
    const quantity = -Math.abs(Number(data.quantity ?? 0));
    return {
      id: data.id,
      recordNumber: data.recordNumber ?? data.id,
      type: kind,
      productId: data.productId,
      variantId: data.variantId ?? undefined,
      batchNumber: data.batchNumber ?? undefined,
      quantityChange: quantity,
      createdAt: data.createdAt.toISOString(),
      remarks: data.notes ?? undefined,
      reason: data.reason ?? undefined,
      operator: { id: data.operator.id, name: data.operator.name ?? '—' },
      product: productInfo,
      variant: variantInfo,
      referenceNumber: data.salesOrder?.orderNumber,
    };
  }

  const data = source as AdjustmentRecordSource;
  return {
    id: data.id,
    recordNumber: data.adjustmentNumber ?? data.id,
    type: kind,
    productId: data.productId,
    variantId: data.variantId ?? undefined,
    batchNumber: data.batchNumber ?? undefined,
    quantityChange: data.adjustQuantity,
    createdAt: data.createdAt.toISOString(),
    remarks: data.notes ?? undefined,
    reason: data.reason ?? undefined,
    operator: { id: data.operator.id, name: data.operator.name ?? '—' },
    product: productInfo,
    variant: variantInfo,
    beforeQuantitySnapshot: data.beforeQuantity ?? undefined,
    afterQuantitySnapshot: data.afterQuantity ?? undefined,
  };
}

function updateGroupTotals(
  group: BatchMovementGroup,
  entry: InventoryMovementEntry
) {
  if (entry.type === 'inbound' && entry.quantityChange > 0) {
    group.totalInbound += entry.quantityChange;
  } else if (entry.type === 'outbound' && entry.quantityChange < 0) {
    group.totalOutbound += Math.abs(entry.quantityChange);
  } else if (entry.type === 'adjustment') {
    group.totalAdjustment += entry.quantityChange;
  }
}

function updateTimelineBounds(bounds: TimelineBounds, createdAt: string) {
  if (!bounds.firstEventAt || createdAt < bounds.firstEventAt) {
    bounds.firstEventAt = createdAt;
  }
  if (!bounds.lastEventAt || createdAt > bounds.lastEventAt) {
    bounds.lastEventAt = createdAt;
  }
}

function finalizeGroups(
  groups: Map<string, BatchMovementGroup>,
  currentInventoryMap: Map<string, number>
) {
  const finalized: BatchMovementGroup[] = [];

  groups.forEach(group => {
    const currentQuantity =
      currentInventoryMap.get(group.key) ?? group.currentQuantity ?? 0;
    group.currentQuantity = currentQuantity;

    const sorted = [...group.movements].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let runningBalance =
      currentQuantity !== 0 || currentInventoryMap.has(group.key)
        ? currentQuantity
        : undefined;

    sorted.forEach(entry => {
      runningBalance = deriveRunningBalance(entry, runningBalance);
    });

    const latestEntry = sorted[0];
    const earliestEntry = sorted[sorted.length - 1];

    group.movements = sorted.reverse();

    const openingBalance =
      earliestEntry?.balanceBefore ??
      earliestEntry?.balanceAfter ??
      currentQuantity;

    const closingBalance =
      latestEntry?.balanceAfter !== undefined
        ? latestEntry.balanceAfter
        : currentQuantity;

    group.openingBalance = openingBalance;
    group.closingBalance = closingBalance;
    group.netChange =
      openingBalance !== undefined && closingBalance !== undefined
        ? closingBalance - openingBalance
        : undefined;

    finalized.push(group);
  });

  return finalized;
}

function deriveRunningBalance(
  entry: InventoryMovementEntry,
  currentBalance: number | undefined
) {
  let balance = currentBalance;

  if (
    entry.type === 'adjustment' &&
    entry.afterQuantitySnapshot !== undefined
  ) {
    balance = entry.afterQuantitySnapshot;
  } else if (balance === undefined) {
    if (entry.quantityChange !== 0) {
      balance =
        entry.type === 'outbound'
          ? Math.abs(entry.quantityChange)
          : entry.quantityChange;
    } else {
      balance = 0;
    }
  }

  const balanceAfter =
    entry.type === 'adjustment' && entry.afterQuantitySnapshot !== undefined
      ? entry.afterQuantitySnapshot
      : (balance ?? 0);

  const balanceBefore =
    entry.type === 'adjustment' && entry.beforeQuantitySnapshot !== undefined
      ? entry.beforeQuantitySnapshot
      : balanceAfter - entry.quantityChange;

  entry.balanceAfter = balanceAfter;
  entry.balanceBefore = balanceBefore;

  return balanceBefore;
}
