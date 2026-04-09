/**
 * 销售订单状态更新处理器
 * 包含幂等性保护和乐观锁机制
 * 遵循全局约定规范和唯一真理原则
 */

import type { Prisma } from '@prisma/client';

import {
  reserveInventory,
  shouldReserveInventory,
} from '@/lib/api/handlers/sales-orders/inventory';
import { prisma, withTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  consumeFIFOQueueByBatch,
  ensureFIFOQueueMatchesInventory,
} from '@/lib/services/fifo-cost-service';
import { runWithFifoTransactionRetry } from '@/lib/services/fifo-transaction-retry';
import {
  generateUniqueOrderNumber,
  type OrderNumberConfig,
} from '@/lib/services/order-number-generator';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { roundCostPrice } from '@/lib/utils/cost-price';
import { findAvailableInventory } from '@/lib/utils/inventory-variant-mapper';
import { toNumber } from '@/lib/utils/number';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';

/**
 * 出库单号配置
 */
const OUTBOUND_RECORD_CONFIG: OrderNumberConfig = {
  prefix: 'OB',
  numberLength: 4,
  sequenceType: 'outbound_record',
};

const ORDER_STATUS_TRANSACTION_OPTIONS = {
  timeout: 20_000,
  maxWait: 5_000,
} as const;

/**
 * 扩展的销售订单明细类型(包含库存查询所需字段)
 */
interface _SalesOrderItemWithInventoryFields {
  id: string;
  salesOrderId: string;
  productId: string | null;
  colorCode: string | null;
  productionDate: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unitCost?: number | null;
  product?: {
    id: string;
    name: string;
  } | null;
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const appendRemarks = (
  existing: string | null | undefined,
  addition: string
) =>
  existing && existing.trim().length > 0
    ? `${existing}\n${addition}`
    : addition;

const calculateCompanyExpenseFromFees = (
  feeItems:
    | Array<{ feeAmount?: unknown; paidBy?: string | null | undefined }>
    | undefined
): number => {
  if (!feeItems || feeItems.length === 0) {
    return 0;
  }

  const total = feeItems.reduce((sum, fee) => {
    if ((fee.paidBy ?? 'customer') !== 'company') {
      return sum;
    }

    const amount = fee.feeAmount !== undefined ? Number(fee.feeAmount) : 0;
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);

  return roundCurrency(total);
};

const getCompanyExpenseAmount = (params: {
  expenseAmount?: unknown;
  feeItems?:
    | Array<{ feeAmount?: unknown; paidBy?: string | null | undefined }>
    | undefined;
}) => {
  const fromFees = calculateCompanyExpenseFromFees(params.feeItems);
  if (fromFees > 0 || (params.feeItems?.length ?? 0) > 0) {
    return fromFees;
  }
  const stored =
    params.expenseAmount !== undefined ? Number(params.expenseAmount) : 0;
  return roundCurrency(Number.isFinite(stored) ? stored : 0);
};

const allocateExpensesBySalesValue = (
  items: Array<{ id: string; subtotal?: number | null }>,
  totalExpense: number
) => {
  const allocations = new Map<string, number>();
  if (!items.length || totalExpense <= 0) {
    return allocations;
  }

  const normalizedTotals = items.map(item => ({
    id: item.id,
    subtotal: Math.max(0, Number(item.subtotal ?? 0)),
  }));

  const totalValue = normalizedTotals.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );

  if (totalValue === 0) {
    const evenShare = roundCurrency(totalExpense / items.length);
    let allocated = 0;
    normalizedTotals.forEach((item, index) => {
      const value =
        index === normalizedTotals.length - 1
          ? roundCurrency(totalExpense - allocated)
          : evenShare;
      allocations.set(item.id, value);
      allocated += value;
    });
    return allocations;
  }

  let allocated = 0;
  normalizedTotals.forEach((item, index) => {
    const ratio = item.subtotal / totalValue;
    const value =
      index === normalizedTotals.length - 1
        ? roundCurrency(totalExpense - allocated)
        : roundCurrency(totalExpense * ratio);
    allocations.set(item.id, value);
    allocated += value;
  });

  return allocations;
};

/**
 * 订单状态更新结果
 */
export interface OrderStatusUpdateResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    remarks?: string | null;
  };
  inventoryUpdated: boolean;
  reservedInventoryReleased: boolean;
}

type SalesOrderStatusTransactionClient = Prisma.TransactionClient;

type ReservableSalesOrder = {
  orderType: string | null;
  transferMode: string | null;
  items: Array<{
    productId: string | null;
    variantId: string | null;
    batchNumber: string | null;
    quantity: unknown;
    localQuantity: unknown;
    isManualProduct: boolean | null;
  }>;
};

async function releaseReservedInventoryForConfirmedOrder(
  tx: SalesOrderStatusTransactionClient,
  orderId: string,
  order: ReservableSalesOrder
) {
  let releasedAny = false;

  const transferMode =
    order.orderType === 'TRANSFER'
      ? ((order.transferMode ?? 'SUPPLIER_ONLY') as
          | 'SUPPLIER_ONLY'
          | 'MIXED')
      : 'SUPPLIER_ONLY';

  const shouldReleaseReserved =
    order.orderType !== 'TRANSFER' || transferMode === 'MIXED';

  if (!shouldReleaseReserved) {
    return releasedAny;
  }

  const releaseByKey = new Map<
    string,
    {
      productId: string;
      variantId: string | null;
      batchNumber: string | null;
      quantity: number;
    }
  >();

  for (const item of order.items) {
    if (!item.productId || item.isManualProduct) {
      continue;
    }

    const itemReservedQuantity =
      order.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? Number(item.localQuantity ?? 0)
        : Number(item.quantity ?? 0);

    if (itemReservedQuantity <= 0) {
      continue;
    }

    const variantId = item.variantId ?? null;
    const batchNumber = (item.batchNumber ?? '').trim() || null;
    const key = `${item.productId}::${variantId ?? ''}::${batchNumber ?? ''}`;

    const existing = releaseByKey.get(key);
    if (existing) {
      existing.quantity += itemReservedQuantity;
      continue;
    }

    releaseByKey.set(key, {
      productId: item.productId,
      variantId,
      batchNumber,
      quantity: itemReservedQuantity,
    });
  }

  for (const release of releaseByKey.values()) {
    const inventory = await tx.inventory.findFirst({
      where: {
        productId: release.productId,
        variantId: release.variantId,
        batchNumber: release.batchNumber,
      },
      select: {
        id: true,
      },
    });

    if (!inventory) {
      throw new Error(
        `库存记录不存在，无法释放预留量: productId=${release.productId}, variantId=${release.variantId ?? 'null'}, batchNumber=${release.batchNumber ?? 'null'}`
      );
    }

    const releaseQty = Number(release.quantity ?? 0);
    if (releaseQty <= 0) {
      continue;
    }

    let updateResult = await tx.inventory.updateMany({
      where: {
        id: inventory.id,
        reservedQuantity: { gte: releaseQty },
      },
      data: {
        reservedQuantity: { decrement: releaseQty },
      },
    });

    if (updateResult.count > 0) {
      releasedAny = true;
      continue;
    }

    const lockedRows = (await tx.$queryRaw`
      SELECT id, reserved_quantity
      FROM inventory
      WHERE id = ${inventory.id}
      FOR UPDATE
    `) as Array<{ id: string; reserved_quantity: number }>;

    const latestReserved = Number(lockedRows?.[0]?.reserved_quantity ?? 0);

    if (latestReserved <= 0) {
      logger.info('inventory-release', 'ALREADY_RELEASED', {
        orderId,
        reason: 'ALREADY_RELEASED',
        latestReserved,
      });
      continue;
    }

    if (latestReserved < releaseQty) {
      const shortage = releaseQty - latestReserved;

      logger.error(
        'inventory-release',
        'RESERVED_INSUFFICIENT',
        undefined,
        { orderId, inventoryId: inventory.id },
        {
          releaseQty,
          latestReserved,
          shortage,
          reason: 'RESERVED_INSUFFICIENT',
          action: 'ALERT_FOR_RECONCILIATION',
        }
      );

      updateResult = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          reservedQuantity: { gte: latestReserved },
        },
        data: {
          reservedQuantity: { decrement: latestReserved },
        },
      });

      if (updateResult.count > 0) {
        releasedAny = true;
        logger.warn('inventory-release', 'PARTIAL_RELEASE', {
          expectedRelease: releaseQty,
          actualRelease: latestReserved,
          reason: 'PARTIAL_RELEASE_DUE_TO_INSUFFICIENT',
        });
      }

      continue;
    }

    updateResult = await tx.inventory.updateMany({
      where: {
        id: inventory.id,
        reservedQuantity: { gte: releaseQty },
      },
      data: {
        reservedQuantity: { decrement: releaseQty },
      },
    });

    if (updateResult.count === 0) {
      throw new Error(`释放预留库存失败, 请重试: inventoryId=${inventory.id}`);
    }

    releasedAny = true;
  }

  return releasedAny;
}

async function closePendingOrderReceivables(
  tx: SalesOrderStatusTransactionClient,
  orderId: string,
  actionLabel: '取消' | '撤回确认',
  remarks?: string
) {
  const actionRemark =
    remarks && remarks.trim().length > 0
      ? `订单${actionLabel}原因：${remarks.trim()}`
      : `系统自动标记：销售订单${actionLabel}关闭应收款`;

  await tx.paymentRecord.updateMany({
    where: {
      salesOrderId: orderId,
      paymentType: 'order_payment',
      status: 'pending',
    },
    data: {
      status: 'cancelled',
      remarks: actionRemark,
    },
  });
}

async function reverseSalesOrderReceivableLedger(
  tx: SalesOrderStatusTransactionClient,
  params: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    due: number;
    userId: string;
    transactionType: 'sale_reversal' | 'order_cancellation';
    description: string;
    status: 'draft' | 'cancelled';
    triggeredBy: 'order:withdraw-confirmation' | 'order:cancel';
  }
) {
  if (params.due <= 0) {
    return;
  }

  const hasSaleLedger = await tx.statementTransaction.findFirst({
    where: {
      referenceId: params.orderId,
      transactionType: 'sale',
    },
    select: { id: true },
  });

  if (!hasSaleLedger) {
    logger.warn(
      'sales-order-status',
      `跳过销售${params.status === 'draft' ? '撤回确认' : '取消'}冲回应收：未找到原始销售台账`,
      {
        orderId: params.orderId,
        orderNumber: params.orderNumber,
      }
    );
    return;
  }

  await recordPartnerTransaction(
    {
      partnerId: params.customerId,
      partnerRole: 'customer',
      entityType: 'customer',
      transactionType: params.transactionType,
      amount: params.due,
      referenceId: params.orderId,
      referenceNumber: params.orderNumber,
      description: params.description,
      userId: params.userId,
      occurredAt: new Date(),
      metadata: {
        status: params.status,
        triggeredBy: params.triggeredBy,
      },
    },
    tx
  );
}

async function executeOrderConfirmation(
  orderId: string,
  remarks?: string,
  operatorId?: string
): Promise<OrderStatusUpdateResult> {
  return withTransaction(async tx => {
    const existingOrder = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      throw new Error('销售订单不存在');
    }

    if (existingOrder.status !== 'draft') {
      throw new Error('只有草稿状态的订单才能确认');
    }

    if (
      !Array.isArray(existingOrder.items) ||
      existingOrder.items.length === 0
    ) {
      throw new Error('至少需要一个订单项才能确认订单');
    }

    if (existingOrder.orderType === 'TRANSFER' && !existingOrder.supplierId) {
      throw new Error('调货销售确认时必须选择供应商');
    }

    for (const item of existingOrder.items) {
      if (item.isManualProduct) {
        continue;
      }
      if (!item.productId) {
        throw new Error('订单明细缺少产品信息，无法确认订单');
      }
    }

    const transferMode =
      existingOrder.orderType === 'TRANSFER'
        ? ((existingOrder.transferMode ?? 'SUPPLIER_ONLY') as
            | 'SUPPLIER_ONLY'
            | 'MIXED')
        : 'SUPPLIER_ONLY';

    const reservationInput = {
      customerId: existingOrder.customerId,
      status: 'confirmed',
      orderType: (existingOrder.orderType ?? 'NORMAL') as 'NORMAL' | 'TRANSFER',
      transferMode,
      supplierId: existingOrder.supplierId ?? undefined,
      items: existingOrder.items.map(item => ({
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

    let inventoryUpdated = false;
    if (shouldReserveInventory(reservationInput as any, transferMode)) {
      const reservations = await reserveInventory(
        tx,
        reservationInput as any,
        transferMode
      );

      const itemsById = new Map(
        existingOrder.items.map(item => [item.id, item])
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
        }
      }

      inventoryUpdated = reservations.length > 0;
    }

    const updateResult = await tx.salesOrder.updateMany({
      where: { id: orderId, status: 'draft' },
      data: {
        status: 'confirmed',
        ...(remarks !== undefined && { remarks }),
      },
    });

    if (updateResult.count === 0) {
      throw new Error('订单状态已变更，请刷新后重试');
    }

    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    if (!order) {
      throw new Error('销售订单不存在');
    }

    // ✅ 确认即生成“应收待收”记录（若不存在），保持与“创建即确认”口径一致
    const totalAmount = Number(existingOrder.totalAmount ?? 0);
    const roundingAdjustment = toNumber(existingOrder.roundingAdjustment);
    const actualOrderDue = getSalesOrderReceivableTotal({
      isSampleOrder: existingOrder.isSampleOrder,
      sampleSettlementType: existingOrder.sampleSettlementType,
      totalAmount,
      roundingAdjustment,
    });

    if (actualOrderDue > 0) {
      const paymentExists = await tx.paymentRecord.findFirst({
        where: {
          salesOrderId: orderId,
          paymentType: 'order_payment',
          status: { in: ['pending', 'confirmed'] },
        },
        select: { id: true },
      });

      if (!paymentExists) {
        const paymentNumber = await generatePaymentNumber(tx);
        const finalOperatorId = operatorId || existingOrder.userId;
        await tx.paymentRecord.create({
          data: {
            paymentNumber,
            salesOrderId: orderId,
            customerId: existingOrder.customerId,
            userId: finalOperatorId,
            paymentType: 'order_payment',
            paymentMethod: 'cash',
            paymentAmount: Number(totalAmount.toFixed(2)),
            actualPaymentAmount: 0,
            roundingAmount: Number(roundingAdjustment.toFixed(2)),
            appliedAmount: 0,
            paymentDate: existingOrder.orderDate ?? new Date(),
            status: 'pending',
            remarks: `系统自动生成：销售订单 ${order.orderNumber} 确认应收`,
          },
        });
      }
    }

    return {
      order,
      inventoryUpdated,
      reservedInventoryReleased: false,
    };
  }, ORDER_STATUS_TRANSACTION_OPTIONS);
}

/**
 * 执行订单状态更新(带库存扣减和出库记录)
 * 使用乐观锁防止并发超卖
 */
async function executeOrderStatusUpdateWithInventory(
  orderId: string,
  status: string,
  remarks?: string,
  operatorId?: string
): Promise<OrderStatusUpdateResult> {
  // 先查询订单信息
  const existingOrder = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
            },
          },
        },
      },
      feeItems: {
        select: {
          id: true,
          feeAmount: true,
          paidBy: true,
        },
      },
    },
  });

  if (!existingOrder) {
    throw new Error('销售订单不存在');
  }

  // 如果没有提供操作员ID,使用订单创建人ID
  const finalOperatorId = operatorId || existingOrder.userId;

  const transferMode =
    existingOrder.orderType === 'TRANSFER'
      ? ((existingOrder.transferMode ?? 'SUPPLIER_ONLY') as
          | 'SUPPLIER_ONLY'
          | 'MIXED')
      : 'SUPPLIER_ONLY';

  // 预先收集需要扣减库存的产品，调货/临时产品会在后续逻辑中跳过
  type SalesOrderItemEntity = (typeof existingOrder.items)[0];
  type TransferReason =
    | 'MANUAL_PRODUCT'
    | 'TEMPORARY_PRODUCT'
    | 'TRANSFER_ORDER';

  const resolveTransferReason = (
    item: SalesOrderItemEntity
  ): TransferReason | null => {
    if (item.isManualProduct) {
      return 'MANUAL_PRODUCT';
    }
    const temporaryProductId = (
      item as {
        temporaryProductId?: string | null;
      }
    ).temporaryProductId;
    if (temporaryProductId) {
      return 'TEMPORARY_PRODUCT';
    }
    if (existingOrder.orderType === 'TRANSFER' && transferMode !== 'MIXED') {
      return 'TRANSFER_ORDER';
    }
    return null;
  };

  const itemsWithInventory: Array<{
    item: SalesOrderItemEntity;
    productId: string;
    transferReason: TransferReason | null;
    outboundQuantity: number;
  }> = [];

  for (const item of existingOrder.items) {
    const transferReason = resolveTransferReason(item);
    const productId = item.productId;
    if (!productId) {
      if (transferReason) {
        logger.info('sales-order-status', '跳过调货产品库存扣减', {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          salesOrderItemId: item.id,
          reason: transferReason,
          detail: '无产品ID，无法扣减库存',
        });
      }
      continue; // 跳过没有产品ID的手动输入产品
    }

    itemsWithInventory.push({
      item,
      productId,
      transferReason,
      outboundQuantity:
        transferReason !== null
          ? 0
          : existingOrder.orderType === 'TRANSFER' && transferMode === 'MIXED'
            ? Number(item.localQuantity ?? 0)
            : Number(item.quantity ?? 0),
    });
  }

  const companyExpenseAmount = getCompanyExpenseAmount(existingOrder);
  const allocationSources =
    itemsWithInventory.length > 0
      ? itemsWithInventory.map(entry => entry.item)
      : existingOrder.items;
  const expenseAllocations =
    companyExpenseAmount > 0
      ? allocateExpensesBySalesValue(
          allocationSources.map(item => ({
            id: item.id,
            subtotal: toNumber(item.subtotal),
          })),
          companyExpenseAmount
        )
      : new Map<string, number>();

  return await runWithFifoTransactionRetry({
    actionLabel: '销售订单发货',
    moduleName: 'sales-order-status',
    operation: () =>
      withTransaction(async tx => {
        // 第一步：先检查所有产品的库存，收集库存不足的信息
        const insufficientStockItems: Array<{
          productCode: string;
          productName: string;
          colorInfo: string;
          availableQty: number;
          requiredQty: number;
          shortage: number;
          unit: string;
          batchNumber: string;
          location: string;
        }> = [];

        const inventoryChecks: Array<{
          item: (typeof existingOrder.items)[0];
          productId: string;
          outboundQuantity: number;
          inventory: NonNullable<
            Awaited<ReturnType<typeof findAvailableInventory>>
          >;
        }> = [];

        for (const {
          item,
          productId,
          transferReason,
          outboundQuantity,
        } of itemsWithInventory) {
          if (transferReason) {
            logger.info('sales-order-status', '跳过调货产品库存扣减', {
              orderId: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              salesOrderItemId: item.id,
              reason: transferReason,
            });
            continue;
          }

          if (outboundQuantity <= 0) {
            // 调货混合模式中，本地发货数量为 0 的明细不需要扣减库存
            continue;
          }

          // 使用类型安全的库存查找（支持变体和批次映射）
          const inventory = await findAvailableInventory(
            productId,
            outboundQuantity,
            {
              colorCode: item.colorCode,
              // 优先按销售订单明细中选择的批次号匹配库存；
              // 只有在没有批次号时，才退回到按生产日期推导批次
              batchNumber: item.batchNumber,
              productionDate: item.productionDate,
              tx,
            }
          );

          if (!inventory) {
            const existingInventory = await findAvailableInventory(
              productId,
              0,
              {
                colorCode: item.colorCode,
                batchNumber: item.batchNumber,
                productionDate: item.productionDate,
                tx,
              }
            );

            const productCode = item.product?.code || '未知编码';
            const productName = item.product?.name || '未知产品';
            const colorInfo = item.colorCode
              ? ` (色号: ${item.colorCode})`
              : '';
            // 系统内部统一使用"片"作为单位，因为库存和订单数量都是以片为单位存储的
            const unitLabel = '片';
            const derivedBatch =
              item.batchNumber ||
              existingInventory?.batchNumber ||
              (item.productionDate ? item.productionDate : null) ||
              '未设置';
            const resolvedLocation = existingInventory?.location || '未设置';

            if (!existingInventory) {
              throw new Error(
                `产品 [${productCode}] ${productName}${colorInfo} 在仓库中尚未建立库存记录，请先入库或同步库存后再发货`
              );
            }

            const availableQty = existingInventory.quantity;
            const shortage = Math.max(0, outboundQuantity - availableQty);

            insufficientStockItems.push({
              productCode,
              productName,
              colorInfo,
              availableQty,
              requiredQty: outboundQuantity,
              shortage,
              unit: unitLabel,
              batchNumber: derivedBatch,
              location: resolvedLocation,
            });
            continue;
          }

          // ✅ 发货扣减：确认单本身已预留，因此这里校验“预留量足够本次发货”
          if (inventory.reservedQuantity < outboundQuantity) {
            const productCode = item.product?.code || '未知编码';
            const productName = item.product?.name || '未知产品';
            const colorInfo = item.colorCode
              ? ` (色号: ${item.colorCode})`
              : '';
            throw new Error(
              `产品 [${productCode}] ${productName}${colorInfo} 预留库存不足（当前预留：${inventory.reservedQuantity}片，本次发货：${outboundQuantity}片），请刷新后重试`
            );
          }

          // 库存充足，保存检查结果用于后续更新
          inventoryChecks.push({
            item,
            productId,
            outboundQuantity,
            inventory,
          });
        }

        // 如果有库存不足的产品，抛出详细的错误信息
        if (insufficientStockItems.length > 0) {
          const formatTraceInfo = (
            item: (typeof insufficientStockItems)[number]
          ) => `批次:${item.batchNumber} 位置:${item.location}`;

          if (insufficientStockItems.length === 1) {
            const item = insufficientStockItems[0];
            throw new Error(
              `产品 [${item.productCode}] ${item.productName}${item.colorInfo} 库存不足，当前库存：${item.availableQty}${item.unit}，需要：${item.requiredQty}${item.unit}，缺少：${item.shortage}${item.unit}（${formatTraceInfo(item)}）`
            );
          } else {
            const errorMessages = insufficientStockItems.map(
              item =>
                `- [${item.productCode}] ${item.productName}${item.colorInfo}：当前库存 ${item.availableQty}${item.unit}，需要 ${item.requiredQty}${item.unit}，缺少 ${item.shortage}${item.unit}（${formatTraceInfo(item)}）`
            );
            throw new Error(
              `以下 ${insufficientStockItems.length} 个产品库存不足：\n${errorMessages.join('\n')}`
            );
          }
        }

        // 第二步：更新库存并创建出库记录 - 使用乐观锁 + FIFO成本
        // 同时收集最新的明细成本, 便于后续回写订单级成本/利润字段
        const updatedItemCosts = new Map<string, number>();

        const isMixedTransferOrder =
          existingOrder.orderType === 'TRANSFER' && transferMode === 'MIXED';

        for (const {
          item,
          productId,
          inventory,
          outboundQuantity,
        } of inventoryChecks) {
          const decrementReservedQty = outboundQuantity;

          // 使用乐观锁更新库存数量和预留量，确保并发安全
          const updatedCount = await tx.inventory.updateMany({
            where: {
              id: inventory.id,
              updatedAt: inventory.updatedAt,
              quantity: { gte: outboundQuantity }, // 再次确认库存足够
              reservedQuantity: { gte: decrementReservedQty },
            },
            data: {
              quantity: { decrement: outboundQuantity },
              reservedQuantity: { decrement: decrementReservedQty },
            },
          });

          if (updatedCount.count === 0) {
            throw new Error(
              `产品 ${item.product?.name || '未知产品'} 库存不足或已被其他订单占用,请重试`
            );
          }

          const itemQuantity = outboundQuantity;

          const unitCostHint = isMixedTransferOrder
            ? inventory.unitCost !== undefined && inventory.unitCost !== null
              ? Number(inventory.unitCost)
              : item.unitCost !== undefined && item.unitCost !== null
                ? Number(item.unitCost)
                : null
            : item.unitCost !== undefined && item.unitCost !== null
              ? Number(item.unitCost)
              : inventory.unitCost !== undefined && inventory.unitCost !== null
                ? Number(inventory.unitCost)
                : null;

          await ensureFIFOQueueMatchesInventory(
            {
              inventoryId: inventory.id,
              productId,
              variantId: inventory.variantId,
              batchNumber: inventory.batchNumber,
              expectedInventoryQty: inventory.quantity,
              unitCostHint,
              userId: finalOperatorId,
              source: `sales-order-outbound:${existingOrder.orderNumber}`,
            },
            tx
          );

          const fifoCost = await consumeFIFOQueueByBatch(
            productId,
            inventory.variantId,
            inventory.batchNumber,
            itemQuantity,
            tx
          );
          const baseTotalCost = roundCurrency(fifoCost.totalCost);
          const baseUnitCost =
            itemQuantity > 0
              ? roundCostPrice(fifoCost.totalCost / itemQuantity)
              : fifoCost.averageUnitCost;

          // 批次号真源：库存/订单显式批次号；生产日期仅用于匹配查找，不能写回/落库
          const finalBatchNumber =
            item.batchNumber || inventory.batchNumber || undefined;

          const outboundRecordNumber = await generateUniqueOrderNumber(
            OUTBOUND_RECORD_CONFIG,
            { tx }
          );

          const allocatedExpense = expenseAllocations.get(item.id) ?? 0;
          const localCostWithExpense =
            baseTotalCost !== undefined || allocatedExpense > 0
              ? roundCurrency((baseTotalCost ?? 0) + allocatedExpense)
              : undefined;
          const localUnitCostWithExpense =
            localCostWithExpense !== undefined && itemQuantity > 0
              ? roundCostPrice(localCostWithExpense / itemQuantity)
              : baseUnitCost;

          const transferQuantity = isMixedTransferOrder
            ? Number(item.transferQuantity ?? 0)
            : 0;
          const transferUnitCost =
            isMixedTransferOrder &&
            item.unitCost !== undefined &&
            item.unitCost !== null
              ? roundCostPrice(Number(item.unitCost))
              : 0;
          const transferCost =
            isMixedTransferOrder && transferQuantity > 0 && transferUnitCost > 0
              ? roundCurrency(transferQuantity * transferUnitCost)
              : 0;

          const totalCostWithExpense = isMixedTransferOrder
            ? baseTotalCost !== undefined ||
              transferCost > 0 ||
              allocatedExpense > 0
              ? roundCurrency(
                  (baseTotalCost ?? 0) + transferCost + allocatedExpense
                )
              : undefined
            : localCostWithExpense;

          // 创建出库记录（使用事务内生成的单号 + FIFO成本）
          const outboundReason = existingOrder.isSampleOrder
            ? 'sample_outbound'
            : 'sales_outbound';

          await tx.outboundRecord.create({
            data: {
              recordNumber: outboundRecordNumber,
              productId,
              variantId: inventory.variantId,
              batchNumber: finalBatchNumber,
              inventoryId: inventory.id,
              quantity: outboundQuantity,
              unitCost: localUnitCostWithExpense ?? undefined,
              totalCost: localCostWithExpense ?? undefined,
              reason: outboundReason,
              notes: `${existingOrder.isSampleOrder ? '样品单' : '销售订单'}发货：${existingOrder.orderNumber}`,
              customerId: existingOrder.customerId,
              salesOrderId: existingOrder.id,
              operatorId: finalOperatorId,
            },
          });

          // 将分配的费用和成本写回销售订单明细（利润仍按销售金额 - 成本计算）
          const itemSubtotal =
            item.subtotal === null || item.subtotal === undefined
              ? undefined
              : toNumber(item.subtotal);
          await tx.salesOrderItem.update({
            where: { id: item.id },
            data: {
              allocatedExpense,
              costSubtotal: totalCostWithExpense,
              ...(isMixedTransferOrder
                ? {}
                : { unitCost: localUnitCostWithExpense ?? undefined }),
              profitAmount:
                itemSubtotal !== undefined && totalCostWithExpense !== undefined
                  ? roundCurrency(itemSubtotal - (totalCostWithExpense ?? 0))
                  : undefined,
              profitMargin:
                itemSubtotal &&
                itemSubtotal > 0 &&
                totalCostWithExpense !== undefined
                  ? roundCurrency(
                      ((itemSubtotal - (totalCostWithExpense ?? 0)) /
                        itemSubtotal) *
                        100
                    )
                  : undefined,
            },
          });

          // 记录明细最新成本（含分摊费用），用于聚合到订单级成本
          const finalCostForItem =
            totalCostWithExpense !== undefined
              ? totalCostWithExpense
              : roundCurrency((baseTotalCost ?? 0) + transferCost);
          updatedItemCosts.set(item.id, finalCostForItem);
        }

        // 汇总最新成本, 以“明细成本汇总 = 订单成本”的口径回写订单级字段
        let aggregatedCostAmount = 0;
        existingOrder.items.forEach(item => {
          const updatedCost =
            updatedItemCosts.get(item.id) ??
            Number(item.costSubtotal ?? 0) ??
            0;
          aggregatedCostAmount += updatedCost;
        });
        aggregatedCostAmount = roundCurrency(aggregatedCostAmount);

        const itemsAmountValue =
          existingOrder.itemsAmount !== undefined &&
          existingOrder.itemsAmount !== null
            ? Number(existingOrder.itemsAmount)
            : existingOrder.items.reduce(
                (sum, item) => sum + Number(item.subtotal ?? 0),
                0
              );
        const normalizedExpenseAmount = roundCurrency(companyExpenseAmount);
        const updatedCostAmount = aggregatedCostAmount;
        const updatedProfitAmount =
          itemsAmountValue !== 0
            ? roundCurrency(itemsAmountValue - updatedCostAmount)
            : (existingOrder.profitAmount ?? undefined);

        // 第三步：更新订单状态（确保库存扣减成功后再标记发货）
        const orderUpdate = await tx.salesOrder.updateMany({
          where: { id: orderId, status: 'confirmed' },
          data: {
            status,
            ...(remarks !== undefined && { remarks }),
            ...(status === 'shipped' && { shippedAt: new Date() }),
            costAmount: updatedCostAmount,
            profitAmount: updatedProfitAmount,
            expenseAmount: normalizedExpenseAmount,
          },
        });

        if (orderUpdate.count === 0) {
          throw new Error('订单状态已变更，请刷新后重试');
        }

        const order = await tx.salesOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            remarks: true,
          },
        });

        if (!order) {
          throw new Error('销售订单不存在');
        }

        return {
          order,
          inventoryUpdated: inventoryChecks.length > 0,
          reservedInventoryReleased: false,
        };
      }, ORDER_STATUS_TRANSACTION_OPTIONS),
  });
}

async function executeOrderConfirmationWithdrawal(
  orderId: string,
  remarks?: string,
  operatorId?: string
): Promise<OrderStatusUpdateResult> {
  return withTransaction(async tx => {
    const existingOrder = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        payments: {
          where: {
            paymentType: 'order_payment',
            voidedAt: null,
          },
          select: {
            id: true,
            paymentNumber: true,
            status: true,
          },
        },
        prepaymentUsages: {
          select: {
            id: true,
          },
        },
        returnOrders: {
          where: {
            status: { not: 'cancelled' },
            voidedAt: null,
          },
          select: {
            id: true,
          },
        },
        outboundRecords: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!existingOrder) {
      throw new Error('销售订单不存在');
    }

    if (existingOrder.status !== 'confirmed') {
      throw new Error('只有已确认且未发货的订单才能撤回确认');
    }

    if (existingOrder.orderType === 'TRANSFER') {
      throw new Error('调货销售暂不支持撤回确认，请直接取消后重开');
    }

    if (existingOrder.outboundRecords.length > 0) {
      throw new Error('订单已生成发货/出库记录，不能撤回确认');
    }

    if (existingOrder.returnOrders.length > 0) {
      throw new Error('订单已发生退货，不能撤回确认');
    }

    const confirmedPayments = existingOrder.payments.filter(payment =>
      ['confirmed', 'applied'].includes(payment.status)
    );
    if (confirmedPayments.length > 0) {
      throw new Error('订单已存在收款记录，不能撤回确认');
    }

    const prepaymentAmount = toNumber(existingOrder.prepaymentAmount, 0);
    if (
      existingOrder.prepaymentUsages.length > 0 ||
      prepaymentAmount > 0.0001
    ) {
      throw new Error(
        '订单已使用预收款冲抵，不能撤回确认，请直接取消后重开'
      );
    }

    const updateResult = await tx.salesOrder.updateMany({
      where: { id: orderId, status: 'confirmed' },
      data: {
        status: 'draft',
        ...(remarks !== undefined && { remarks }),
      },
    });

    if (updateResult.count === 0) {
      throw new Error('订单状态已变更，请刷新后重试');
    }

    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    if (!order) {
      throw new Error('销售订单不存在');
    }

    const releasedAny = await releaseReservedInventoryForConfirmedOrder(
      tx,
      orderId,
      existingOrder
    );

    await closePendingOrderReceivables(tx, orderId, '撤回确认', remarks);

    const finalOperatorId = operatorId || existingOrder.userId;
    const totalAmount = toNumber(existingOrder.totalAmount, 0);
    const roundingAdjustment = toNumber(existingOrder.roundingAdjustment, 0);
    const due = getSalesOrderReceivableTotal({
      isSampleOrder: existingOrder.isSampleOrder,
      sampleSettlementType: existingOrder.sampleSettlementType,
      totalAmount,
      roundingAdjustment,
    });

    await reverseSalesOrderReceivableLedger(tx, {
      orderId,
      orderNumber: existingOrder.orderNumber,
      customerId: existingOrder.customerId,
      due,
      userId: finalOperatorId,
      transactionType: 'sale_reversal',
      description: `销售订单 ${existingOrder.orderNumber} 撤回确认冲回应收`,
      status: 'draft',
      triggeredBy: 'order:withdraw-confirmation',
    });

    return {
      order,
      inventoryUpdated: false,
      reservedInventoryReleased: releasedAny,
    };
  }, ORDER_STATUS_TRANSACTION_OPTIONS);
}

/**
 * 执行订单取消(释放预留库存)
 */
async function executeOrderCancellation(
  orderId: string,
  remarks?: string,
  operatorId?: string
): Promise<OrderStatusUpdateResult> {
  return await withTransaction(async tx => {
    // 在事务内读取订单与明细，避免使用过期快照导致预留释放不完整
    const existingOrder = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!existingOrder) {
      throw new Error('销售订单不存在');
    }

    const finalOperatorId = operatorId || existingOrder.userId;
    const linkedPayables =
      existingOrder.orderType === 'TRANSFER'
        ? await tx.payableRecord.findMany({
            where: {
              sourceType: 'sales_order',
              sourceId: orderId,
            },
            select: {
              id: true,
              payableNumber: true,
              supplierId: true,
              payableAmount: true,
              paidAmount: true,
              remainingAmount: true,
              dueDate: true,
              status: true,
              remarks: true,
              paymentOutRecords: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          })
        : [];
    const linkedPurchaseOrders =
      existingOrder.orderType === 'TRANSFER'
        ? await tx.purchaseOrder.findMany({
            where: {
              salesOrderId: orderId,
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              remarks: true,
              items: {
                select: {
                  inboundStatus: true,
                  inboundReceivedAt: true,
                },
              },
              _count: {
                select: {
                  inboundRecords: true,
                },
              },
            },
          })
        : [];

    for (const payable of linkedPayables) {
      const paidAmount = toNumber(payable.paidAmount, 0);
      const activePaymentOuts = payable.paymentOutRecords.filter(
        payment => payment.status !== 'cancelled'
      );

      if (paidAmount > 0.0001 || activePaymentOuts.length > 0) {
        throw new Error(
          `关联应付款 ${payable.payableNumber} 已存在付款记录，请先撤销付款后再取消销售订单`
        );
      }
    }

    const cancellablePurchaseStatuses = new Set([
      'draft',
      'ordered',
      'confirmed',
      'cancelled',
    ]);

    for (const purchaseOrder of linkedPurchaseOrders) {
      const hasInboundExecution =
        purchaseOrder._count.inboundRecords > 0 ||
        purchaseOrder.items.some(
          item =>
            item.inboundStatus === 'received' || item.inboundReceivedAt !== null
        );

      if (hasInboundExecution) {
        throw new Error(
          `关联采购单 ${purchaseOrder.orderNumber} 已发生入库，不能直接取消销售订单`
        );
      }

      if (!cancellablePurchaseStatuses.has(purchaseOrder.status)) {
        throw new Error(
          `关联采购单 ${purchaseOrder.orderNumber} 当前状态为 ${purchaseOrder.status}，请先处理采购单后再取消销售订单`
        );
      }
    }

    const statusUpdate = await tx.salesOrder.updateMany({
      where: { id: orderId, status: 'confirmed' },
      data: {
        status: 'cancelled',
        ...(remarks !== undefined && { remarks }),
      },
    });

    if (statusUpdate.count === 0) {
      throw new Error('订单状态已变更，请刷新后重试');
    }

    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    if (!order) {
      throw new Error('销售订单不存在');
    }

    const releasedAny = await releaseReservedInventoryForConfirmedOrder(
      tx,
      orderId,
      existingOrder
    );

    await closePendingOrderReceivables(tx, orderId, '取消', remarks);

    const payableCancellationRemark =
      remarks && remarks.trim().length > 0
        ? `销售订单 ${existingOrder.orderNumber} 取消自动关闭应付，原因：${remarks.trim()}`
        : `销售订单 ${existingOrder.orderNumber} 取消自动关闭应付`;
    const purchaseCancellationRemark =
      remarks && remarks.trim().length > 0
        ? `销售订单 ${existingOrder.orderNumber} 取消自动关闭采购单，原因：${remarks.trim()}`
        : `销售订单 ${existingOrder.orderNumber} 取消自动关闭采购单`;

    for (const payable of linkedPayables) {
      if (payable.status !== 'cancelled') {
        await tx.payableRecord.update({
          where: { id: payable.id },
          data: {
            status: 'cancelled',
            remainingAmount: 0,
            remarks: appendRemarks(payable.remarks, payableCancellationRemark),
          },
        });
      }

      const hasPurchaseLedger = await tx.statementTransaction.findFirst({
        where: {
          referenceId: payable.id,
          transactionType: 'purchase',
        },
        select: { id: true },
      });

      if (!hasPurchaseLedger) {
        logger.warn(
          'sales-order-status',
          '跳过调货应付回冲：未找到原始采购台账',
          {
            orderId,
            payableId: payable.id,
            payableNumber: payable.payableNumber,
          }
        );
        continue;
      }

      await recordPartnerTransaction(
        {
          partnerId: payable.supplierId,
          partnerRole: 'supplier',
          entityType: 'supplier',
          transactionType: 'purchase_reversal',
          amount: toNumber(payable.payableAmount, 0),
          referenceId: payable.id,
          referenceNumber: payable.payableNumber,
          description: `调货销售订单 ${existingOrder.orderNumber} 取消冲回应付 ${payable.payableNumber}`,
          userId: finalOperatorId,
          occurredAt: new Date(),
          dueDate: payable.dueDate ?? undefined,
          metadata: {
            sourceType: 'sales_order',
            sourceId: orderId,
            sourceNumber: existingOrder.orderNumber,
            payableRecordId: payable.id,
            triggeredBy: 'sales_order:cancel',
          },
        },
        tx
      );
    }

    for (const purchaseOrder of linkedPurchaseOrders) {
      if (purchaseOrder.status === 'cancelled') {
        continue;
      }

      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: 'cancelled',
          remarks: appendRemarks(
            purchaseOrder.remarks,
            purchaseCancellationRemark
          ),
        },
      });
    }

    const totalAmount = toNumber(existingOrder.totalAmount, 0);
    const roundingAdjustment = toNumber(existingOrder.roundingAdjustment, 0);
    const due = getSalesOrderReceivableTotal({
      isSampleOrder: existingOrder.isSampleOrder,
      sampleSettlementType: existingOrder.sampleSettlementType,
      totalAmount,
      roundingAdjustment,
    });

    await reverseSalesOrderReceivableLedger(tx, {
      orderId,
      orderNumber: existingOrder.orderNumber,
      customerId: existingOrder.customerId,
      due,
      userId: finalOperatorId,
      transactionType: 'order_cancellation',
      description: `销售订单 ${existingOrder.orderNumber} 取消冲回应收`,
      status: 'cancelled',
      triggeredBy: 'order:cancel',
    });

    return {
      order,
      inventoryUpdated: false,
      reservedInventoryReleased: releasedAny,
    };
  }, ORDER_STATUS_TRANSACTION_OPTIONS);
}

/**
 * 执行普通订单状态更新(不涉及库存)
 */
async function executeSimpleOrderStatusUpdate(
  orderId: string,
  status: string,
  expectedCurrentStatus: string,
  remarks?: string
): Promise<OrderStatusUpdateResult> {
  const updateResult = await prisma.salesOrder.updateMany({
    where: { id: orderId, status: expectedCurrentStatus },
    data: {
      status,
      ...(remarks !== undefined && { remarks }),
    },
  });

  if (updateResult.count === 0) {
    throw new Error('订单状态已变更，请刷新后重试');
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      remarks: true,
    },
  });

  if (!order) {
    throw new Error('销售订单不存在');
  }

  return {
    order,
    inventoryUpdated: false,
    reservedInventoryReleased: false,
  };
}

/**
 * 更新销售订单状态
 * 根据状态流转自动选择合适的处理逻辑
 */
export async function updateSalesOrderStatus(
  orderId: string,
  newStatus: string,
  currentStatus: string,
  remarks?: string,
  operatorId?: string
): Promise<OrderStatusUpdateResult> {
  const shouldConfirmWithReservation =
    newStatus === 'confirmed' && currentStatus === 'draft';

  // 如果状态变更为已发货或已完成，尝试更新库存
  // 库存扣减逻辑已改为"柔性"处理：有库存就扣，没有就跳过（支持调货产品）
  const shouldUpdateInventory =
    ['shipped', 'completed'].includes(newStatus) &&
    currentStatus === 'confirmed';

  // 如果状态变更为已取消,需要释放预留库存
  const shouldReleaseReservedInventory =
    newStatus === 'cancelled' && currentStatus === 'confirmed';
  const shouldWithdrawConfirmation =
    newStatus === 'draft' && currentStatus === 'confirmed';

  if (shouldConfirmWithReservation) {
    return await executeOrderConfirmation(orderId, remarks, operatorId);
  }

  if (shouldWithdrawConfirmation) {
    return await executeOrderConfirmationWithdrawal(
      orderId,
      remarks,
      operatorId
    );
  }

  if (shouldUpdateInventory) {
    return await executeOrderStatusUpdateWithInventory(
      orderId,
      newStatus,
      remarks,
      operatorId
    );
  } else if (shouldReleaseReservedInventory) {
    return await executeOrderCancellation(orderId, remarks, operatorId);
  } else {
    return await executeSimpleOrderStatusUpdate(
      orderId,
      newStatus,
      currentStatus,
      remarks
    );
  }
}

/**
 * 获取受影响的产品ID列表(用于缓存失效)
 */
export async function getAffectedProductIds(
  orderId: string
): Promise<string[]> {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      items: {
        select: {
          productId: true,
        },
      },
    },
  });

  if (!order) {
    return [];
  }

  return order.items
    .map(item => item.productId)
    .filter((id): id is string => id !== null);
}
