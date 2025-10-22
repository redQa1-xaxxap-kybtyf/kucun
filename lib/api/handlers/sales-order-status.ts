/**
 * 销售订单状态更新处理器
 * 包含幂等性保护和乐观锁机制
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma, withTransaction } from '@/lib/db';
import {
  generateUniqueOrderNumber,
  type OrderNumberConfig,
} from '@/lib/services/order-number-generator';
import {
  findAvailableInventory,
  getAvailableQuantity,
  hasEnoughInventory,
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
            },
          },
        },
      },
    },
  });

  if (!existingOrder) {
    throw new Error('销售订单不存在');
  }

  // 如果没有提供操作员ID,使用订单创建人ID
  const finalOperatorId = operatorId || existingOrder.userId;

  // 预先生成所有出库单号（在事务外部，避免嵌套事务）
  const itemsWithInventory: Array<{
    item: (typeof existingOrder.items)[0];
    outboundRecordNumber: string;
  }> = [];

  for (const item of existingOrder.items) {
    if (!item.productId) {
      continue; // 跳过手动输入的商品
    }

    // 预先生成出库单号
    const outboundRecordNumber = await generateUniqueOrderNumber(
      OUTBOUND_RECORD_CONFIG
    );

    itemsWithInventory.push({
      item,
      outboundRecordNumber,
    });
  }

  return await withTransaction(async tx => {
    // 第一步：先检查所有商品的库存，收集库存不足的信息
    const insufficientStockItems: Array<{
      productCode: string;
      productName: string;
      colorInfo: string;
      availableQty: number;
      requiredQty: number;
      shortage: number;
    }> = [];

    const inventoryChecks: Array<{
      item: (typeof existingOrder.items)[0];
      outboundRecordNumber: string;
      inventory: NonNullable<
        Awaited<ReturnType<typeof findAvailableInventory>>
      >;
    }> = [];

    for (const { item, outboundRecordNumber } of itemsWithInventory) {
      // 使用类型安全的库存查找（支持变体和批次映射）
      const inventory = await findAvailableInventory(
        item.productId!,
        item.quantity,
        {
          colorCode: item.colorCode,
          productionDate: item.productionDate,
          tx,
        }
      );

      // 如果没有找到库存记录，跳过该商品（可能是调货商品）
      if (!inventory) {
        continue;
      }

      // 检查库存是否足够（考虑预留量）
      if (!hasEnoughInventory(inventory, item.quantity)) {
        const availableQty = getAvailableQuantity(inventory);
        const shortage = item.quantity - availableQty;
        const productCode = item.product?.code || '未知编码';
        const productName = item.product?.name || '未知产品';
        const colorInfo = item.colorCode ? ` (色号: ${item.colorCode})` : '';

        insufficientStockItems.push({
          productCode,
          productName,
          colorInfo,
          availableQty,
          requiredQty: item.quantity,
          shortage,
        });
      } else {
        // 库存充足，保存检查结果用于后续更新
        inventoryChecks.push({ item, outboundRecordNumber, inventory });
      }
    }

    // 如果有库存不足的商品，抛出详细的错误信息
    if (insufficientStockItems.length > 0) {
      if (insufficientStockItems.length === 1) {
        const item = insufficientStockItems[0];
        throw new Error(
          `产品 [${item.productCode}] ${item.productName}${item.colorInfo} 库存不足，当前库存：${item.availableQty}片，需要：${item.requiredQty}片，缺少：${item.shortage}片`
        );
      } else {
        const errorMessages = insufficientStockItems.map(
          item =>
            `- [${item.productCode}] ${item.productName}${item.colorInfo}：当前库存 ${item.availableQty}片，需要 ${item.requiredQty}片，缺少 ${item.shortage}片`
        );
        throw new Error(
          `以下 ${insufficientStockItems.length} 个商品库存不足：\n${errorMessages.join('\n')}`
        );
      }
    }

    // 第二步：更新订单状态
    const order = await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status,
        ...(remarks !== undefined && { remarks }),
        // 如果状态变更为已发货，记录发货时间
        ...(status === 'shipped' && { shippedAt: new Date() }),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
      },
    });

    // 第三步：更新库存并创建出库记录 - 使用乐观锁
    for (const { item, outboundRecordNumber, inventory } of inventoryChecks) {
      // 使用乐观锁更新库存 - 确保并发安全
      const updatedCount = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantity: { gte: item.quantity }, // 确保库存足够
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

      // 创建出库记录（使用预先生成的单号）
      await tx.outboundRecord.create({
        data: {
          recordNumber: outboundRecordNumber,
          productId: item.productId!,
          variantId: inventory.variantId,
          batchNumber: item.batchNumber || inventory.batchNumber || undefined,
          inventoryId: inventory.id,
          quantity: item.quantity,
          unitCost: item.unitCost || inventory.unitCost || undefined,
          totalCost: item.unitCost
            ? item.unitCost * item.quantity
            : inventory.unitCost
              ? inventory.unitCost * item.quantity
              : undefined,
          reason: 'sales_outbound',
          notes: `销售订单发货：${existingOrder.orderNumber}`,
          customerId: existingOrder.customerId,
          salesOrderId: existingOrder.id,
          operatorId: finalOperatorId,
        },
      });
    }

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
      } // 跳过手动输入的商品

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
  // 库存扣减逻辑已改为"柔性"处理：有库存就扣，没有就跳过（支持调货商品）
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
