import { NextResponse, type NextRequest } from 'next/server';

import {
  executeMinimalInboundTransaction,
  type MinimalInboundTransactionResult,
} from '@/lib/api/minimal-inbound-transaction';
import { refreshPurchaseOrderFulfillment } from '@/lib/api/purchase-orders/fulfillment';
import { withAuth } from '@/lib/auth/api-helpers';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updatePurchaseOrderStatusSchema } from '@/lib/validations/purchase-order';

const STATUS_FLOW: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: [
    PURCHASE_ORDER_STATUS.ORDERED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.ORDERED]: [
    PURCHASE_ORDER_STATUS.SHIPPED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.SHIPPED]: [PURCHASE_ORDER_STATUS.IN_TRANSIT],
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: [PURCHASE_ORDER_STATUS.ARRIVED],
  [PURCHASE_ORDER_STATUS.ARRIVED]: [PURCHASE_ORDER_STATUS.COMPLETED],
  [PURCHASE_ORDER_STATUS.COMPLETED]: [],
  [PURCHASE_ORDER_STATUS.CANCELLED]: [],
};

function isValidStatusTransition(
  currentStatus: PurchaseOrderStatus,
  newStatus: PurchaseOrderStatus
): boolean {
  return STATUS_FLOW[currentStatus]?.includes(newStatus) ?? false;
}

export const PUT = withAuth(
  async (
    request: NextRequest,
    { user, params }: { user: { id: string }; params: { id: string } }
  ) => {
    try {
      const body = await request.json();
      const validatedData = updatePurchaseOrderStatusSchema.parse(body);

      const order = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              batchNumber: true,
            },
          },
        },
      });

      if (!order) {
        return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
      }

      if (
        !isValidStatusTransition(
          order.status as PurchaseOrderStatus,
          validatedData.status
        )
      ) {
        return NextResponse.json(
          {
            error: `无法从 ${order.status} 状态变更为 ${validatedData.status} 状态`,
          },
          { status: 400 }
        );
      }

      const now = new Date();

      const { updatedOrder, inboundResults } = await withIdempotency(
        validatedData.idempotencyKey,
        'purchase_order_status_change',
        order.id,
        user.id,
        {
          orderId: order.id,
          nextStatus: validatedData.status,
          previousStatus: order.status,
        },
        async () =>
          await prisma.$transaction(async tx => {
            const updateData: Record<string, unknown> = {
              status: validatedData.status,
            };

            if (validatedData.status === PURCHASE_ORDER_STATUS.SHIPPED) {
              updateData.shipmentDate = now;
            } else if (validatedData.status === PURCHASE_ORDER_STATUS.ARRIVED) {
              updateData.arrivalDate = now;
            }

            const savedOrder = await tx.purchaseOrder.update({
              where: { id: params.id },
              data: updateData,
            });

            const createdInboundRecords: MinimalInboundTransactionResult[] = [];

            if (validatedData.status === PURCHASE_ORDER_STATUS.ARRIVED) {
              const itemIds = order.items.map(item => item.id);
              const inboundTotals = itemIds.length
                ? await tx.inboundRecord.groupBy({
                    by: ['purchaseOrderItemId'],
                    where: {
                      purchaseOrderId: order.id,
                      purchaseOrderItemId: { in: itemIds, not: null },
                    },
                    _sum: { quantity: true },
                  })
                : [];

              const receivedMap = new Map<string, number>();
              for (const record of inboundTotals) {
                if (record.purchaseOrderItemId) {
                  receivedMap.set(
                    record.purchaseOrderItemId,
                    record._sum.quantity ?? 0
                  );
                }
              }

              for (const item of order.items) {
                if (!item.productId) {
                  continue;
                }

                const alreadyReceived = receivedMap.get(item.id) ?? 0;
                const remainingQuantity = Math.max(
                  0,
                  (item.quantity ?? 0) - alreadyReceived
                );

                if (remainingQuantity <= 0) {
                  continue;
                }

                const inbound = await executeMinimalInboundTransaction(
                  {
                    productId: item.productId,
                    variantId: undefined,
                    quantity: remainingQuantity,
                    unitCost: item.unitPrice ?? 0,
                    reason: 'purchase',
                    remarks: `采购订单${order.orderNumber}到货`,
                    batchNumber: item.batchNumber ?? '',
                    userId: user.id,
                    purchaseOrderId: order.id,
                    purchaseOrderItemId: item.id,
                  },
                  { tx }
                );

                createdInboundRecords.push(inbound);
              }

              await refreshPurchaseOrderFulfillment(tx, order.id);
            }

            return {
              updatedOrder: savedOrder,
              inboundResults: createdInboundRecords,
            };
          })
      );

      if (inboundResults.length > 0) {
        const productIds = Array.from(
          new Set(inboundResults.map(record => record.productId))
        );
        try {
          await Promise.all([
            ...productIds.map(id => invalidateInventoryCache(id)),
            ...productIds.map(id => revalidateProducts(id)),
          ]);
        } catch (cacheError) {
          console.error(
            'Purchase order cache revalidation failed:',
            cacheError
          );
        }
      }

      return NextResponse.json({ data: updatedOrder });
    } catch (error) {
      logger.error('purchase-orders', '更新订单状态失败', error, {
        userId: user.id,
        orderId: params.id,
      });
      return NextResponse.json({ error: '更新订单状态失败' }, { status: 500 });
    }
  }
);
