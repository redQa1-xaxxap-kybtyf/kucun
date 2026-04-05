import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { roundCostPrice } from '@/lib/utils/cost-price';
import { toNumber } from '@/lib/utils/number';
import { formatQuantity } from '@/lib/validations/inbound';

const OPENING_BALANCE_BATCH_RECORD_SELECT = {
  id: true,
  recordNumber: true,
  productId: true,
  variantId: true,
  batchNumber: true,
  openingImportBatchId: true,
  quantity: true,
  unitCost: true,
  totalCost: true,
  location: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
  supplierId: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
  },
  variant: {
    select: {
      id: true,
      colorCode: true,
      colorName: true,
      sku: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  batchSpecification: {
    select: {
      id: true,
      batchNumber: true,
      piecesPerUnit: true,
      weight: true,
      thickness: true,
    },
  },
} as const satisfies Prisma.InboundRecordSelect;

type OpeningBalanceBatchRecordRow = Prisma.InboundRecordGetPayload<{
  select: typeof OPENING_BALANCE_BATCH_RECORD_SELECT;
}>;

type InventoryState = {
  id: string;
  quantity: number;
  reservedQuantity: number;
};

type CostQueueState = {
  id: string;
  remainingQty: number;
};

export interface OpeningBalanceImportBatchRecordSummary {
  id: string;
  recordNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  specification?: string;
  variantId?: string;
  colorCode?: string;
  colorName?: string;
  batchNumber?: string;
  openingImportBatchId: string;
  quantity: number;
  piecesPerUnit: number;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  supplierName?: string;
  createdAt: string;
  updatedAt: string;
  canCorrect: boolean;
  canDelete: boolean;
  correctionMode: 'full' | 'decrease_only' | 'blocked';
  consumedQty: number;
  inventoryQuantity?: number;
  inventoryAvailableQty?: number;
  blockedReason?: string;
  warningMessage?: string;
}

export interface OpeningBalanceImportBatchDetail {
  batchId: string;
  totalCount: number;
  canDeleteAll: boolean;
  canCorrectAny: boolean;
  blockedCount: number;
  importStartedAt: string;
  importEndedAt: string;
  records: OpeningBalanceImportBatchRecordSummary[];
}

export interface OpeningBalanceImportBatchCorrectionInput {
  id: string;
  quantity: number;
  unitCost?: number;
}

export interface OpeningBalanceImportBatchCorrectionResult {
  batchId: string;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  productIds: string[];
  results: Array<{
    id: string;
    recordNumber?: string;
    status: 'updated' | 'skipped' | 'failed';
    message: string;
  }>;
}

export interface OpeningBalanceImportBatchDeleteResult {
  batchId: string;
  deletedCount: number;
  productIds: string[];
  deletedRecordNumbers: string[];
}

function buildInventoryKey(
  productId: string,
  variantId: string | null | undefined,
  batchNumber: string | null | undefined
) {
  return `${productId}::${variantId ?? 'null'}::${batchNumber ?? 'null'}`;
}

function normalizeTimestamp(date: Date) {
  return date.toISOString();
}

function evaluateRecordState(
  record: OpeningBalanceBatchRecordRow,
  inventories: InventoryState[],
  costEntries: CostQueueState[]
): OpeningBalanceImportBatchRecordSummary {
  const inventory = inventories[0];
  const piecesPerUnit =
    record.batchSpecification?.piecesPerUnit ?? record.product.piecesPerUnit ?? 0;

  const baseSummary: OpeningBalanceImportBatchRecordSummary = {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    specification: record.product.specification ?? undefined,
    variantId: record.variantId ?? undefined,
    colorCode: record.variant?.colorCode ?? undefined,
    colorName: record.variant?.colorName ?? undefined,
    batchNumber: record.batchNumber ?? undefined,
    openingImportBatchId: record.openingImportBatchId ?? '',
    quantity: record.quantity,
    piecesPerUnit,
    unitCost:
      record.unitCost !== null && record.unitCost !== undefined
        ? toNumber(record.unitCost, Number.NaN)
        : undefined,
    totalCost:
      record.totalCost !== null && record.totalCost !== undefined
        ? toNumber(record.totalCost, Number.NaN)
        : undefined,
    location: record.location ?? undefined,
    supplierName: record.supplier?.name ?? undefined,
    createdAt: normalizeTimestamp(record.createdAt),
    updatedAt: normalizeTimestamp(record.updatedAt),
    canCorrect: false,
    canDelete: false,
    correctionMode: 'blocked',
    consumedQty: 0,
    inventoryQuantity: inventory?.quantity,
    inventoryAvailableQty: inventory
      ? inventory.quantity - inventory.reservedQuantity
      : undefined,
  };

  if (!record.openingImportBatchId) {
    return {
      ...baseSummary,
      blockedReason: '这条期初记录没有导入批次号，无法按批次处理',
    };
  }

  if (!Number.isInteger(record.quantity)) {
    return {
      ...baseSummary,
      blockedReason: '数量包含小数，无法按导入批次自动更正或删除',
    };
  }

  if (inventories.length === 0) {
    return {
      ...baseSummary,
      blockedReason: '未找到对应库存记录，无法按导入批次处理',
    };
  }

  if (inventories.length > 1) {
    return {
      ...baseSummary,
      blockedReason: '发现重复库存记录，请先清理库存数据后再处理',
    };
  }

  if (costEntries.length > 1) {
    return {
      ...baseSummary,
      blockedReason: '该记录存在多条 FIFO 队列，无法按导入批次自动处理',
    };
  }

  const costEntry = costEntries[0] ?? null;
  const consumedQty = costEntry ? record.quantity - costEntry.remainingQty : 0;

  if (consumedQty < 0) {
    return {
      ...baseSummary,
      blockedReason: 'FIFO 队列数据异常，remainingQty 大于原入库数量',
    };
  }

  const availableQty = inventory.quantity - inventory.reservedQuantity;

  if (consumedQty > 0) {
    return {
      ...baseSummary,
      consumedQty,
      blockedReason: `已被后续业务消耗 ${consumedQty} 片，说明这批期初数据已经进入业务流程，不能再按导入批次批量回滚`,
    };
  }

  if (availableQty < record.quantity) {
    return {
      ...baseSummary,
      consumedQty,
      blockedReason: `当前可用库存只有 ${availableQty} 片，低于原始期初数量 ${record.quantity} 片，不能整批删除`,
      canCorrect: true,
      correctionMode: costEntry ? 'full' : 'decrease_only',
      warningMessage: costEntry
        ? undefined
        : '这条记录缺少 FIFO 队列，只支持改小，不支持补大。',
    };
  }

  return {
    ...baseSummary,
    consumedQty,
    canCorrect: true,
    canDelete: true,
    correctionMode: costEntry ? 'full' : 'decrease_only',
    warningMessage: costEntry
      ? undefined
      : '这条记录缺少 FIFO 队列，只支持改小，不支持补大。',
  };
}

async function loadBatchRecords(batchId: string) {
  const records = await prisma.inboundRecord.findMany({
    where: {
      reason: 'opening_balance',
      openingImportBatchId: batchId,
    },
    orderBy: [{ createdAt: 'asc' }, { recordNumber: 'asc' }],
    select: OPENING_BALANCE_BATCH_RECORD_SELECT,
  });

  if (records.length === 0) {
    throw ApiError.notFound('期初导入批次');
  }

  return records;
}

async function buildBatchDetailFromRecords(
  batchId: string,
  records: OpeningBalanceBatchRecordRow[]
): Promise<OpeningBalanceImportBatchDetail> {
  const recordIds = records.map(record => record.id);
  const inventoryCandidates = await prisma.inventory.findMany({
    where: {
      productId: {
        in: Array.from(new Set(records.map(record => record.productId))),
      },
      batchNumber: {
        in: Array.from(
          new Set(records.map(record => record.batchNumber).filter(Boolean))
        ) as string[],
      },
    },
    select: {
      id: true,
      productId: true,
      variantId: true,
      batchNumber: true,
      quantity: true,
      reservedQuantity: true,
    },
  });

  const costEntries = await prisma.inventoryCostQueue.findMany({
    where: {
      inboundRecordId: {
        in: recordIds,
      },
    },
    select: {
      id: true,
      inboundRecordId: true,
      remainingQty: true,
    },
  });

  const inventoryMap = new Map<string, InventoryState[]>();
  inventoryCandidates.forEach(inventory => {
    const key = buildInventoryKey(
      inventory.productId,
      inventory.variantId,
      inventory.batchNumber
    );
    const list = inventoryMap.get(key) ?? [];
    list.push({
      id: inventory.id,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
    });
    inventoryMap.set(key, list);
  });

  const costEntryMap = new Map<string, CostQueueState[]>();
  costEntries.forEach(entry => {
    const list = costEntryMap.get(entry.inboundRecordId) ?? [];
    list.push({
      id: entry.id,
      remainingQty: entry.remainingQty,
    });
    costEntryMap.set(entry.inboundRecordId, list);
  });

  const summaries = records.map(record =>
    evaluateRecordState(
      record,
      inventoryMap.get(
        buildInventoryKey(record.productId, record.variantId, record.batchNumber)
      ) ?? [],
      costEntryMap.get(record.id) ?? []
    )
  );

  return {
    batchId,
    totalCount: summaries.length,
    canDeleteAll: summaries.every(record => record.canDelete),
    canCorrectAny: summaries.some(record => record.canCorrect),
    blockedCount: summaries.filter(
      record => !record.canCorrect || !record.canDelete
    ).length,
    importStartedAt: summaries[0]?.createdAt ?? new Date(0).toISOString(),
    importEndedAt:
      summaries[summaries.length - 1]?.createdAt ?? new Date(0).toISOString(),
    records: summaries,
  };
}

async function getMutableRecordState(
  tx: Prisma.TransactionClient,
  recordId: string,
  batchId: string
) {
  const record = await tx.inboundRecord.findFirst({
    where: {
      id: recordId,
      reason: 'opening_balance',
      openingImportBatchId: batchId,
    },
    select: {
      id: true,
      recordNumber: true,
      quantity: true,
      unitCost: true,
      totalCost: true,
      productId: true,
      variantId: true,
      batchNumber: true,
      openingImportBatchId: true,
    },
  });

  if (!record) {
    throw ApiError.badRequest('记录不存在，或不属于当前导入批次');
  }

  if (!Number.isInteger(record.quantity)) {
    throw ApiError.badRequest(
      '该入库记录数量包含小数，无法按导入批次自动回滚/更正'
    );
  }

  const inventories = await tx.inventory.findMany({
    where: {
      productId: record.productId,
      variantId: record.variantId,
      batchNumber: record.batchNumber,
    },
    select: { id: true, quantity: true, reservedQuantity: true },
    take: 2,
  });

  if (inventories.length === 0) {
    throw ApiError.badRequest('未找到该入库记录对应的库存记录，无法处理');
  }

  if (inventories.length > 1) {
    throw ApiError.badRequest(
      '发现重复库存记录，无法自动处理，请先合并/清理重复数据'
    );
  }

  const costEntries = await tx.inventoryCostQueue.findMany({
    where: { inboundRecordId: record.id },
    select: { id: true, remainingQty: true },
    take: 2,
  });

  if (costEntries.length > 1) {
    throw ApiError.badRequest(
      '该入库记录对应多条 FIFO 队列记录，无法自动处理，请联系管理员'
    );
  }

  const costEntry = costEntries[0] ?? null;
  const consumedQty = costEntry ? record.quantity - costEntry.remainingQty : 0;

  if (consumedQty < 0) {
    throw ApiError.badRequest('FIFO 队列数据异常：remainingQty 大于入库数量');
  }

  if (consumedQty > 0) {
    throw ApiError.badRequest(
      `该记录已被后续业务消耗 ${consumedQty} 片，不能再按导入批次批量处理`
    );
  }

  return {
    record,
    inventory: inventories[0],
    costEntry,
  };
}

async function applyCorrectionInTransaction(
  tx: Prisma.TransactionClient,
  batchId: string,
  input: OpeningBalanceImportBatchCorrectionInput
) {
  const newQuantity = formatQuantity(input.quantity);
  if (!Number.isInteger(newQuantity) || newQuantity <= 0) {
    throw ApiError.badRequest('更正数量必须是大于 0 的整数片数');
  }

  const state = await getMutableRecordState(tx, input.id, batchId);
  const currentUnitCost = toNumber(state.record.unitCost, Number.NaN);
  const nextUnitCost =
    typeof input.unitCost === 'number'
      ? roundCostPrice(input.unitCost)
      : currentUnitCost;
  const quantityChanged = newQuantity !== state.record.quantity;
  const unitCostChanged =
    typeof input.unitCost === 'number' &&
    (!Number.isFinite(currentUnitCost) ||
      Math.abs(nextUnitCost - currentUnitCost) > 0.000001);

  if (!quantityChanged && !unitCostChanged) {
    return {
      recordNumber: state.record.recordNumber,
      productId: state.record.productId,
      status: 'skipped' as const,
      message: '数量和单位成本都未变化，已跳过',
    };
  }

  const quantityDiff = newQuantity - state.record.quantity;

  if (!state.costEntry && quantityDiff > 0) {
    throw ApiError.badRequest(
      '该记录缺少 FIFO 队列，只支持改小，不支持按导入批次补大数量'
    );
  }

  if (quantityChanged) {
    if (quantityDiff > 0) {
      await tx.inventory.update({
        where: { id: state.inventory.id },
        data: {
          quantity: { increment: quantityDiff },
          updatedAt: new Date(),
        },
      });

      if (state.costEntry) {
        await tx.inventoryCostQueue.update({
          where: { id: state.costEntry.id },
          data: {
            remainingQty: { increment: quantityDiff },
          },
        });
      }
    } else {
      const decrementQty = Math.abs(quantityDiff);
      const availableQty =
        state.inventory.quantity - state.inventory.reservedQuantity;

      if (availableQty < decrementQty) {
        throw ApiError.badRequest(
          `扣减后可用库存不足：当前可用 ${availableQty} 片，需要扣减 ${decrementQty} 片`
        );
      }

      await tx.inventory.update({
        where: { id: state.inventory.id },
        data: {
          quantity: { decrement: decrementQty },
          updatedAt: new Date(),
        },
      });

      if (state.costEntry) {
        await tx.inventoryCostQueue.update({
          where: { id: state.costEntry.id },
          data: {
            remainingQty: { decrement: decrementQty },
          },
        });
      }
    }
  }

  if (unitCostChanged) {
    await tx.inventory.update({
      where: { id: state.inventory.id },
      data: {
        unitCost: nextUnitCost,
        updatedAt: new Date(),
      },
    });

    if (state.costEntry) {
      await tx.inventoryCostQueue.update({
        where: { id: state.costEntry.id },
        data: {
          unitCost: nextUnitCost,
        },
      });
    }
  }

  await tx.inboundRecord.update({
    where: { id: state.record.id },
    data: {
      quantity: newQuantity,
      ...(Number.isFinite(nextUnitCost) ? { unitCost: nextUnitCost } : {}),
      totalCost: Number.isFinite(nextUnitCost)
        ? Math.round(newQuantity * nextUnitCost * 100) / 100
        : state.record.totalCost,
    },
  });

  const messageParts: string[] = [];
  if (quantityChanged) {
    messageParts.push(`数量更正为 ${newQuantity} 片`);
  }
  if (unitCostChanged) {
    messageParts.push(`单位成本更正为 ${nextUnitCost.toFixed(3)}`);
  }

  return {
    recordNumber: state.record.recordNumber,
    productId: state.record.productId,
    status: 'updated' as const,
    message: messageParts.join('，'),
  };
}

async function deleteRecordInTransaction(
  tx: Prisma.TransactionClient,
  batchId: string,
  recordId: string
) {
  const state = await getMutableRecordState(tx, recordId, batchId);

  const decrementQty = state.record.quantity;
  const availableQty = state.inventory.quantity - state.inventory.reservedQuantity;

  if (availableQty < decrementQty) {
    throw ApiError.badRequest(
      `扣减后可用库存不足：当前可用 ${availableQty} 片，需要扣减 ${decrementQty} 片`
    );
  }

  if (state.costEntry) {
    await tx.inventoryCostQueue.delete({
      where: { id: state.costEntry.id },
    });
  }

  await tx.inboundRecord.delete({
    where: { id: state.record.id },
  });

  await tx.inventory.update({
    where: { id: state.inventory.id },
    data: {
      quantity: { decrement: decrementQty },
      updatedAt: new Date(),
    },
  });

  return {
    recordNumber: state.record.recordNumber,
    productId: state.record.productId,
  };
}

export async function getOpeningBalanceImportBatchDetail(
  batchId: string
): Promise<OpeningBalanceImportBatchDetail> {
  const records = await loadBatchRecords(batchId);
  return buildBatchDetailFromRecords(batchId, records);
}

export async function correctOpeningBalanceImportBatch(
  batchId: string,
  corrections: OpeningBalanceImportBatchCorrectionInput[]
): Promise<OpeningBalanceImportBatchCorrectionResult> {
  if (corrections.length === 0) {
    throw ApiError.badRequest('请至少提交一条更正记录');
  }

  const results: OpeningBalanceImportBatchCorrectionResult['results'] = [];
  const productIds = new Set<string>();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const correction of corrections) {
    try {
      const result = await prisma.$transaction(tx =>
        applyCorrectionInTransaction(tx, batchId, correction)
      );

      productIds.add(result.productId);

      if (result.status === 'updated') {
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }

      results.push({
        id: correction.id,
        recordNumber: result.recordNumber,
        status: result.status,
        message: result.message,
      });
    } catch (error) {
      results.push({
        id: correction.id,
        status: 'failed',
        message: error instanceof Error ? error.message : '批量更正失败',
      });
    }
  }

  return {
    batchId,
    totalRequested: corrections.length,
    updatedCount,
    skippedCount,
    failedCount: results.filter(result => result.status === 'failed').length,
    productIds: Array.from(productIds),
    results,
  };
}

export async function deleteOpeningBalanceImportBatch(
  batchId: string
): Promise<OpeningBalanceImportBatchDeleteResult> {
  const batchDetail = await getOpeningBalanceImportBatchDetail(batchId);
  const blockedRecords = batchDetail.records.filter(record => !record.canDelete);

  if (blockedRecords.length > 0) {
    throw ApiError.badRequest(
      '这批期初数据里已有记录进入后续业务，当前不能整批删除',
      blockedRecords.map(record => ({
        id: record.id,
        recordNumber: record.recordNumber,
        productCode: record.productCode,
        batchNumber: record.batchNumber,
        reason: record.blockedReason,
      }))
    );
  }

  const deletedRecordNumbers: string[] = [];
  const productIds = new Set<string>();

  await prisma.$transaction(async tx => {
    for (const record of batchDetail.records) {
      const deletedRecord = await deleteRecordInTransaction(tx, batchId, record.id);
      deletedRecordNumbers.push(deletedRecord.recordNumber);
      productIds.add(deletedRecord.productId);
    }
  });

  return {
    batchId,
    deletedCount: deletedRecordNumbers.length,
    productIds: Array.from(productIds),
    deletedRecordNumbers,
  };
}
