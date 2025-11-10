import { calculatePurchaseOrderExecution } from '@/lib/api/purchase-orders/fulfillment';
import { prisma } from '@/lib/db';
import type { PurchaseOrderStatus } from '@/lib/types/purchase-order';

export function resolvePagination(params?: { page?: number; limit?: number }) {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const limit = params?.limit && params.limit > 0 ? params.limit : 20;
  return { page, limit, skip: (page - 1) * limit };
}

export async function fetchPurchaseOrderPageData(
  params:
    | {
        status?: PurchaseOrderStatus;
        supplierId?: string;
      }
    | undefined,
  pagination: { skip: number; limit: number }
) {
  const where = {
    ...(params?.status && { status: params.status }),
    ...(params?.supplierId && { supplierId: params.supplierId }),
  };

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        user: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { orders, total };
}

export async function enhancePurchaseOrders(
  orders: Awaited<ReturnType<typeof fetchPurchaseOrderPageData>>['orders']
) {
  const { byOrder, byItem } = await loadInboundMapsForOrders(orders);

  return orders.map(order => {
    const { summary, items } = calculatePurchaseOrderExecution(
      order,
      byOrder,
      byItem
    );

    const mappedItems = order.items.map((item, index) => ({
      ...item,
      receivedQuantity: items[index]?.receivedQuantity ?? 0,
      executionRate: items[index]?.executionRate ?? 0,
    }));

    return {
      ...order,
      items: mappedItems,
      executionSummary: summary,
    };
  });
}

export function filterOrdersByFulfillment(
  orders: Array<Awaited<ReturnType<typeof enhancePurchaseOrders>>[number]>,
  fulfillment?: 'none' | 'partial' | 'complete'
) {
  if (!fulfillment) {
    return orders;
  }

  return orders.filter(
    order => order.executionSummary.fulfillmentStatus === fulfillment
  );
}

async function loadInboundMapsForOrders(
  orders: Awaited<ReturnType<typeof fetchPurchaseOrderPageData>>['orders']
) {
  const orderIds = orders.map(order => order.id);
  const itemIds = orders.flatMap(order => order.items.map(item => item.id));
  const byOrder = new Map<string, number>();
  const byItem = new Map<string, number>();

  if (orderIds.length > 0) {
    const orderInbound = await prisma.inboundRecord.groupBy({
      by: ['purchaseOrderId'],
      where: {
        purchaseOrderId: { in: orderIds, not: null },
      },
      _sum: { quantity: true },
    });

    for (const row of orderInbound) {
      if (row.purchaseOrderId) {
        byOrder.set(row.purchaseOrderId, row._sum.quantity ?? 0);
      }
    }
  }

  if (itemIds.length > 0) {
    const itemInbound = await prisma.inboundRecord.groupBy({
      by: ['purchaseOrderItemId'],
      where: {
        purchaseOrderItemId: { in: itemIds, not: null },
      },
      _sum: { quantity: true },
    });

    for (const row of itemInbound) {
      if (row.purchaseOrderItemId) {
        byItem.set(row.purchaseOrderItemId, row._sum.quantity ?? 0);
      }
    }
  }

  return { byOrder, byItem };
}
