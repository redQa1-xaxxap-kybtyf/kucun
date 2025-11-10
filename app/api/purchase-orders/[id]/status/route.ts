import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
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
import { resolveInboundUnitCost } from '@/lib/services/purchase-order-cost-service';
import {
  ensurePurchaseOrderPayable,
  shouldCreatePayable,
} from '@/lib/services/purchase-order-payable';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updatePurchaseOrderStatusSchema } from '@/lib/validations/purchase-order';

type PurchaseOrderParams = { id: string };

async function resolveOrderParams(
  params?: Promise<Record<string, string>> | Record<string, string>
): Promise<PurchaseOrderParams> {
  const resolved = await resolveParams<Record<string, string>>(params);
  if (!resolved.id) {
    throw new Error('缺少订单ID参数');
  }
  return { id: resolved.id };
}

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

export const PUT = withAuth(async (request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);
  try {
    const body = await request.json();
    const validatedData = updatePurchaseOrderStatusSchema.parse(body);

    const normalizeOptionalString = (value?: string | null) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const normalizeOptionalDate = (value?: string | null) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return new Date(trimmed);
    };

    const normalizedPayload = {
      ...validatedData,
      containerNumber: normalizeOptionalString(validatedData.containerNumber),
      shippingCompany: normalizeOptionalString(validatedData.shippingCompany),
      estimatedArrival: normalizeOptionalDate(validatedData.estimatedArrival),
      shipmentDate: normalizeOptionalDate(validatedData.shipmentDate),
      arrivalDate: normalizeOptionalDate(validatedData.arrivalDate),
    };

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            unitCostWithExpense: true,
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
        normalizedPayload.status
      )
    ) {
      return NextResponse.json(
        {
          error: `无法从 ${order.status} 状态变更为 ${normalizedPayload.status} 状态`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const { updatedOrder, inboundResults } = await withIdempotency(
      normalizedPayload.idempotencyKey,
      'purchase_order_status_change',
      order.id,
      user.id,
      {
        orderId: order.id,
        nextStatus: normalizedPayload.status,
        previousStatus: order.status,
      },
      async () =>
        await prisma.$transaction(async tx => {
          const updateData: Record<string, unknown> = {
            status: normalizedPayload.status,
          };

          if (normalizedPayload.containerNumber !== undefined) {
            updateData.containerNumber = normalizedPayload.containerNumber;
          }

          if (normalizedPayload.shippingCompany !== undefined) {
            updateData.shippingCompany = normalizedPayload.shippingCompany;
          }

          if (normalizedPayload.estimatedArrival !== undefined) {
            updateData.estimatedArrival = normalizedPayload.estimatedArrival;
          }

          if (normalizedPayload.status === PURCHASE_ORDER_STATUS.SHIPPED) {
            updateData.shipmentDate = normalizedPayload.shipmentDate ?? now;
          } else if (
            normalizedPayload.status === PURCHASE_ORDER_STATUS.ARRIVED
          ) {
            updateData.arrivalDate = normalizedPayload.arrivalDate ?? now;
          }

          const savedOrder = await tx.purchaseOrder.update({
            where: { id: orderId },
            data: updateData,
          });

          const createdInboundRecords: MinimalInboundTransactionResult[] = [];

          if (normalizedPayload.status === PURCHASE_ORDER_STATUS.ARRIVED) {
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

              const inboundUnitCost = resolveInboundUnitCost({
                unitCostWithExpense: item.unitCostWithExpense,
                unitPrice: item.unitPrice ?? null,
                fallback: item.unitPrice ?? 0,
              });

              const inbound = await executeMinimalInboundTransaction(
                {
                  productId: item.productId,
                  variantId: undefined,
                  quantity: remainingQuantity,
                  unitCost: inboundUnitCost,
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

          if (shouldCreatePayable(normalizedPayload.status)) {
            await ensurePurchaseOrderPayable(tx, {
              id: order.id,
              supplierId: order.supplierId,
              userId: order.userId,
              orderNumber: order.orderNumber,
              totalAmount: order.totalAmount,
            });
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
        console.error('Purchase order cache revalidation failed:', cacheError);
      }
    }

    return NextResponse.json({ data: updatedOrder });
  } catch (error) {
    logger.error('purchase-orders', '更新订单状态失败', error, {
      userId: user.id,
      orderId,
    });
    return NextResponse.json({ error: '更新订单状态失败' }, { status: 500 });
  }
});
