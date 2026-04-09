import { Prisma as PrismaClient, type Prisma } from '@prisma/client';

import {
  executeInvalidation,
  ORDER_STATUS_CHANGE_INVALIDATION,
} from '@/lib/cache/invalidation-strategy';
import { prisma } from '@/lib/db';
import { getLongTransactionOptions } from '@/lib/db/transaction-options';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ensureCompanyExpenses } from '@/lib/services/expense-service';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
import { parseLocalDateString } from '@/lib/utils/datetime';
import { toNumber } from '@/lib/utils/number';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import {
  DEFAULT_SAMPLE_SETTLEMENT_TYPE,
  getSalesOrderReceivableTotal,
  shouldCreateReceivableForOrder,
} from '@/lib/utils/sample-order';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

import {
  buildFeeItemsInput,
  buildOrderItemsInput,
  calculateFinancials,
  normalizeTransferMode,
} from './financials';
import { reserveInventory, shouldReserveInventory } from './inventory';
import { maybeCreatePayable } from './payable';
import { applyPrepaymentToOrder } from './prepayment';
import { recordCustomerPriceHistory } from './price-history';
import { createPurchaseOrderForTransfer } from './purchase-order';
import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderItemSelect,
  salesOrderRelations,
} from './shared';
import {
  buildTemporaryProductDataFromOrderItem,
  findOrCreateTemporaryProduct,
} from './temporary-products';
import type { CreateInput } from './types';
import {
  ensureCustomerExists,
  ensureProductsExist,
  ensureSupplierExists,
} from './validation';

const createSelect = {
  id: true,
  orderNumber: true,
  customerId: true,
  userId: true,
  supplierId: true,
  status: true,
  orderType: true,
  transferMode: true,
  orderDate: true,
  isSampleOrder: true,
  sampleSettlementType: true,
  itemsAmount: true,
  additionalFees: true,
  expenseAmount: true,
  roundingAdjustment: true,
  costAmount: true,
  profitAmount: true,
  totalAmount: true,
  paidAmount: true,
  remarks: true,
  shippedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: salesOrderRelations.customer,
  user: salesOrderRelations.user,
  items: {
    select: salesOrderItemSelect,
  },
  feeItems: {
    select: {
      id: true,
      feeType: true,
      feeName: true,
      feeAmount: true,
      paidBy: true,
      remarks: true,
    },
  },
  _count: salesOrderRelations._count,
} as const;

type CreatedOrderResult = Prisma.SalesOrderGetPayload<{
  select: typeof createSelect;
}>;

const mapFeeItem = (fee: CreatedOrderResult['feeItems'][number]) => ({
  id: fee.id,
  feeType: fee.feeType,
  feeName: fee.feeName,
  feeAmount: fee.feeAmount,
  paidBy: (fee.paidBy as 'customer' | 'company') ?? 'customer',
  remarks: fee.remarks ?? undefined,
});

const mapCreatedOrder = (
  order: CreatedOrderResult,
  productsMap: Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >
) => {
  const { items, feeItems, _count, ...base } = order;
  const mappedBase = mapOrderBaseFields(base);

  return {
    ...mappedBase,
    hasReturnOrder: false,
    returnOrders: [],
    items: items.map(item =>
      mapSalesOrderItem(
        item,
        item.productId ? productsMap.get(item.productId) : undefined
      )
    ),
    feeItems: feeItems.map(mapFeeItem),
    itemCount: _count.items,
  };
};

function isSalesOrderOrderNumberUniqueConstraintError(error: unknown) {
  if (error instanceof PrismaClient.PrismaClientKnownRequestError) {
    if (error.code !== 'P2002') {
      return false;
    }

    const message = typeof error.message === 'string' ? error.message : '';
    if (
      message.includes('sales_orders_order_number_key') ||
      message.includes('orderNumber') ||
      message.includes('order_number')
    ) {
      return true;
    }

    const meta = (error.meta ?? {}) as Record<string, unknown>;
    const target = meta.target;
    if (Array.isArray(target) && target.includes('orderNumber')) {
      return true;
    }
    if (typeof target === 'string' && target.includes('orderNumber')) {
      return true;
    }

    const constraint = meta.constraint;
    if (
      typeof constraint === 'string' &&
      (constraint.includes('sales_orders_order_number_key') ||
        constraint.includes('orderNumber') ||
        constraint.includes('order_number'))
    ) {
      return true;
    }

    return false;
  }

  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('sales_orders_order_number_key') ||
    /unique constraint failed.*orderNumber/i.test(message) ||
    /UNIQUE constraint failed.*sales_orders.*orderNumber/i.test(message) ||
    /duplicate key.*orderNumber/i.test(message)
  );
}

function isRetryableSalesOrderCreateConflict(error: unknown) {
  if (error instanceof PrismaClient.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const code = typeof maybeError.code === 'string' ? maybeError.code : '';
  const message =
    typeof maybeError.message === 'string'
      ? maybeError.message
      : error instanceof Error
        ? error.message
        : '';

  return code === 'P2034' || /(write conflict|deadlock)/i.test(message);
}

export async function createSalesOrder(data: CreateInput, userId: string) {
  const validatedData = salesOrderCreateSchema.parse(data);
  const transferMode = normalizeTransferMode(validatedData);
  const financials = calculateFinancials(validatedData, transferMode);
  const sampleSettlementType =
    validatedData.sampleSettlementType ?? DEFAULT_SAMPLE_SETTLEMENT_TYPE;
  const resolvedOrderDate =
    parseLocalDateString(validatedData.orderDate) ?? new Date();

  const maxCreateRetries = 10;
  let attempt = 0;
  let order: CreatedOrderResult | undefined;

  while (!order) {
    const orderNumber = await generateSalesOrderNumber();

    try {
      order = await prisma.$transaction(async tx => {
        await ensureCustomerExists(tx, validatedData.customerId);
        await ensureSupplierExists(tx, validatedData.supplierId);
        await ensureProductsExist(tx, validatedData.items);

        // 处理临时产品：为调货销售的手动输入产品创建/查找临时产品记录
        const temporaryProductIds = new Map<number, string>(); // itemIndex -> temporaryProductId

        if (
          validatedData.orderType === 'TRANSFER' &&
          validatedData.supplierId
        ) {
          for (let i = 0; i < validatedData.items.length; i++) {
            const item = validatedData.items[i];
            const tempProductData = buildTemporaryProductDataFromOrderItem(
              item,
              validatedData.supplierId,
              userId
            );

            if (tempProductData) {
              const tempProduct = await findOrCreateTemporaryProduct(
                tx,
                tempProductData
              );
              temporaryProductIds.set(i, tempProduct.id);
            }
          }
        }

        const salesOrder = await tx.salesOrder.create({
          data: {
            orderNumber,
            customerId: validatedData.customerId,
            userId,
            supplierId: validatedData.supplierId,
            status: validatedData.status || 'draft',
            orderType: validatedData.orderType,
            transferMode,
            orderDate: resolvedOrderDate,
            isSampleOrder: validatedData.isSampleOrder ?? false,
            sampleSettlementType,
            costAmount: financials.costAmount,
            profitAmount: financials.profitAmount,
            itemsAmount: financials.itemsAmount,
            additionalFees: financials.additionalFees,
            expenseAmount: financials.expenseAmount,
            roundingAdjustment: financials.roundingAdjustment,
            totalAmount: financials.totalAmount,
            remarks: validatedData.remarks,
            items: {
              create: buildOrderItemsInput(
                validatedData,
                transferMode,
                temporaryProductIds
              ),
            },
            feeItems: {
              create: buildFeeItemsInput(validatedData),
            },
          },
          select: createSelect,
        });

        if (shouldReserveInventory(validatedData, transferMode)) {
          const reservationInput = {
            ...validatedData,
            items: salesOrder.items.map(item => ({
              id: item.id,
              productId: item.productId ?? undefined,
              variantId: item.variantId ?? undefined,
              batchNumber: item.batchNumber ?? undefined,
              colorCode: item.colorCode ?? undefined,
              productionDate: item.productionDate ?? undefined,
              quantity: Number(item.quantity ?? 0),
              localQuantity: Number(item.localQuantity ?? 0),
              isManualProduct: Boolean(item.isManualProduct),
            })),
          };

          const reservations = await reserveInventory(
            tx,
            reservationInput as any,
            transferMode
          );

          const itemsById = new Map(
            salesOrder.items.map(item => [item.id, item])
          );
          for (const reservation of reservations) {
            if (!reservation.salesOrderItemId) {
              continue;
            }

            const orderItem = itemsById.get(reservation.salesOrderItemId);
            if (!orderItem) {
              continue;
            }

            const updateData: {
              variantId?: string | null;
              batchNumber?: string | null;
            } = {};

            if (!orderItem.variantId && reservation.variantId) {
              updateData.variantId = reservation.variantId;
            }

            const existingBatchNumber = (orderItem.batchNumber ?? '').trim();
            const reservedBatchNumber = (reservation.batchNumber ?? '').trim();
            if (
              existingBatchNumber.length === 0 &&
              reservedBatchNumber.length > 0
            ) {
              updateData.batchNumber = reservedBatchNumber;
            }

            if (Object.keys(updateData).length > 0) {
              await tx.salesOrderItem.update({
                where: { id: orderItem.id },
                data: updateData,
              });

              if (updateData.variantId) {
                orderItem.variantId = updateData.variantId;
              }
              if (updateData.batchNumber) {
                orderItem.batchNumber = updateData.batchNumber;
              }
            }
          }
        }

        // 阶段2：自动创建公司承担费用的 ExpenseRecord（幂等，必须成功）
        if (
          env.EXPENSE_AUTO_CREATE &&
          validatedData.feeItems &&
          validatedData.feeItems.length > 0
        ) {
          try {
            await ensureCompanyExpenses({
              tx,
              sourceType: 'sales_order',
              sourceId: salesOrder.id,
              sourceNumber: salesOrder.orderNumber,
              userId,
              supplierId: validatedData.supplierId ?? null,
              feeItems: validatedData.feeItems,
            });
          } catch (e) {
            logger.error(
              'sales-orders',
              '自动创建费用记录失败，将回滚订单事务',
              e,
              {
                orderId: salesOrder.id,
                orderNumber: salesOrder.orderNumber,
              }
            );
            // 费用台账是利润报表的唯一真源，这里必须失败即回滚，避免订单创建成功但费用缺失
            throw e;
          }
        }

        await recordCustomerPriceHistory(tx, validatedData, salesOrder.id);
        await maybeCreatePayable(
          tx,
          validatedData,
          financials.costAmount,
          userId,
          {
            id: salesOrder.id,
            orderNumber: salesOrder.orderNumber,
          }
        );

        // 客户直发订单自动创建采购订单
        if (
          validatedData.orderType === 'TRANSFER' &&
          transferMode === 'SUPPLIER_ONLY' &&
          validatedData.status === 'confirmed' &&
          validatedData.supplierId &&
          financials.costAmount > 0
        ) {
          try {
            await createPurchaseOrderForTransfer(
              tx,
              {
                ...validatedData,
                // ✅ 后端统一真源：采购总额应使用本次计算出的成本汇总，而非依赖前端传入
                costAmount: financials.costAmount,
              },
              salesOrder,
              userId
            );
          } catch (error) {
            logger.error('sales-orders', '创建采购订单失败', error, {
              salesOrderId: salesOrder.id,
              salesOrderNumber: salesOrder.orderNumber,
            });
            // 调货直发订单必须成功创建采购订单，否则会造成事务不一致（订单已确认但缺采购单）
            throw new Error('创建采购订单失败，已回滚订单创建，请重试');
          }
        }

        const roundedTotalAmount = Number(
          Number(financials.totalAmount ?? 0).toFixed(2)
        );
        const roundedRoundingAmount = Number(
          Number(financials.roundingAdjustment ?? 0).toFixed(2)
        );
        const receivableEnabled = shouldCreateReceivableForOrder({
          isSampleOrder: salesOrder.isSampleOrder,
          sampleSettlementType: salesOrder.sampleSettlementType,
        });
        const actualOrderDue = getSalesOrderReceivableTotal({
          isSampleOrder: salesOrder.isSampleOrder,
          sampleSettlementType: salesOrder.sampleSettlementType,
          totalAmount: roundedTotalAmount,
          roundingAdjustment: roundedRoundingAmount,
        });

        if (
          salesOrder.status === 'confirmed' &&
          receivableEnabled &&
          actualOrderDue > 0
        ) {
          const paymentNumber = await generatePaymentNumber(tx);
          const paymentAmount = roundedTotalAmount;
          await tx.paymentRecord.create({
            data: {
              paymentNumber,
              salesOrderId: salesOrder.id,
              customerId: salesOrder.customerId,
              userId,
              paymentType: 'order_payment',
              paymentMethod: 'cash',
              paymentAmount,
              actualPaymentAmount: 0,
              roundingAmount: roundedRoundingAmount,
              appliedAmount: 0,
              paymentDate: new Date(),
              status: 'pending',
              remarks: `系统自动生成：销售订单 ${salesOrder.orderNumber} 确认应收`,
            },
          });
        }

        if (
          validatedData.usePrepayment &&
          receivableEnabled &&
          actualOrderDue > 0
        ) {
          const prepaymentResult = await applyPrepaymentToOrder(
            tx,
            validatedData.customerId,
            salesOrder.id,
            actualOrderDue,
            validatedData.prepaymentAmount ?? undefined
          );

          if (prepaymentResult.totalApplied > 0) {
            await tx.salesOrder.update({
              where: { id: salesOrder.id },
              data: {
                paidAmount: prepaymentResult.totalApplied,
              },
            });

            salesOrder.paidAmount = new PrismaClient.Decimal(
              prepaymentResult.totalApplied
            );
          }
        }

        return salesOrder;
      }, getLongTransactionOptions());
    } catch (error) {
      attempt += 1;
      const isOrderNumberConflict =
        isSalesOrderOrderNumberUniqueConstraintError(error);
      const isRetryableTransactionConflict =
        isRetryableSalesOrderCreateConflict(error);

      if (
        attempt >= maxCreateRetries ||
        (!isOrderNumberConflict && !isRetryableTransactionConflict)
      ) {
        throw error;
      }

      const delayMs = isRetryableTransactionConflict
        ? Math.min(400, 50 * 2 ** (attempt - 1))
        : Math.min(300, 50 * attempt);
      logger.warn(
        'sales-orders',
        isRetryableTransactionConflict
          ? '销售订单创建遇到事务写冲突，准备重试'
          : '销售订单号冲突，准备重试创建订单',
        undefined,
        {
          attempt,
          delayMs,
          retryReason: isRetryableTransactionConflict
            ? 'transaction_conflict'
            : 'order_number_conflict',
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : error,
        }
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  try {
    await executeInvalidation(ORDER_STATUS_CHANGE_INVALIDATION, {
      orderId: order.id,
      customerId: order.customerId,
    });
  } catch (error) {
    logger.error('sales-orders', '缓存失效失败', error, {
      orderId: order.id,
      customerId: order.customerId,
    });
  }

  const ledgerEligibleStatuses = new Set(['confirmed', 'shipped', 'completed']);
  const totalAmount = Number(order.totalAmount ?? 0);
  const roundingAdjustment = toNumber(
    (order as { roundingAdjustment?: unknown }).roundingAdjustment,
    0
  );
  const actualOrderDue = getSalesOrderReceivableTotal({
    isSampleOrder: order.isSampleOrder,
    sampleSettlementType:
      order.sampleSettlementType ?? DEFAULT_SAMPLE_SETTLEMENT_TYPE,
    totalAmount,
    roundingAdjustment,
  });

  if (ledgerEligibleStatuses.has(order.status) && actualOrderDue > 0) {
    try {
      await recordPartnerTransaction({
        partnerId: order.customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: actualOrderDue,
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        description: `销售订单 ${order.orderNumber} 创建并已确认`,
        userId: order.userId,
        occurredAt: order.orderDate,
        metadata: {
          status: order.status,
          triggeredBy: 'order:create',
        },
      });
    } catch (error) {
      logger.error('sales-orders', '记录往来账失败', error, {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }

  // 手动获取产品信息
  const productIds = order.items
    .map(item => item.productId)
    .filter(Boolean) as string[];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
    take: productIds.length,
  });

  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >(
    products.map(p => [
      p.id,
      {
        ...p,
        weight: p.weight === null ? null : Number(p.weight),
      },
    ])
  );

  return mapCreatedOrder(order, productsMap);
}
