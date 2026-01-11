/**
 * 批次库存流水服务端聚合
 * 用于构建批次变动追溯页面的数据来源
 */

import type { Prisma } from '@prisma/client';

import {
  buildGroupKey,
  mapSourcesToEntries,
  toMovementProduct,
  type MovementSource,
} from '@/lib/api/batch-history-mapper';
import { prisma } from '@/lib/db';
import type {
  BatchHistoryResult,
  BatchMovementGroup,
} from '@/lib/types/inventory';

const MAX_BATCH_HISTORY_RECORDS = 5000;

type BatchWhereClauses = {
  inbound: Prisma.InboundRecordWhereInput;
  outbound: Prisma.OutboundRecordWhereInput;
  adjustment: Prisma.InventoryAdjustmentWhereInput;
  inventory: Prisma.InventoryWhereInput;
};

type BatchSources = {
  inbounds: Awaited<ReturnType<typeof fetchInboundRecords>>;
  outboundRecords: Awaited<ReturnType<typeof fetchOutboundRecords>>;
  adjustments: Awaited<ReturnType<typeof fetchAdjustmentRecords>>;
  inventories: Awaited<ReturnType<typeof fetchInventoryRecords>>;
};

async function loadTargetInventory(inventoryId?: string) {
  if (!inventoryId) {
    return null;
  }

  return prisma.inventory.findUnique({
    where: { id: inventoryId },
    select: {
      id: true,
      batchNumber: true,
      quantity: true,
      reservedQuantity: true,
      productId: true,
      variantId: true,
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
        },
      },
    },
  });
}

type TargetInventoryRecord = Awaited<ReturnType<typeof loadTargetInventory>>;

function buildTargetInventorySummary(
  record: TargetInventoryRecord | null
): BatchHistoryResult['targetInventory'] {
  if (!record) {
    return undefined;
  }

  return {
    id: record.id,
    batchNumber: record.batchNumber,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    product: toMovementProduct(record.product),
    variant: record.variant
      ? {
          id: record.variant.id,
          colorCode: record.variant.colorCode,
          colorName: record.variant.colorName,
        }
      : undefined,
  };
}

function buildWhereClauses(
  batchNumber: string,
  productId?: string,
  variantId?: string | null,
  variantFilterDefined = false,
  focusInventoryId?: string
): BatchWhereClauses {
  const inbound: Prisma.InboundRecordWhereInput = { batchNumber };
  const outbound: Prisma.OutboundRecordWhereInput = { batchNumber };
  const adjustment: Prisma.InventoryAdjustmentWhereInput = { batchNumber };
  const inventory: Prisma.InventoryWhereInput = { batchNumber };

  if (productId) {
    inbound.productId = productId;
    outbound.productId = productId;
    adjustment.productId = productId;
    inventory.productId = productId;
  }

  if (variantFilterDefined) {
    inbound.variantId = variantId ?? null;
    outbound.variantId = variantId ?? null;
    adjustment.variantId = variantId ?? null;
    inventory.variantId = variantId ?? null;
  }

  if (focusInventoryId) {
    inventory.id = focusInventoryId;
  }

  return {
    inbound,
    outbound,
    adjustment,
    inventory,
  };
}

async function fetchBatchSources(
  where: BatchWhereClauses
): Promise<BatchSources> {
  const [inbounds, outboundRecords, adjustments, inventories] =
    await Promise.all([
      fetchInboundRecords(where.inbound),
      fetchOutboundRecords(where.outbound),
      fetchAdjustmentRecords(where.adjustment),
      fetchInventoryRecords(where.inventory),
    ]);

  return { inbounds, outboundRecords, adjustments, inventories };
}

function fetchInboundRecords(where: Prisma.InboundRecordWhereInput) {
  return prisma.inboundRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      // 关联批次规格参数，用于获取批次级别的 piecesPerUnit
      batchSpecification: {
        select: {
          piecesPerUnit: true,
        },
      },
    },
    take: MAX_BATCH_HISTORY_RECORDS,
  });
}

function fetchOutboundRecords(where: Prisma.OutboundRecordWhereInput) {
  return prisma.outboundRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
        },
      },
      operator: {
        select: {
          id: true,
          name: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
    take: MAX_BATCH_HISTORY_RECORDS,
  });
}

function fetchAdjustmentRecords(where: Prisma.InventoryAdjustmentWhereInput) {
  return prisma.inventoryAdjustment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
        },
      },
      operator: {
        select: {
          id: true,
          name: true,
        },
      },
      approver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: MAX_BATCH_HISTORY_RECORDS,
  });
}

function fetchInventoryRecords(where: Prisma.InventoryWhereInput) {
  return prisma.inventory.findMany({
    where,
    select: {
      productId: true,
      variantId: true,
      quantity: true,
    },
    take: MAX_BATCH_HISTORY_RECORDS,
  });
}

function convertToMovementSources(
  sources: Pick<BatchSources, 'inbounds' | 'outboundRecords' | 'adjustments'>
) {
  const inboundSources = sources.inbounds.map(
    data => ({ kind: 'inbound', data }) as MovementSource
  );
  const outboundSources = sources.outboundRecords.map(
    data => ({ kind: 'outbound', data }) as MovementSource
  );
  const adjustmentSources = sources.adjustments.map(
    data => ({ kind: 'adjustment', data }) as MovementSource
  );

  return [...inboundSources, ...outboundSources, ...adjustmentSources];
}

function buildInventoryQuantityMap(
  records: BatchSources['inventories']
): Map<string, number> {
  const inventoryMap = new Map<string, number>();
  records.forEach(record => {
    const key = buildGroupKey(record.productId, record.variantId);
    const quantity = Number(record.quantity ?? 0);
    inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + quantity);
  });
  return inventoryMap;
}

function filterGroupsByTarget(
  groups: BatchMovementGroup[],
  productId?: string,
  variantId?: string | null,
  variantFilterDefined = false
) {
  let filtered = groups;

  if (productId) {
    filtered = filtered.filter(group => group.product?.id === productId);
  }

  if (variantFilterDefined) {
    filtered = filtered.filter(
      group => (group.variant?.id ?? null) === (variantId ?? null)
    );
  }

  return filtered;
}

function ensureFallbackGroup(
  groups: BatchMovementGroup[],
  targetInventory: BatchHistoryResult['targetInventory']
) {
  if (groups.length || !targetInventory) {
    return groups;
  }

  const fallback: BatchMovementGroup = {
    key: buildGroupKey(
      targetInventory.product?.id ?? 'unknown',
      targetInventory.variant?.id ?? null
    ),
    product: targetInventory.product,
    variant: targetInventory.variant,
    currentQuantity: targetInventory.quantity,
    openingBalance: targetInventory.quantity,
    closingBalance: targetInventory.quantity,
    netChange: 0,
    totalInbound: 0,
    totalOutbound: 0,
    totalAdjustment: 0,
    movements: [],
  };

  return [fallback];
}

export async function getBatchHistoryByNumber(
  batchNumber: string,
  options?: {
    inventoryId?: string;
    productId?: string;
    variantId?: string | null;
  }
): Promise<BatchHistoryResult> {
  const normalizedBatch = batchNumber.trim();
  const focusInventoryId = options?.inventoryId;

  let effectiveBatch = normalizedBatch;
  let targetProductId = options?.productId;
  let targetVariantId: string | null | undefined = options?.variantId;

  const targetInventory = await loadTargetInventory(focusInventoryId);

  if (focusInventoryId && !targetInventory) {
    return {
      batchNumber: normalizedBatch,
      groups: [],
      filteredBy: {
        inventoryId: focusInventoryId,
        productId: targetProductId,
        variantId:
          targetVariantId !== undefined ? (targetVariantId ?? null) : undefined,
      },
    };
  }

  if (targetInventory?.batchNumber) {
    effectiveBatch = targetInventory.batchNumber;
  }

  if (targetInventory) {
    targetProductId = targetInventory.productId;
    targetVariantId = targetInventory.variantId ?? null;
  }

  const mappedTargetInventory = buildTargetInventorySummary(targetInventory);

  if (!effectiveBatch) {
    return {
      batchNumber,
      groups: [],
      filteredBy: {
        inventoryId: focusInventoryId,
        productId: targetProductId,
        variantId:
          targetVariantId !== undefined ? (targetVariantId ?? null) : undefined,
      },
      targetInventory: mappedTargetInventory,
    };
  }

  const variantFilterDefined = targetVariantId !== undefined;

  const whereClauses = buildWhereClauses(
    effectiveBatch,
    targetProductId,
    targetVariantId ?? null,
    variantFilterDefined,
    focusInventoryId
  );

  const sources = await fetchBatchSources(whereClauses);
  const inventoryMap = buildInventoryQuantityMap(sources.inventories);
  const mapResult = mapSourcesToEntries(
    convertToMovementSources(sources),
    inventoryMap
  );

  let groups = filterGroupsByTarget(
    mapResult.groups,
    targetProductId,
    targetVariantId ?? null,
    variantFilterDefined
  );
  groups = ensureFallbackGroup(groups, mappedTargetInventory);

  return {
    batchNumber: effectiveBatch,
    groups,
    firstEventAt: mapResult.firstEventAt,
    lastEventAt: mapResult.lastEventAt,
    filteredBy: {
      inventoryId: focusInventoryId,
      productId: targetProductId,
      variantId: variantFilterDefined ? (targetVariantId ?? null) : undefined,
    },
    targetInventory: mappedTargetInventory,
  };
}
