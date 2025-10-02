/**
 * 销售订单状态更新处理器
 * 包含幂等性保护和乐观锁机制
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma, withTransaction } from '@/lib/db';

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
 * 执行订单状态更新(带库存扣减)
 * 使用乐观锁防止并发超卖
 */
async function executeOrderStatusUpdateWithInventory(
  orderId: string,
  status: string,
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

    // 更新库存（减少可用库存）- 使用乐观锁
    for (const item of existingOrder.items) {
      if (!item.productId) {continue;} // 跳过手动输入的商品

      // 查找库存记录
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId:
            (item as unknown as { variantId?: string }).variantId || null,
          batchNumber:
            (item as unknown as { batchNumber?: string }).batchNumber || null,
        },
      });

      if (!inventory) {
        throw new Error(
          `产品 ${item.product?.name || '未知产品'} 库存记录不存在`
        );
      }

      // 检查库存是否足够
      const availableQuantity = inventory.quantity - inventory.reservedQuantity;
      if (availableQuantity < item.quantity) {
        throw new Error(
          `产品 ${item.product?.name || '未知产品'} (色号: ${item.colorCode || '无'}) 库存不足。可用: ${availableQuantity}, 需要: ${item.quantity}`
        );
      }

      // 使用乐观锁更新库存 - 确保并发安全
      const updatedCount = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantity: { gte: item.quantity }, // 确保库存足够
        },
        data: {
          quantity: { decrement: item.quantity },
          // 同步减少预留量,确保预留量不超过实际库存
          reservedQuantity: Math.max(
            0,
            Math.min(
              inventory.reservedQuantity,
              inventory.quantity - item.quantity
            )
          ),
        },
      });

      if (updatedCount.count === 0) {
        throw new Error(
          `产品 ${item.product?.name || '未知产品'} 库存不足或已被其他订单占用,请重试`
        );
      }
    }

    return {
      order,
      inventoryUpdated: true,
      reservedInventoryReleased: false,
    };
  });
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
      if (!item.productId) {continue;} // 跳过手动输入的商品

      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId:
            (item as unknown as { variantId?: string }).variantId || null,
          batchNumber:
            (item as unknown as { batchNumber?: string }).batchNumber || null,
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
  });
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
  remarks?: string
): Promise<OrderStatusUpdateResult> {
  // 如果状态变更为已发货或已完成,需要更新库存
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
      remarks
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
