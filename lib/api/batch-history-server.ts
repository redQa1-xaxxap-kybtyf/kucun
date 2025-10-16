/**
 * 批次库存流水服务端聚合
 * 用于构建批次变动追溯页面的数据来源
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  BatchHistoryResult,
  BatchMovementGroup,
  InventoryMovementEntry,
} from '@/lib/types/inventory';

type MovementSource =
  | {
      kind: 'inbound';
      data: Awaited<
        ReturnType<typeof prisma.inboundRecord.findMany>
      >[number] & {
        product: {
          id: string;
          code: string;
          name: string;
          unit: string;
          specification: string | null;
          piecesPerUnit: number;
        };
        variant: {
          id: string;
          colorCode: string;
          colorName: string | null;
        } | null;
        user: {
          id: string;
          name: string;
        } | null;
      };
    }
  | {
      kind: 'outbound';
      data: Awaited<
        ReturnType<typeof prisma.outboundRecord.findMany>
      >[number] & {
        product: {
          id: string;
          code: string;
          name: string;
          unit: string;
          specification: string | null;
          piecesPerUnit: number;
        };
        variant: {
          id: string;
          colorCode: string;
          colorName: string | null;
        } | null;
        operator: {
          id: string;
          name: string;
        };
        customer: {
          id: string;
          name: string;
        } | null;
        salesOrder: {
          id: string;
          orderNumber: string;
        } | null;
      };
    }
  | {
      kind: 'adjustment';
      data: Awaited<
        ReturnType<typeof prisma.inventoryAdjustment.findMany>
      >[number] & {
        product: {
          id: string;
          code: string;
          name: string;
          unit: string;
          specification: string | null;
          piecesPerUnit: number;
        };
        variant: {
          id: string;
          colorCode: string;
          colorName: string | null;
        } | null;
        operator: {
          id: string;
          name: string;
        };
        approver: {
          id: string;
          name: string;
        } | null;
      };
    };

type MovementProduct = NonNullable<InventoryMovementEntry['product']>;

function toMovementProduct(
  product:
    | {
        id: string;
        code: string;
        name: string;
        unit: string;
        specification: string | null;
        piecesPerUnit: number | null;
      }
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

function buildGroupKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId ?? 'default'}`;
}

function ensureGroup(
  groups: Map<string, BatchMovementGroup>,
  key: string,
  seed: {
    product: InventoryMovementEntry['product'];
    variant?: InventoryMovementEntry['variant'];
  }
) {
  if (!groups.has(key)) {
    groups.set(key, {
      key,
      product: seed.product,
      variant: seed.variant,
      currentQuantity: 0,
      totalInbound: 0,
      totalOutbound: 0,
      totalAdjustment: 0,
      movements: [],
    });
  }

  return groups.get(key)!;
}

function mapSourcesToEntries(
  sources: MovementSource[],
  currentInventoryMap: Map<string, number>
) {
  const groups = new Map<string, BatchMovementGroup>();
  let firstEventAt: string | undefined;
  let lastEventAt: string | undefined;

  sources.forEach(source => {
    const { kind, data } = source;
    const productInfo = toMovementProduct(data.product)!;

    const variantInfo = data.variant
      ? {
          id: data.variant.id,
          colorCode: data.variant.colorCode,
          colorName: data.variant.colorName,
        }
      : undefined;

    const groupKey = buildGroupKey(data.productId, data.variantId);
    const group = ensureGroup(groups, groupKey, {
      product: productInfo,
      variant: variantInfo,
    });

    const entry: InventoryMovementEntry = {
      id: data.id,
      recordNumber:
        kind === 'adjustment'
          ? data.adjustmentNumber
          : (data.recordNumber ?? data.id),
      type: kind,
      productId: data.productId,
      variantId: data.variantId ?? undefined,
      batchNumber: data.batchNumber ?? undefined,
      quantityChange: 0,
      createdAt: data.createdAt.toISOString(),
      remarks:
        kind === 'inbound'
          ? (data.remarks ?? undefined)
          : kind === 'outbound'
            ? (data.notes ?? undefined)
            : (data.notes ?? undefined),
      reason:
        kind === 'inbound'
          ? data.reason
          : kind === 'outbound'
            ? (data.reason ?? undefined)
            : (data.reason ?? undefined),
      operator:
        kind === 'inbound'
          ? data.user
            ? { id: data.user.id, name: data.user.name ?? '—' }
            : undefined
          : kind === 'outbound'
            ? { id: data.operator.id, name: data.operator.name ?? '—' }
            : { id: data.operator.id, name: data.operator.name ?? '—' },
      product: productInfo,
      variant: variantInfo,
    };

    if (kind === 'inbound') {
      const quantity = Number(data.quantity ?? 0);
      entry.quantityChange = quantity;
    } else if (kind === 'outbound') {
      const quantity = Number(data.quantity ?? 0);
      entry.quantityChange = -Math.abs(quantity);
      if (data.salesOrder) {
        entry.referenceNumber = data.salesOrder.orderNumber;
      }
    } else {
      entry.quantityChange = data.adjustQuantity;
      entry.beforeQuantitySnapshot = data.beforeQuantity;
      entry.afterQuantitySnapshot = data.afterQuantity;
    }

    group.movements.push(entry);

    if (entry.quantityChange > 0 && kind === 'inbound') {
      group.totalInbound += entry.quantityChange;
    } else if (entry.quantityChange < 0 && kind === 'outbound') {
      group.totalOutbound += Math.abs(entry.quantityChange);
    } else if (kind === 'adjustment') {
      group.totalAdjustment += entry.quantityChange;
    }

    if (!firstEventAt || entry.createdAt < firstEventAt) {
      firstEventAt = entry.createdAt;
    }
    if (!lastEventAt || entry.createdAt > lastEventAt) {
      lastEventAt = entry.createdAt;
    }
  });

  groups.forEach(group => {
    const currentQuantity =
      currentInventoryMap.get(group.key) ?? group.currentQuantity ?? 0;
    group.currentQuantity = currentQuantity;

    const sortedDescending = group.movements.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let runningBalance =
      currentQuantity !== 0 || currentInventoryMap.has(group.key)
        ? currentQuantity
        : undefined;

    sortedDescending.forEach(entry => {
      if (
        entry.type === 'adjustment' &&
        entry.afterQuantitySnapshot !== undefined
      ) {
        runningBalance = entry.afterQuantitySnapshot;
      } else if (runningBalance === undefined) {
        if (entry.quantityChange !== 0) {
          runningBalance =
            entry.type === 'outbound'
              ? Math.abs(entry.quantityChange)
              : entry.quantityChange;
        } else {
          runningBalance = 0;
        }
      }

      const balanceAfter =
        entry.type === 'adjustment' && entry.afterQuantitySnapshot !== undefined
          ? entry.afterQuantitySnapshot
          : (runningBalance ?? 0);

      const balanceBefore =
        entry.type === 'adjustment' &&
        entry.beforeQuantitySnapshot !== undefined
          ? entry.beforeQuantitySnapshot
          : balanceAfter - entry.quantityChange;

      entry.balanceAfter = balanceAfter;
      entry.balanceBefore = balanceBefore;

      runningBalance = balanceBefore;
    });

    const latestEntry = sortedDescending[0];
    const earliestEntry = sortedDescending[sortedDescending.length - 1];

    group.movements = sortedDescending.reverse();

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
  });

  return {
    groups: Array.from(groups.values()),
    firstEventAt,
    lastEventAt,
  };
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
  let effectiveBatch = normalizedBatch;
  let targetProductId = options?.productId;
  let targetVariantId: string | null | undefined = options?.variantId;
  const focusInventoryId = options?.inventoryId;

  const targetInventory = focusInventoryId
    ? await prisma.inventory.findUnique({
        where: { id: focusInventoryId },
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
      })
    : null;

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

  const mappedTargetInventory: BatchHistoryResult['targetInventory'] =
    targetInventory
      ? {
          id: targetInventory.id,
          batchNumber: targetInventory.batchNumber,
          quantity: targetInventory.quantity,
          reservedQuantity: targetInventory.reservedQuantity,
          product: toMovementProduct(targetInventory.product),
          variant: targetInventory.variant
            ? {
                id: targetInventory.variant.id,
                colorCode: targetInventory.variant.colorCode,
                colorName: targetInventory.variant.colorName,
              }
            : undefined,
        }
      : undefined;

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

  const inboundWhere: Prisma.InboundRecordWhereInput = {
    batchNumber: effectiveBatch,
  };
  if (targetProductId) {
    inboundWhere.productId = targetProductId;
  }
  if (variantFilterDefined) {
    inboundWhere.variantId = targetVariantId ?? null;
  }

  const outboundWhere: Prisma.OutboundRecordWhereInput = {
    batchNumber: effectiveBatch,
  };
  if (targetProductId) {
    outboundWhere.productId = targetProductId;
  }
  if (variantFilterDefined) {
    outboundWhere.variantId = targetVariantId ?? null;
  }

  const adjustmentWhere: Prisma.InventoryAdjustmentWhereInput = {
    batchNumber: effectiveBatch,
  };
  if (targetProductId) {
    adjustmentWhere.productId = targetProductId;
  }
  if (variantFilterDefined) {
    adjustmentWhere.variantId = targetVariantId ?? null;
  }

  const inventoryWhere: Prisma.InventoryWhereInput = {
    batchNumber: effectiveBatch,
  };
  if (targetProductId) {
    inventoryWhere.productId = targetProductId;
  }
  if (variantFilterDefined) {
    inventoryWhere.variantId = targetVariantId ?? null;
  }
  if (focusInventoryId) {
    inventoryWhere.id = focusInventoryId;
  }

  const [inbounds, outbounds, adjustments, inventories] = await Promise.all([
    prisma.inboundRecord.findMany({
      where: inboundWhere,
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
      },
    }),
    prisma.outboundRecord.findMany({
      where: outboundWhere,
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
    }),
    prisma.inventoryAdjustment.findMany({
      where: adjustmentWhere,
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
    }),
    prisma.inventory.findMany({
      where: inventoryWhere,
      select: {
        productId: true,
        variantId: true,
        quantity: true,
      },
    }),
  ]);

  const inventoryMap = new Map<string, number>();
  inventories.forEach(record => {
    const key = buildGroupKey(record.productId, record.variantId);
    inventoryMap.set(
      key,
      (inventoryMap.get(key) ?? 0) + Number(record.quantity ?? 0)
    );
  });

  const mapResult = mapSourcesToEntries(
    [
      ...inbounds.map(data => ({ kind: 'inbound', data }) as MovementSource),
      ...outbounds.map(data => ({ kind: 'outbound', data }) as MovementSource),
      ...adjustments.map(
        data => ({ kind: 'adjustment', data }) as MovementSource
      ),
    ],
    inventoryMap
  );

  let groups = mapResult.groups;
  if (targetProductId) {
    groups = groups.filter(group => group.product?.id === targetProductId);
  }
  if (variantFilterDefined) {
    groups = groups.filter(
      group => (group.variant?.id ?? null) === (targetVariantId ?? null)
    );
  }

  if (groups.length === 0 && mappedTargetInventory) {
    groups = [
      {
        key: buildGroupKey(
          mappedTargetInventory.product?.id ?? 'unknown',
          mappedTargetInventory.variant?.id ?? null
        ),
        product: mappedTargetInventory.product,
        variant: mappedTargetInventory.variant,
        currentQuantity: mappedTargetInventory.quantity,
        openingBalance: mappedTargetInventory.quantity,
        closingBalance: mappedTargetInventory.quantity,
        netChange: 0,
        totalInbound: 0,
        totalOutbound: 0,
        totalAdjustment: 0,
        movements: [],
      },
    ];
  }

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
