import type { Prisma } from '@prisma/client';

import { convertPurchaseOrderQuantityToPieces } from '@/lib/utils/purchase-order-unit';

export type PurchaseOrderFulfillmentStatus = 'none' | 'partial' | 'complete';

export interface PurchaseOrderExecutionSummary {
  orderedQuantity: number;
  receivedQuantity: number;
  executionRate: number;
  fulfillmentStatus: PurchaseOrderFulfillmentStatus;
}

export interface PurchaseOrderItemExecution {
  id: string;
  receivedQuantity: number;
  executionRate: number;
}

const EXECUTION_EPSILON = 1e-6;

export function calculatePurchaseOrderExecution(
  order: {
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      unit?: string | null;
      piecesPerUnit?: number | null;
      displayName?: string | null;
      productCode?: string | null;
    }>;
  },
  inboundByOrder: Map<string, number>,
  inboundByItem: Map<string, number>
): {
  summary: PurchaseOrderExecutionSummary;
  items: PurchaseOrderItemExecution[];
} {
  const orderedQuantities = order.items.map(item =>
    convertPurchaseOrderQuantityToPieces(item)
  );
  const orderedQuantity = orderedQuantities.reduce((sum, item) => sum + item, 0);
  const receivedQuantity = inboundByOrder.get(order.id) ?? 0;
  const executionRate =
    orderedQuantity > 0
      ? Number((receivedQuantity / orderedQuantity).toFixed(4))
      : 0;

  let fulfillmentStatus: PurchaseOrderFulfillmentStatus = 'none';
  if (receivedQuantity > EXECUTION_EPSILON) {
    fulfillmentStatus =
      receivedQuantity + EXECUTION_EPSILON >= orderedQuantity
        ? 'complete'
        : 'partial';
  }

  const items = order.items.map(item => {
    const itemReceived = inboundByItem.get(item.id) ?? 0;
    const orderedItemQuantity = convertPurchaseOrderQuantityToPieces(item);
    const itemExecutionRate =
      orderedItemQuantity > 0
        ? Number((itemReceived / orderedItemQuantity).toFixed(4))
        : 0;

    return {
      id: item.id,
      receivedQuantity: itemReceived,
      executionRate: itemExecutionRate,
    };
  });

  return {
    summary: {
      orderedQuantity,
      receivedQuantity,
      executionRate,
      fulfillmentStatus,
    },
    items,
  };
}

export async function refreshPurchaseOrderFulfillment(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string
): Promise<void> {
  const items: Array<{
    id: string;
    quantity: number;
    unit: string | null;
    piecesPerUnit: number | null;
    displayName: string | null;
    productCode: string;
    inboundStatus: string | null;
    inboundReceivedAt: Date | null;
  }> = [];
  const pageSize = 2000;
  let cursor: string | undefined;

  while (true) {
    const page = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: {
        id: true,
        quantity: true,
        unit: true,
        piecesPerUnit: true,
        displayName: true,
        productCode: true,
        inboundStatus: true,
        inboundReceivedAt: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    items.push(...page);
    if (page.length < pageSize) {
      break;
    }

    cursor = page[page.length - 1]?.id;
    if (!cursor) {
      break;
    }
  }

  if (items.length === 0) {
    return;
  }

  const itemIds = items.map(item => item.id);

  const inboundTotals = await tx.inboundRecord.groupBy({
    by: ['purchaseOrderItemId'],
    where: {
      purchaseOrderId,
      purchaseOrderItemId: { in: itemIds, not: null },
    },
    _sum: { quantity: true },
  });

  const inboundMap = new Map<string, number>();
  for (const record of inboundTotals) {
    if (record.purchaseOrderItemId) {
      inboundMap.set(record.purchaseOrderItemId, record._sum.quantity ?? 0);
    }
  }

  const updates: Promise<unknown>[] = [];
  const now = new Date();

  for (const item of items) {
    const received = inboundMap.get(item.id) ?? 0;
    const orderedQuantity = convertPurchaseOrderQuantityToPieces(item);
    const fullyReceived =
      orderedQuantity > 0 &&
      received + EXECUTION_EPSILON >= orderedQuantity;
    const newStatus = fullyReceived ? 'received' : 'pending';
    const newReceivedAt = fullyReceived
      ? (item.inboundReceivedAt ?? now)
      : null;

    if (
      item.inboundStatus !== newStatus ||
      item.inboundReceivedAt !== newReceivedAt
    ) {
      updates.push(
        tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            inboundStatus: newStatus,
            inboundReceivedAt: newReceivedAt,
          },
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}
