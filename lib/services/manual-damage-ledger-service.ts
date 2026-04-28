import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { buildDateTimeRangeFromDateStrings } from '@/lib/api/date-range';
import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import {
  MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS,
  type ManualDamageCategory,
  type ManualDamageHandling,
  type ManualDamageLedger,
  type ManualDamageLedgerQueryParams,
  type ManualDamageLedgerStatus,
  type ManualDamageLedgerSummary,
} from '@/lib/types/manual-damage-ledger';
import {
  getBatchPiecesPerUnitFromMap,
  loadBatchPiecesPerUnitMap,
} from '@/lib/utils/batch-pieces-per-unit';
import { toNumberOrNull } from '@/lib/utils/number';
import { cleanRemarks } from '@/lib/validations/inbound';

const MANUAL_DAMAGE_LEDGER_INCLUDE = {
  adjustment: {
    select: {
      id: true,
      adjustmentNumber: true,
      createdAt: true,
      notes: true,
    },
  },
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      piecesPerUnit: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  lastHandledBy: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ManualDamageLedgerInclude;

type ManualDamageLedgerRecord = Prisma.ManualDamageLedgerGetPayload<{
  include: typeof MANUAL_DAMAGE_LEDGER_INCLUDE;
}>;

type LedgerDbClient = Prisma.TransactionClient | typeof prisma;

function createEmptyDamageBreakdown() {
  return {
    quantity: 0,
    amount: 0,
  };
}

function createEmptyManualDamageCategoryMetrics() {
  return {
    damage: createEmptyDamageBreakdown(),
    scrap: createEmptyDamageBreakdown(),
    loss: createEmptyDamageBreakdown(),
    other: createEmptyDamageBreakdown(),
  };
}

function createEmptyManualDamageHandlingMetrics() {
  return {
    pendingConfirm: createEmptyDamageBreakdown(),
    supplierClaim: createEmptyDamageBreakdown(),
    internalLoss: createEmptyDamageBreakdown(),
  };
}

function generateManualDamageLedgerNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const millisecondStr = now.getMilliseconds().toString().padStart(3, '0');
  const randomSuffix = (randomBytes(2).readUInt16BE(0) % 10000)
    .toString()
    .padStart(4, '0');

  return `MDL${dateStr}${timeStr}${millisecondStr}${randomSuffix}`;
}

export function getInitialManualDamageLedgerStatus(
  damageHandling: ManualDamageHandling
): ManualDamageLedgerStatus {
  if (damageHandling === 'supplier_claim') {
    return 'pending_claim';
  }
  if (damageHandling === 'internal_loss') {
    return 'internal_closed';
  }
  return 'pending_review';
}

function mapManualDamageLedger(
  record: ManualDamageLedgerRecord,
  batchPiecesPerUnit?: number
): ManualDamageLedger {
  return {
    id: record.id,
    ledgerNumber: record.ledgerNumber,
    adjustmentId: record.adjustmentId,
    productId: record.productId,
    variantId: record.variantId ?? undefined,
    supplierId: record.supplierId ?? undefined,
    batchNumber: record.batchNumber ?? undefined,
    batchPiecesPerUnit,
    damagedQuantity: record.damagedQuantity,
    damageCategory: record.damageCategory as ManualDamageCategory,
    damageHandling: record.damageHandling as ManualDamageHandling,
    referenceAmount: toNumberOrNull(record.referenceAmount) ?? undefined,
    status: record.status as ManualDamageLedgerStatus,
    remarks: record.remarks ?? undefined,
    createdById: record.createdById,
    lastHandledById: record.lastHandledById ?? undefined,
    claimedAt: record.claimedAt?.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    adjustment: record.adjustment
      ? {
          id: record.adjustment.id,
          adjustmentNumber: record.adjustment.adjustmentNumber,
          createdAt: record.adjustment.createdAt.toISOString(),
          notes: record.adjustment.notes ?? undefined,
        }
      : undefined,
    product: record.product
      ? {
          id: record.product.id,
          code: record.product.code,
          name: record.product.name,
          specification: record.product.specification ?? undefined,
          piecesPerUnit: record.product.piecesPerUnit ?? undefined,
        }
      : undefined,
    supplier: record.supplier
      ? {
          id: record.supplier.id,
          name: record.supplier.name,
        }
      : undefined,
    createdBy: record.createdBy
      ? {
          id: record.createdBy.id,
          name: record.createdBy.name,
        }
      : undefined,
    lastHandledBy: record.lastHandledBy
      ? {
          id: record.lastHandledBy.id,
          name: record.lastHandledBy.name,
        }
      : undefined,
  };
}

function buildManualDamageLedgerWhere(
  params: ManualDamageLedgerQueryParams
): Prisma.ManualDamageLedgerWhereInput {
  const where: Prisma.ManualDamageLedgerWhereInput = {};
  const search = params.search?.trim();

  if (search) {
    where.OR = [
      { ledgerNumber: { contains: search } },
      { batchNumber: { contains: search } },
      {
        adjustment: {
          is: {
            adjustmentNumber: { contains: search },
          },
        },
      },
      {
        product: {
          is: {
            code: { contains: search },
          },
        },
      },
      {
        product: {
          is: {
            name: { contains: search },
          },
        },
      },
      {
        supplier: {
          is: {
            name: { contains: search },
          },
        },
      },
      {
        remarks: { contains: search },
      },
    ];
  }

  if (params.damageCategory) {
    where.damageCategory = params.damageCategory;
  }

  if (params.damageHandling) {
    where.damageHandling = params.damageHandling;
  }

  if (params.status) {
    where.status = params.status;
  }

  const createdAt = buildDateTimeRangeFromDateStrings(
    params.startDate,
    params.endDate
  );
  if (createdAt) {
    where.createdAt = createdAt;
  }

  return where;
}

function buildEmptySummary(): ManualDamageLedgerSummary {
  return {
    totalCount: 0,
    pendingReviewCount: 0,
    pendingClaimCount: 0,
    claimSubmittedCount: 0,
    compensatedCount: 0,
    internalClosedCount: 0,
    totalDamagedQuantity: 0,
    totalReferenceAmount: 0,
  };
}

async function resolveSupplierIdForManualDamage(
  db: LedgerDbClient,
  input: {
    productId: string;
    variantId?: string | null;
    batchNumber?: string | null;
  }
) {
  const where: Prisma.InboundRecordWhereInput = {
    productId: input.productId,
    supplierId: { not: null },
    reason: 'purchase',
  };

  if (input.variantId) {
    where.variantId = input.variantId;
  }

  if (input.batchNumber) {
    where.batchNumber = input.batchNumber;
  }

  const record = await db.inboundRecord.findFirst({
    where,
    select: {
      supplierId: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  return record?.supplierId ?? null;
}

export async function backfillMissingManualDamageLedgers(limit = 200) {
  const inventoryAdjustmentModel = (
    prisma as typeof prisma & {
      inventoryAdjustment?: Partial<Pick<typeof prisma.inventoryAdjustment, 'findMany'>>;
    }
  ).inventoryAdjustment;

  if (!inventoryAdjustmentModel || typeof inventoryAdjustmentModel.findMany !== 'function') {
    return 0;
  }

  const adjustments = await inventoryAdjustmentModel.findMany({
    where: {
      reason: 'damage_loss',
      status: 'approved',
      adjustQuantity: {
        lt: 0,
      },
      manualDamageLedger: {
        is: null,
      },
    },
    select: {
      id: true,
      productId: true,
      variantId: true,
      batchNumber: true,
      adjustQuantity: true,
      totalCost: true,
      notes: true,
      operatorId: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });

  for (const adjustment of adjustments) {
    await upsertManualDamageLedgerFromAdjustment(prisma, {
      adjustmentId: adjustment.id,
      productId: adjustment.productId,
      variantId: adjustment.variantId,
      batchNumber: adjustment.batchNumber,
      damagedQuantity: Math.abs(adjustment.adjustQuantity),
      damageCategory: 'damage',
      damageHandling: 'pending_confirm',
      referenceAmount: Math.abs(toNumberOrNull(adjustment.totalCost) ?? 0),
      remarks: adjustment.notes,
      createdById: adjustment.operatorId,
    });
  }

  return adjustments.length;
}

export async function listManualDamageLedgers(
  params: ManualDamageLedgerQueryParams
): Promise<{
  data: ManualDamageLedger[];
  summary: ManualDamageLedgerSummary;
}> {
  await backfillMissingManualDamageLedgers();

  const where = buildManualDamageLedgerWhere(params);
  const [records, aggregate, grouped] = await Promise.all([
    prisma.manualDamageLedger.findMany({
      where,
      include: MANUAL_DAMAGE_LEDGER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { ledgerNumber: 'desc' }],
      take: 200,
    }),
    prisma.manualDamageLedger.aggregate({
      where,
      _count: {
        _all: true,
      },
      _sum: {
        damagedQuantity: true,
        referenceAmount: true,
      },
    }),
    prisma.manualDamageLedger.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  const batchPiecesMap = await loadBatchPiecesPerUnitMap(
    records.map(record => ({
      productId: record.productId,
      batchNumber: record.batchNumber,
    }))
  );

  const summary = buildEmptySummary();
  summary.totalCount = aggregate._count._all;
  summary.totalDamagedQuantity = Number(aggregate._sum.damagedQuantity ?? 0);
  summary.totalReferenceAmount =
    roundToTwoDecimals(toNumberOrNull(aggregate._sum.referenceAmount) ?? 0);

  for (const group of grouped) {
    const count = group._count._all;
    if (group.status === 'pending_review') {
      summary.pendingReviewCount = count;
    }
    if (group.status === 'pending_claim') {
      summary.pendingClaimCount = count;
    }
    if (group.status === 'claim_submitted') {
      summary.claimSubmittedCount = count;
    }
    if (group.status === 'compensated') {
      summary.compensatedCount = count;
    }
    if (group.status === 'internal_closed') {
      summary.internalClosedCount = count;
    }
  }

  return {
    data: records.map(record =>
      mapManualDamageLedger(
        record,
        getBatchPiecesPerUnitFromMap(batchPiecesMap, record)
      )
    ),
    summary,
  };
}

export async function getManualDamageMetricsForPeriod(
  startDate: Date,
  endDate: Date
) {
  const manualDamageLedgerModel = (
    prisma as typeof prisma & {
      manualDamageLedger?: Partial<
        Pick<typeof prisma.manualDamageLedger, 'aggregate' | 'groupBy'>
      >;
    }
  ).manualDamageLedger;

  await backfillMissingManualDamageLedgers();

  if (
    !manualDamageLedgerModel ||
    typeof manualDamageLedgerModel.aggregate !== 'function' ||
    typeof manualDamageLedgerModel.groupBy !== 'function'
  ) {
    return {
      quantity: 0,
      amount: 0,
      byCategory: createEmptyManualDamageCategoryMetrics(),
      byHandling: createEmptyManualDamageHandlingMetrics(),
    };
  }

  const where = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  const [summary, groupedByCategory, groupedByHandling] = await Promise.all([
    manualDamageLedgerModel.aggregate({
      where,
      _sum: {
        damagedQuantity: true,
        referenceAmount: true,
      },
    }),
    manualDamageLedgerModel.groupBy({
      by: ['damageCategory'],
      where,
      _sum: {
        damagedQuantity: true,
        referenceAmount: true,
      },
    }),
    manualDamageLedgerModel.groupBy({
      by: ['damageHandling'],
      where,
      _sum: {
        damagedQuantity: true,
        referenceAmount: true,
      },
    }),
  ]);

  const byCategory = createEmptyManualDamageCategoryMetrics();
  for (const group of groupedByCategory) {
    const breakdown = {
      quantity: Number(group._sum.damagedQuantity ?? 0),
      amount: roundToTwoDecimals(
        toNumberOrNull(group._sum.referenceAmount) ?? 0
      ),
    };

    if (group.damageCategory === 'damage') {
      byCategory.damage = breakdown;
    }
    if (group.damageCategory === 'scrap') {
      byCategory.scrap = breakdown;
    }
    if (group.damageCategory === 'loss') {
      byCategory.loss = breakdown;
    }
    if (group.damageCategory === 'other') {
      byCategory.other = breakdown;
    }
  }

  const byHandling = createEmptyManualDamageHandlingMetrics();
  for (const group of groupedByHandling) {
    const breakdown = {
      quantity: Number(group._sum.damagedQuantity ?? 0),
      amount: roundToTwoDecimals(
        toNumberOrNull(group._sum.referenceAmount) ?? 0
      ),
    };

    if (group.damageHandling === 'pending_confirm') {
      byHandling.pendingConfirm = breakdown;
    }
    if (group.damageHandling === 'supplier_claim') {
      byHandling.supplierClaim = breakdown;
    }
    if (group.damageHandling === 'internal_loss') {
      byHandling.internalLoss = breakdown;
    }
  }

  return {
    quantity: Number(summary._sum.damagedQuantity ?? 0),
    amount: roundToTwoDecimals(toNumberOrNull(summary._sum.referenceAmount) ?? 0),
    byCategory,
    byHandling,
  };
}

export async function upsertManualDamageLedgerFromAdjustment(
  db: LedgerDbClient,
  input: {
    adjustmentId: string;
    productId: string;
    variantId?: string | null;
    batchNumber?: string | null;
    damagedQuantity?: number | null;
    damageCategory?: ManualDamageCategory | null;
    damageHandling?: ManualDamageHandling | null;
    referenceAmount?: number | null;
    remarks?: string | null;
    createdById: string;
    supplierId?: string | null;
    status?: ManualDamageLedgerStatus;
  }
) {
  const damagedQuantity = Math.abs(Number(input.damagedQuantity ?? 0));
  if (!input.adjustmentId || damagedQuantity <= 0) {
    return null;
  }

  const remarks = cleanRemarks(input.remarks ?? undefined);
  const damageCategory = input.damageCategory ?? 'damage';
  const damageHandling = input.damageHandling ?? 'pending_confirm';
  const nextStatus =
    input.status ?? getInitialManualDamageLedgerStatus(damageHandling);
  const supplierId =
    input.supplierId ??
    (await resolveSupplierIdForManualDamage(db, {
      productId: input.productId,
      variantId: input.variantId,
      batchNumber: input.batchNumber,
    }));

  const existing = await db.manualDamageLedger.findUnique({
    where: {
      adjustmentId: input.adjustmentId,
    },
    include: MANUAL_DAMAGE_LEDGER_INCLUDE,
  });

  if (existing) {
    const updated = await db.manualDamageLedger.update({
      where: {
        adjustmentId: input.adjustmentId,
      },
      data: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        supplierId,
        batchNumber: input.batchNumber ?? null,
        damagedQuantity,
        damageCategory,
        damageHandling,
        referenceAmount: input.referenceAmount ?? null,
        remarks: remarks ?? existing.remarks,
      },
      include: MANUAL_DAMAGE_LEDGER_INCLUDE,
    });

    return mapManualDamageLedger(updated);
  }

  const created = await db.manualDamageLedger.create({
    data: {
      ledgerNumber: generateManualDamageLedgerNumber(),
      adjustmentId: input.adjustmentId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      supplierId,
      batchNumber: input.batchNumber ?? null,
      damagedQuantity,
      damageCategory,
      damageHandling,
      referenceAmount: input.referenceAmount ?? null,
      status: nextStatus,
      remarks: remarks ?? null,
      createdById: input.createdById,
      claimedAt: nextStatus === 'claim_submitted' ? new Date() : null,
      resolvedAt:
        nextStatus === 'compensated' || nextStatus === 'internal_closed'
          ? new Date()
          : null,
    },
    include: MANUAL_DAMAGE_LEDGER_INCLUDE,
  });

  return mapManualDamageLedger(created);
}

export async function updateManualDamageLedger(
  id: string,
  input: {
    status: ManualDamageLedgerStatus;
    damageCategory: ManualDamageCategory;
    damageHandling: ManualDamageHandling;
    remarks?: string;
  },
  userId: string
) {
  const existing = await prisma.manualDamageLedger.findUnique({
    where: { id },
    include: MANUAL_DAMAGE_LEDGER_INCLUDE,
  });

  if (!existing) {
    throw new Error('手工报损台账不存在');
  }

  const currentStatus = existing.status as ManualDamageLedgerStatus;
  if (
    currentStatus !== input.status &&
    !MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS[currentStatus]?.includes(
      input.status
    )
  ) {
    throw new Error('当前状态不允许这样流转，请刷新后重试');
  }

  if (
    input.damageHandling === 'pending_confirm' &&
    input.status !== 'pending_review'
  ) {
    throw new Error('处理方式还未确认时，只能先保存为待补充处理');
  }

  const nextRemarks = cleanRemarks(input.remarks);
  const now = new Date();

  const updated = await prisma.manualDamageLedger.update({
    where: { id },
    data: {
      status: input.status,
      damageCategory: input.damageCategory,
      damageHandling: input.damageHandling,
      remarks: nextRemarks ?? null,
      lastHandledById: userId,
      claimedAt:
        input.status === 'claim_submitted' && !existing.claimedAt
          ? now
          : existing.claimedAt,
      resolvedAt:
        (input.status === 'compensated' || input.status === 'internal_closed') &&
        !existing.resolvedAt
          ? now
          : existing.resolvedAt,
    },
    include: MANUAL_DAMAGE_LEDGER_INCLUDE,
  });

  return mapManualDamageLedger(updated);
}
