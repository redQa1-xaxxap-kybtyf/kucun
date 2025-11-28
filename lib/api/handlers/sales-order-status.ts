/**
 * 销售订单状态更新处理器
 * 包含幂等性保护和乐观锁机制
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma, withTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { consumeFIFOQueue } from '@/lib/services/fifo-cost-service';
import {
  generateUniqueOrderNumber,
  type OrderNumberConfig,
} from '@/lib/services/order-number-generator';
import {
  findAvailableInventory,
  getAvailableQuantity,
  hasEnoughInventory,
  mapProductionDateToBatchNumber,
} from '@/lib/utils/inventory-variant-mapper';

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

  // 预先收集需要扣减库存的产品，订单级别的调货/临时产品会在后续逻辑中跳过
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
    if (existingOrder.orderType === 'TRANSFER') {
      return 'TRANSFER_ORDER';
    }
    return null;
  };

  const itemsWithInventory: Array<{
    item: SalesOrderItemEntity;
    productId: string;
    transferReason: TransferReason | null;
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
            subtotal: item.subtotal ?? 0,
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
      inventory: NonNullable<
        Awaited<ReturnType<typeof findAvailableInventory>>
      >;
    }> = [];

    for (const { item, productId, transferReason } of itemsWithInventory) {
      if (transferReason) {
        logger.info('sales-order-status', '跳过调货产品库存扣减', {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          salesOrderItemId: item.id,
          reason: transferReason,
        });
        continue;
      }

      // 使用类型安全的库存查找（支持变体和批次映射）
      const inventory = await findAvailableInventory(productId, item.quantity, {
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        tx,
      });

      // 正常产品找不到库存，明确提示需要入库
      if (!inventory) {
        const productCode = item.product?.code || '未知编码';
        const productName = item.product?.name || '未知产品';
        const colorInfo = item.colorCode ? ` (色号: ${item.colorCode})` : '';
        throw new Error(
          `产品 [${productCode}] ${productName}${colorInfo} 在仓库中尚未建立库存记录，请先入库或同步库存后再发货`
        );
      }

      // 检查库存是否足够（考虑预留量）
      if (!hasEnoughInventory(inventory, item.quantity)) {
        const availableQty = getAvailableQuantity(inventory);
        const shortage = item.quantity - availableQty;
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
          inventory.batchNumber ||
          '未设置';
        const resolvedLocation = inventory.location || '未设置';

        insufficientStockItems.push({
          productCode,
          productName,
          colorInfo,
          availableQty,
          requiredQty: item.quantity,
          shortage,
          unit: unitLabel,
          batchNumber: derivedBatch,
          location: resolvedLocation,
        });
      } else {
        // 库存充足，保存检查结果用于后续更新
        inventoryChecks.push({
          item,
          productId,
          inventory,
        });
      }
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

    for (const { item, productId, inventory } of inventoryChecks) {
      // 使用乐观锁更新库存数量和预留量，确保并发安全
      const updatedCount = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantity: { gte: item.quantity }, // 再次确认库存足够
        },
        data: {
          quantity: { decrement: item.quantity },
          // 直接减少预留量（不超过当前预留量）
          reservedQuantity: {
            decrement: Math.min(item.quantity, inventory.reservedQuantity),
          },
        },
      });

      if (updatedCount.count === 0) {
        throw new Error(
          `产品 ${item.product?.name || '未知产品'} 库存不足或已被其他订单占用,请重试`
        );
      }

      const itemQuantity = item.quantity ?? 0;

      // 使用 FIFO 队列计算成本；仅在 FIFO 队列为空时回退到库存单位成本
      let baseUnitCost: number | undefined;
      let baseTotalCost: number | undefined;

      try {
        const fifoCost = await consumeFIFOQueue(
          productId,
          inventory.variantId,
          itemQuantity,
          tx
        );
        baseTotalCost = roundCurrency(fifoCost.totalCost);
        baseUnitCost =
          itemQuantity > 0
            ? roundCurrency(fifoCost.totalCost / itemQuantity)
            : fifoCost.averageUnitCost;
      } catch (error) {
        if (error instanceof Error && !error.message.includes('FIFO队列为空')) {
          // 非队列为空的错误（例如库存不足）直接抛出
          throw error;
        }

        logger.warn(
          'sales-order-status',
          'FIFO队列为空, 回退到库存单位成本计算出库成本',
          {
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            salesOrderItemId: item.id,
            productId,
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
      const totalCostWithExpense =
        baseTotalCost !== undefined || allocatedExpense > 0
          ? roundCurrency((baseTotalCost ?? 0) + allocatedExpense)
          : undefined;
      const unitCostWithExpense =
        totalCostWithExpense !== undefined && itemQuantity > 0
          ? roundCurrency(totalCostWithExpense / itemQuantity)
          : baseUnitCost;

      // 创建出库记录（使用事务内生成的单号 + FIFO成本）
      await tx.outboundRecord.create({
        data: {
          recordNumber: outboundRecordNumber,
          productId,
          variantId: inventory.variantId,
          batchNumber: finalBatchNumber,
          inventoryId: inventory.id,
          quantity: item.quantity,
          unitCost: unitCostWithExpense ?? undefined,
          totalCost: totalCostWithExpense ?? undefined,
          reason: 'sales_outbound',
          notes: `销售订单发货：${existingOrder.orderNumber}`,
          customerId: existingOrder.customerId,
          salesOrderId: existingOrder.id,
          operatorId: finalOperatorId,
        },
      });

      // 将分配的费用和成本写回销售订单明细（利润仍按销售金额 - 成本计算）
      await tx.salesOrderItem.update({
        where: { id: item.id },
        data: {
          allocatedExpense,
          costSubtotal: totalCostWithExpense,
          unitCost: unitCostWithExpense ?? undefined,
          profitAmount:
            item.subtotal !== undefined && totalCostWithExpense !== undefined
              ? roundCurrency(
                  (item.subtotal ?? 0) - (totalCostWithExpense ?? 0)
                )
              : undefined,
          profitMargin:
            item.subtotal &&
            item.subtotal > 0 &&
            totalCostWithExpense !== undefined
              ? roundCurrency(
                  (((item.subtotal ?? 0) - (totalCostWithExpense ?? 0)) /
                    (item.subtotal ?? 1)) *
                    100
                )
              : undefined,
        },
      });

      // 记录明细最新成本（含分摊费用），用于聚合到订单级成本
      const finalCostForItem =
        totalCostWithExpense !== undefined
          ? totalCostWithExpense
          : (baseTotalCost ?? 0);
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
    const order = await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status,
        ...(remarks !== undefined && { remarks }),
        // 如果状态变更为已发货，记录发货时间
        ...(status === 'shipped' && { shippedAt: new Date() }),
        costAmount: updatedCostAmount,
        profitAmount: updatedProfitAmount,
        expenseAmount: normalizedExpenseAmount,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    return {
      order,
      inventoryUpdated: true,
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
  // 先查询订单信息
  const existingOrder = await prisma.salesOrder.findUnique({
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

  return await withTransaction(async tx => {
    // 更新订单状态
    const order = await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        ...(remarks !== undefined && { remarks }),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    // 释放预留库存
    for (const item of existingOrder.items) {
      if (!item.productId) {
        continue;
      } // 跳过手动输入的产品

      // 查找对应的库存记录
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          // 同样简化处理,仅按productId查找
        },
      });

      if (inventory && inventory.reservedQuantity > 0) {
        // 释放预留量,但不能超过当前预留量
        const releaseQuantity = Math.min(
          item.quantity,
          inventory.reservedQuantity
        );

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedQuantity: { decrement: releaseQuantity },
          },
        });
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
      reservedInventoryReleased: true,
    };
  }, ORDER_STATUS_TRANSACTION_OPTIONS);
}

/**
 * 执行普通订单状态更新(不涉及库存)
 */
async function executeSimpleOrderStatusUpdate(
  orderId: string,
  status: string,
  remarks?: string
): Promise<OrderStatusUpdateResult> {
  const order = await prisma.salesOrder.update({
    where: { id: orderId },
    data: {
      status,
      ...(remarks !== undefined && { remarks }),
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      remarks: true,
    },
  });

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
  // 如果状态变更为已发货或已完成，尝试更新库存
  // 库存扣减逻辑已改为"柔性"处理：有库存就扣，没有就跳过（支持调货产品）
  const shouldUpdateInventory =
    ['shipped', 'completed'].includes(newStatus) &&
    currentStatus === 'confirmed';

  // 如果状态变更为已取消,需要释放预留库存
  const shouldReleaseReservedInventory =
    newStatus === 'cancelled' && currentStatus === 'confirmed';

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
    return await executeSimpleOrderStatusUpdate(orderId, newStatus, remarks);
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
