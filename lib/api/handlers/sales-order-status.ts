/**
 * 销售订单状态更新处理器
 * 包含幂等性保护和乐观锁机制
 * 遵循全局约定规范和唯一真理原则
 */

import {
    reserveInventory,
    shouldReserveInventory,
} from '@/lib/api/handlers/sales-orders/inventory';
import { prisma, withTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { consumeFIFOQueueByBatch } from '@/lib/services/fifo-cost-service';
import {
    generateUniqueOrderNumber,
    type OrderNumberConfig,
} from '@/lib/services/order-number-generator';
import {
    findAvailableInventory,
    mapProductionDateToBatchNumber,
} from '@/lib/utils/inventory-variant-mapper';
import { toNumber } from '@/lib/utils/number';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';


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
    const actualOrderDue = Number(
      (totalAmount + roundingAdjustment).toFixed(2)
    );

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
            paymentDate: new Date(),
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

  return await withTransaction(async tx => {
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

    for (const { item, productId, transferReason, outboundQuantity } of itemsWithInventory) {
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
      const inventory = await findAvailableInventory(productId, outboundQuantity, {
        colorCode: item.colorCode,
        // 优先按销售订单明细中选择的批次号匹配库存；
        // 只有在没有批次号时，才退回到按生产日期推导批次
        batchNumber: item.batchNumber,
        productionDate: item.productionDate,
        tx,
      });

      if (!inventory) {
        const existingInventory = await findAvailableInventory(productId, 0, {
          colorCode: item.colorCode,
          batchNumber: item.batchNumber,
          productionDate: item.productionDate,
          tx,
        });

        const productCode = item.product?.code || '未知编码';
        const productName = item.product?.name || '未知产品';
        const colorInfo = item.colorCode ? ` (色号: ${item.colorCode})` : '';
        // 系统内部统一使用"片"作为单位，因为库存和订单数量都是以片为单位存储的
        const unitLabel = '片';
        const derivedBatch =
          item.batchNumber ||
          (item.productionDate
            ? mapProductionDateToBatchNumber(item.productionDate)
            : null) ||
          existingInventory?.batchNumber ||
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
        const colorInfo = item.colorCode ? ` (色号: ${item.colorCode})` : '';
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
      const formatTraceInfo = (item: (typeof insufficientStockItems)[number]) =>
        `批次:${item.batchNumber} 位置:${item.location}`;

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

    for (const { item, productId, inventory, outboundQuantity } of inventoryChecks) {
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

      // 使用 FIFO 队列计算成本；仅在 FIFO 队列为空时回退到库存单位成本
      let baseUnitCost: number | undefined;
      let baseTotalCost: number | undefined;

      try {
        const fifoCost = await consumeFIFOQueueByBatch(
          productId,
          inventory.variantId,
          inventory.batchNumber,
          itemQuantity,
          tx
        );
        baseTotalCost = roundCurrency(fifoCost.totalCost);
        baseUnitCost =
          itemQuantity > 0
            ? roundCurrency(fifoCost.totalCost / itemQuantity)
            : fifoCost.averageUnitCost;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const isFifoEmpty = message.includes('FIFO队列为空');
        const isFifoInsufficient = message.includes('库存不足: 需要');

        if (!isFifoEmpty && !isFifoInsufficient) {
          // 非队列为空/队列库存不足的错误（例如并发冲突）直接抛出
          throw error;
        }

        logger.warn(
          'sales-order-status',
          'FIFO队列不可用(为空或数量不足), 回退到库存单位成本计算出库成本',
          {
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            salesOrderItemId: item.id,
            productId,
            fifoError: message,
          }
        );

        baseUnitCost =
          item.unitCost !== undefined && item.unitCost !== null
            ? Number(item.unitCost)
            : inventory.unitCost !== undefined && inventory.unitCost !== null
              ? Number(inventory.unitCost)
              : undefined;
        baseTotalCost =
          baseUnitCost !== undefined
            ? roundCurrency(baseUnitCost * itemQuantity)
            : undefined;
      }

      const mappedBatchNumber = item.productionDate
        ? mapProductionDateToBatchNumber(item.productionDate)
        : null;
      // 批次号优先级：生产日期映射 > 订单批次号 > 库存批次号
      const finalBatchNumber =
        mappedBatchNumber ||
        item.batchNumber ||
        inventory.batchNumber ||
        undefined;

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
          ? roundCurrency(localCostWithExpense / itemQuantity)
          : baseUnitCost;

      const transferQuantity = isMixedTransferOrder
        ? Number(item.transferQuantity ?? 0)
        : 0;
      const transferUnitCost =
        isMixedTransferOrder &&
        item.unitCost !== undefined &&
        item.unitCost !== null
          ? Number(item.unitCost)
          : 0;
      const transferCost =
        isMixedTransferOrder && transferQuantity > 0 && transferUnitCost > 0
          ? roundCurrency(transferQuantity * transferUnitCost)
          : 0;

      const totalCostWithExpense =
        isMixedTransferOrder
          ? baseTotalCost !== undefined || transferCost > 0 || allocatedExpense > 0
            ? roundCurrency((baseTotalCost ?? 0) + transferCost + allocatedExpense)
            : undefined
          : localCostWithExpense;

      // 创建出库记录（使用事务内生成的单号 + FIFO成本）
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
          reason: 'sales_outbound',
          notes: `销售订单发货：${existingOrder.orderNumber}`,
          customerId: existingOrder.customerId,
          salesOrderId: existingOrder.id,
          operatorId: finalOperatorId,
        },
      });

      // 将分配的费用和成本写回销售订单明细（利润仍按销售金额 - 成本计算）
      const itemSubtotal =
        item.subtotal == null ? undefined : toNumber(item.subtotal);
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
        updatedItemCosts.get(item.id) ?? Number(item.costSubtotal ?? 0) ?? 0;
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
  }, ORDER_STATUS_TRANSACTION_OPTIONS);
}

/**
 * 执行订单取消(释放预留库存)
 */
async function executeOrderCancellation(
  orderId: string,
  remarks?: string
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

    // 释放预留库存
    let releasedAny = false;

    const transferMode =
      existingOrder.orderType === 'TRANSFER'
        ? ((existingOrder.transferMode ?? 'SUPPLIER_ONLY') as
            | 'SUPPLIER_ONLY'
            | 'MIXED')
        : 'SUPPLIER_ONLY';

    const shouldReleaseReserved =
      existingOrder.orderType !== 'TRANSFER' || transferMode === 'MIXED';

    if (shouldReleaseReserved) {
      const releaseByKey = new Map<
        string,
        {
          productId: string;
          variantId: string | null;
          batchNumber: string | null;
          quantity: number;
        }
      >();

      for (const item of existingOrder.items) {
        if (!item.productId || item.isManualProduct) {
          continue;
        }

        const itemReservedQuantity =
          existingOrder.orderType === 'TRANSFER' && transferMode === 'MIXED'
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
        const inventories = await tx.inventory.findMany({
          where: {
            productId: release.productId,
            variantId: release.variantId,
            batchNumber: release.batchNumber,
          },
          select: {
            id: true,
            reservedQuantity: true,
          },
          take: 2,
        });

        const inventory = inventories[0];

        if (!inventory) {
          throw new Error(
            `库存记录不存在，无法释放预留量: productId=${release.productId}, variantId=${release.variantId ?? 'null'}, batchNumber=${release.batchNumber ?? 'null'}`
          );
        }

        if (inventories.length > 1) {
          throw new Error(
            `库存记录不唯一，无法安全释放预留量: productId=${release.productId}, variantId=${release.variantId ?? 'null'}, batchNumber=${release.batchNumber ?? 'null'}`
          );
        }

        if (inventory.reservedQuantity <= 0) {
          continue;
        }

        let decrementQty = Math.min(
          release.quantity,
          inventory.reservedQuantity
        );
        if (decrementQty <= 0) {
          continue;
        }

        let updateResult = await tx.inventory.updateMany({
          where: {
            id: inventory.id,
            reservedQuantity: { gte: decrementQty },
          },
          data: {
            reservedQuantity: { decrement: decrementQty },
          },
        });

        if (updateResult.count === 0) {
          const fresh = await tx.inventory.findUnique({
            where: { id: inventory.id },
            select: { reservedQuantity: true },
          });

          const freshReserved = fresh?.reservedQuantity ?? 0;
          decrementQty = Math.min(release.quantity, freshReserved);
          if (decrementQty <= 0) {
            continue;
          }

          updateResult = await tx.inventory.updateMany({
            where: {
              id: inventory.id,
              reservedQuantity: { gte: decrementQty },
            },
            data: {
              reservedQuantity: { decrement: decrementQty },
            },
          });

          if (updateResult.count === 0) {
            throw new Error(
              `释放预留库存失败, 请重试: inventoryId=${inventory.id}`
            );
          }
        }

        releasedAny = true;
      }
    }

    const cancellationRemark =
      remarks && remarks.trim().length > 0
        ? `订单取消原因：${remarks.trim()}`
        : '系统自动标记：销售订单取消关闭应收款';

    await tx.paymentRecord.updateMany({
      where: {
        salesOrderId: orderId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        remarks: cancellationRemark,
      },
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

  if (shouldConfirmWithReservation) {
    return await executeOrderConfirmation(orderId, remarks, operatorId);
  }

  if (shouldUpdateInventory) {
    return await executeOrderStatusUpdateWithInventory(
      orderId,
      newStatus,
      remarks,
      operatorId
    );
  } else if (shouldReleaseReservedInventory) {
    return await executeOrderCancellation(orderId, remarks);
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
