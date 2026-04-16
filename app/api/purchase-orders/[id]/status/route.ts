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
import {
  ensurePurchaseOrderCostAllocatedBeforeInbound,
  resolveInboundUnitCost,
} from '@/lib/services/purchase-order-cost-service';
import {
  ensurePurchaseOrderPayable,
  shouldCreatePayable,
} from '@/lib/services/purchase-order-payable';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { checkIdempotency, withIdempotency } from '@/lib/utils/idempotency';
import { toNumber } from '@/lib/utils/number';
import {
  convertPurchaseOrderQuantityToPieces,
  convertPurchaseOrderUnitPriceToPieceCost,
  isPurchaseOrderUnitConversionError,
} from '@/lib/utils/purchase-order-unit';
import { updatePurchaseOrderStatusSchema } from '@/lib/validations/purchase-order';

type PurchaseOrderParams = { id: string };

async function resolveOrderParams(
  params?: Promise<Record<string, string>> | Record<string, string>
): Promise<PurchaseOrderParams> {
  const resolved = await resolveParams<Record<string, string>>(params);
  if (!resolved.id) {
    throw new Error('缺少订单编号');
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
            productCode: true,
            displayName: true,
            quantity: true,
            unit: true,
            piecesPerUnit: true,
            unitPrice: true,
            unitCostWithExpense: true,
            batchNumber: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '采购订单不存在' },
        { status: 404 }
      );
    }

    const existingIdempotency = await checkIdempotency(
      normalizedPayload.idempotencyKey
    );

    if (
      existingIdempotency.isNew &&
      !isValidStatusTransition(
        order.status as PurchaseOrderStatus,
        normalizedPayload.status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
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
          let payableExpenseAmount: number | null | undefined =
            order.expenseAmount === null
              ? null
              : toNumber(order.expenseAmount, 0);

          if (normalizedPayload.status === PURCHASE_ORDER_STATUS.ARRIVED) {
            const { totalExpenseAmount, allocationsByItemId } =
              await ensurePurchaseOrderCostAllocatedBeforeInbound(tx, order.id);
            // ✅ 费用分摊会在入库前把“费用台账汇总”同步回订单，这里必须把最新费用带入应付生成兜底逻辑
            payableExpenseAmount = totalExpenseAmount;

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

              const orderedQuantity = convertPurchaseOrderQuantityToPieces(item, {
                strict: true,
              });
              const alreadyReceived = receivedMap.get(item.id) ?? 0;
              const remainingQuantity = Math.max(
                0,
                orderedQuantity - alreadyReceived
              );

              if (remainingQuantity <= 0) {
                continue;
              }

              const allocation = allocationsByItemId.get(item.id);
              const fallbackPieceCost = convertPurchaseOrderUnitPriceToPieceCost(
                {
                  unitPrice:
                    item.unitPrice === null
                      ? null
                      : toNumber(item.unitPrice, Number.NaN),
                  unit: item.unit,
                  piecesPerUnit: item.piecesPerUnit,
                  displayName: item.displayName,
                  productCode: item.productCode,
                },
                { strict: true }
              );

              const inboundUnitCost = resolveInboundUnitCost({
                unitCostWithExpense: allocation?.unitCostWithExpense ?? null,
                unitPrice: fallbackPieceCost,
                fallback: fallbackPieceCost,
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
                  supplierId: order.supplierId,
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
              totalAmount: toNumber(order.totalAmount, 0),
              expenseAmount: payableExpenseAmount, // ✅ 最新费用汇总（用于兜底合并进应付）
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
    if (isPurchaseOrderUnitConversionError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '更新订单状态失败' },
      { status: 500 }
    );
  }
});

