import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { buildDateTimeRangeFromDateStrings } from '@/lib/api/date-range';
import { prisma } from '@/lib/db';
import type { InboundDamageHandling } from '@/lib/types/inbound';
import {
  PURCHASE_DAMAGE_LEDGER_ALLOWED_TRANSITIONS,
  type PurchaseDamageLedger,
  type PurchaseDamageLedgerQueryParams,
  type PurchaseDamageLedgerStatus,
  type PurchaseDamageLedgerSummary,
} from '@/lib/types/purchase-damage-ledger';
import {
  getBatchPiecesPerUnitFromMap,
  loadBatchPiecesPerUnitMap,
} from '@/lib/utils/batch-pieces-per-unit';
import { toNumberOrNull } from '@/lib/utils/number';
import { cleanRemarks } from '@/lib/validations/inbound';

const PURCHASE_DAMAGE_LEDGER_INCLUDE = {
  inboundRecord: {
    select: {
      id: true,
      recordNumber: true,
      createdAt: true,
    },
  },
  purchaseOrder: {
    select: {
      id: true,
      orderNumber: true,
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
} satisfies Prisma.PurchaseInboundDamageLedgerInclude;

type PurchaseDamageLedgerRecord = Prisma.PurchaseInboundDamageLedgerGetPayload<{
  include: typeof PURCHASE_DAMAGE_LEDGER_INCLUDE;
}>;

function generatePurchaseDamageLedgerNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const millisecondStr = now.getMilliseconds().toString().padStart(3, '0');
  const randomSuffix = (randomBytes(2).readUInt16BE(0) % 10000)
    .toString()
    .padStart(4, '0');

  return `PIL${dateStr}${timeStr}${millisecondStr}${randomSuffix}`;
}

export function getInitialPurchaseDamageLedgerStatus(
  damageHandling: InboundDamageHandling
): PurchaseDamageLedgerStatus {
  return damageHandling === 'supplier_claim'
    ? 'pending_claim'
    : 'internal_closed';
}

function mapPurchaseDamageLedger(
  record: PurchaseDamageLedgerRecord,
  batchPiecesPerUnit?: number
): PurchaseDamageLedger {
  return {
    id: record.id,
    ledgerNumber: record.ledgerNumber,
    inboundRecordId: record.inboundRecordId,
    purchaseOrderId: record.purchaseOrderId ?? undefined,
    purchaseOrderItemId: record.purchaseOrderItemId ?? undefined,
    productId: record.productId,
    supplierId: record.supplierId ?? undefined,
    batchNumber: record.batchNumber ?? undefined,
    batchPiecesPerUnit,
    damagedQuantity: record.damagedQuantity,
    damageHandling: record.damageHandling as InboundDamageHandling,
    referenceAmount: toNumberOrNull(record.referenceAmount) ?? undefined,
    status: record.status as PurchaseDamageLedgerStatus,
    remarks: record.remarks ?? undefined,
    createdById: record.createdById,
    lastHandledById: record.lastHandledById ?? undefined,
    claimedAt: record.claimedAt?.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    inboundRecord: record.inboundRecord
      ? {
          id: record.inboundRecord.id,
          recordNumber: record.inboundRecord.recordNumber,
          createdAt: record.inboundRecord.createdAt.toISOString(),
        }
      : undefined,
    purchaseOrder: record.purchaseOrder
      ? {
          id: record.purchaseOrder.id,
          orderNumber: record.purchaseOrder.orderNumber,
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

function buildPurchaseDamageLedgerWhere(
  params: PurchaseDamageLedgerQueryParams
): Prisma.PurchaseInboundDamageLedgerWhereInput {
  const where: Prisma.PurchaseInboundDamageLedgerWhereInput = {};
  const search = params.search?.trim();

  if (search) {
    where.OR = [
      { ledgerNumber: { contains: search } },
      { batchNumber: { contains: search } },
      {
        inboundRecord: {
          is: {
            recordNumber: { contains: search },
          },
        },
      },
      {
        purchaseOrder: {
          is: {
            orderNumber: { contains: search },
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
    ];
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

function buildEmptySummary(): PurchaseDamageLedgerSummary {
  return {
    totalCount: 0,
    pendingCount: 0,
    claimSubmittedCount: 0,
    compensatedCount: 0,
    internalClosedCount: 0,
    totalDamagedQuantity: 0,
    totalReferenceAmount: 0,
  };
}

export async function backfillMissingPurchaseDamageLedgers(limit = 200) {
  const records = await prisma.inboundRecord.findMany({
    where: {
      reason: 'purchase',
      damagedQuantity: {
        gt: 0,
      },
      damageHandling: {
        not: null,
      },
      purchaseDamageLedger: {
        is: null,
      },
    },
    select: {
      id: true,
      purchaseOrderId: true,
      purchaseOrderItemId: true,
      productId: true,
      supplierId: true,
      batchNumber: true,
      damagedQuantity: true,
      damageHandling: true,
      damageTotalCost: true,
      damageRemarks: true,
      userId: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  });

  for (const record of records) {
    await upsertPurchaseDamageLedgerFromInbound(prisma, {
      inboundRecordId: record.id,
      purchaseOrderId: record.purchaseOrderId,
      purchaseOrderItemId: record.purchaseOrderItemId,
      productId: record.productId,
      supplierId: record.supplierId,
      batchNumber: record.batchNumber,
      damagedQuantity: record.damagedQuantity,
      damageHandling: record.damageHandling as InboundDamageHandling,
      referenceAmount: toNumberOrNull(record.damageTotalCost),
      remarks: record.damageRemarks,
      createdById: record.userId,
    });
  }

  return records.length;
}

export async function listPurchaseDamageLedgers(
  params: PurchaseDamageLedgerQueryParams
): Promise<{
  data: PurchaseDamageLedger[];
  summary: PurchaseDamageLedgerSummary;
}> {
  await backfillMissingPurchaseDamageLedgers();

  const where = buildPurchaseDamageLedgerWhere(params);
  const [records, aggregate, grouped] = await Promise.all([
    prisma.purchaseInboundDamageLedger.findMany({
      where,
      include: PURCHASE_DAMAGE_LEDGER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { ledgerNumber: 'desc' }],
      take: 200,
    }),
    prisma.purchaseInboundDamageLedger.aggregate({
      where,
      _count: {
        _all: true,
      },
      _sum: {
        damagedQuantity: true,
        referenceAmount: true,
      },
    }),
    prisma.purchaseInboundDamageLedger.groupBy({
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
  summary.totalReferenceAmount = toNumberOrNull(aggregate._sum.referenceAmount) ?? 0;

  for (const group of grouped) {
    const count = group._count._all;
    if (group.status === 'pending_claim') {
      summary.pendingCount = count;
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
      mapPurchaseDamageLedger(
        record,
        getBatchPiecesPerUnitFromMap(batchPiecesMap, record)
      )
    ),
    summary,
  };
}

type LedgerDbClient = Prisma.TransactionClient | typeof prisma;

export async function upsertPurchaseDamageLedgerFromInbound(
  db: LedgerDbClient,
  input: {
    inboundRecordId: string;
    purchaseOrderId?: string | null;
    purchaseOrderItemId?: string | null;
    productId: string;
    supplierId?: string | null;
    batchNumber?: string | null;
    damagedQuantity?: number | null;
    damageHandling?: InboundDamageHandling | null;
    referenceAmount?: number | null;
    remarks?: string | null;
    createdById: string;
  }
) {
  const damagedQuantity = Number(input.damagedQuantity ?? 0);
  if (
    !input.inboundRecordId ||
    damagedQuantity <= 0 ||
    !input.damageHandling
  ) {
    return null;
  }

  const remarks = cleanRemarks(input.remarks ?? undefined);
  const initialStatus = getInitialPurchaseDamageLedgerStatus(input.damageHandling);
  const existing = await db.purchaseInboundDamageLedger.findUnique({
    where: {
      inboundRecordId: input.inboundRecordId,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    const updated = await db.purchaseInboundDamageLedger.update({
      where: {
        inboundRecordId: input.inboundRecordId,
      },
      data: {
        purchaseOrderId: input.purchaseOrderId ?? null,
        purchaseOrderItemId: input.purchaseOrderItemId ?? null,
        productId: input.productId,
        supplierId: input.supplierId ?? null,
        batchNumber: input.batchNumber ?? null,
        damagedQuantity,
        damageHandling: input.damageHandling,
        referenceAmount: input.referenceAmount ?? null,
        remarks: remarks ?? null,
      },
      include: PURCHASE_DAMAGE_LEDGER_INCLUDE,
    });

    return mapPurchaseDamageLedger(updated);
  }

  const created = await db.purchaseInboundDamageLedger.create({
    data: {
      ledgerNumber: generatePurchaseDamageLedgerNumber(),
      inboundRecordId: input.inboundRecordId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      purchaseOrderItemId: input.purchaseOrderItemId ?? null,
      productId: input.productId,
      supplierId: input.supplierId ?? null,
      batchNumber: input.batchNumber ?? null,
      damagedQuantity,
      damageHandling: input.damageHandling,
      referenceAmount: input.referenceAmount ?? null,
      status: initialStatus,
      remarks: remarks ?? null,
      createdById: input.createdById,
      resolvedAt: initialStatus === 'internal_closed' ? new Date() : null,
    },
    include: PURCHASE_DAMAGE_LEDGER_INCLUDE,
  });

  return mapPurchaseDamageLedger(created);
}

export async function updatePurchaseDamageLedgerStatus(
  id: string,
  input: {
    status: PurchaseDamageLedgerStatus;
    remarks?: string;
  },
  userId: string
) {
  const existing = await prisma.purchaseInboundDamageLedger.findUnique({
    where: { id },
    include: PURCHASE_DAMAGE_LEDGER_INCLUDE,
  });

  if (!existing) {
    throw new Error('破损台账不存在');
  }

  const currentStatus = existing.status as PurchaseDamageLedgerStatus;
  if (
    currentStatus !== input.status &&
    !PURCHASE_DAMAGE_LEDGER_ALLOWED_TRANSITIONS[currentStatus]?.includes(
      input.status
    )
  ) {
    throw new Error('当前状态不允许这样流转，请刷新后重试');
  }

  const nextRemarks = cleanRemarks(input.remarks);
  const now = new Date();

  const updated = await prisma.purchaseInboundDamageLedger.update({
    where: { id },
    data: {
      status: input.status,
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
    include: PURCHASE_DAMAGE_LEDGER_INCLUDE,
  });

  return mapPurchaseDamageLedger(updated);
}
