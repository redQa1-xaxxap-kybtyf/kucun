'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  allocateExpenses,
  roundToTwoDecimals,
} from '@/lib/services/factory-shipment-expense-service';
import {
  calculateOrderProfit,
  extractItemUpdates,
  getFactoryShipmentExpenses,
} from '@/lib/services/factory-shipment-profit-service';
import { generateFactoryShipmentNumber } from '@/lib/services/simple-order-number-generator';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentItemDeliveryStatus,
  type FactoryShipmentItemInboundStatus,
  type FactoryShipmentItemOwnership,
  type FactoryShipmentOrderItem,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

import {
  createFactoryShipmentSchema,
  updateFactoryShipmentStatusSchema,
  type FactoryShipmentFormData,
} from './factory-shipments.schemas';
import {
  parseJsonPayload,
  resolveShipmentItems,
  type ActionResult,
} from './factory-shipments.utils';

// ============================================
// Server Actions
// ============================================

/**
 * 创建厂家发货订单
 */
export async function createFactoryShipment(
  formData: FormData
): Promise<ActionResult<{ id: string; containerNumber: string | null }>> {
  try {
    // 1. 身份认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = parseJsonPayload<FactoryShipmentFormData>(formData, 'data');
    const data = createFactoryShipmentSchema.parse(rawData);

    // 3. 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const grandTotal = totalAmount;

    // 4. 数据库事务
    const result = await prisma.$transaction(async tx => {
      const itemsPayload = await resolveShipmentItems(tx, data.items);
      const orderNumber = await generateFactoryShipmentNumber();
      const status: FactoryShipmentStatus =
        (data.status as FactoryShipmentStatus | undefined) ??
        FACTORY_SHIPMENT_STATUS.DRAFT;
      const receivableAmount = data.receivableAmount ?? grandTotal;
      const depositAmount = Math.min(data.depositAmount ?? 0, receivableAmount);
      const trimmedContainer = data.containerNumber?.trim();

      // 创建厂家发货订单
      const shipment = await tx.factoryShipmentOrder.create({
        data: {
          orderNumber,
          containerNumber:
            trimmedContainer && trimmedContainer.length > 0
              ? trimmedContainer
              : null,
          customerId: data.customerId,
          status,
          totalAmount: grandTotal,
          receivableAmount,
          depositAmount,
          shipmentDate: data.shipmentDate
            ? new Date(data.shipmentDate)
            : undefined,
          arrivalDate: data.arrivalDate
            ? new Date(data.arrivalDate)
            : undefined,
          remarks: data.remarks?.trim() || undefined,
          userId: session.user.id,
          items: {
            create: itemsPayload,
          },
        },
      });

      // 如果订单状态为已到货，处理自有货物入库
      if (status === FACTORY_SHIPMENT_STATUS.ARRIVED) {
        for (const item of itemsPayload) {
          // 只有自有货物才入库（客户货不进入公司库存）
          if (
            item.productId &&
            !item.isManualProduct &&
            item.ownership === 'self'
          ) {
            const quantityDelta = Math.round(item.quantity);
            // 查找或创建库存记录
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            // 使用 unitPrice 作为入库成本（创建时还没有费用分摊）
            const inboundUnitCost = item.unitPrice;

            if (existingInventory) {
              // 计算加权平均成本
              const newUnitCost = calculateWeightedAverageCost(
                existingInventory.quantity,
                existingInventory.unitCost || 0,
                quantityDelta,
                inboundUnitCost
              );

              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantity: {
                    increment: quantityDelta,
                  },
                  unitCost: newUnitCost,
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  productId: item.productId,
                  quantity: quantityDelta,
                  reservedQuantity: 0,
                  unitCost: inboundUnitCost,
                },
              });
            }
          }
        }

        // 更新自有货入库状态
        await tx.factoryShipmentOrderItem.updateMany({
          where: {
            factoryShipmentOrderId: shipment.id,
            ownership: 'self',
            selfInboundStatus: { not: 'received' },
          },
          data: {
            selfInboundStatus: 'received',
            inboundReceivedAt: new Date(),
          },
        });
      }

      // 创建费用记录（如果有费用项）
      if (data.feeItems && data.feeItems.length > 0) {
        const expenseRecords = data.feeItems.map(feeItem => ({
          expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          expenseType: feeItem.feeType,
          expenseName: feeItem.feeName,
          expenseAmount: feeItem.feeAmount,
          expenseDate: new Date(),
          relatedType: 'factory_shipment',
          relatedId: shipment.id,
          relatedNumber: shipment.orderNumber,
          remarks: feeItem.remarks || undefined,
          userId: session.user.id,
        }));

        await tx.expenseRecord.createMany({
          data: expenseRecords,
        });
      }

      return shipment;
    });

    // 5. 重新验证路径
    revalidatePath('/factory-shipments');
    revalidatePath('/inventory');
    revalidatePath('/finance/expenses');

    return {
      success: true,
      data: { id: result.id, containerNumber: result.containerNumber },
    };
  } catch (error) {
    logger.error('actions:factory-shipments', '创建厂家发货订单失败', error, {
      action: 'createFactoryShipment',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建厂家发货订单失败' };
  }
}

/**
 * 更新厂家发货订单状态
 */
export async function updateFactoryShipmentStatus(
  formData: FormData
): Promise<ActionResult> {
  let shipmentIdForLog: string | undefined;
  let statusForLog: FactoryShipmentStatus | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      shipmentId: formData.get('shipmentId') as string,
      status: formData.get('status') as string,
    };

    const data = updateFactoryShipmentStatusSchema.parse(rawData);
    shipmentIdForLog = data.shipmentId;
    statusForLog = data.status;

    await prisma.$transaction(async tx => {
      // 获取发货单详情
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: data.shipmentId },
        include: { items: true },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 更新发货单状态
      await tx.factoryShipmentOrder.update({
        where: { id: data.shipmentId },
        data: { status: data.status },
      });

      // 如果从待发货/运输中变为已到货，处理自有货物入库
      if (
        (shipment.status === 'pending_shipment' ||
          shipment.status === 'in_transit') &&
        data.status === 'arrived'
      ) {
        for (const item of shipment.items) {
          // 只有自有货物才入库（客户货不进入公司库存）
          if (
            item.productId &&
            !item.isManualProduct &&
            item.ownership === 'self'
          ) {
            const quantityDelta = Math.round(item.quantity);
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            // 使用明细的 unitCost（包含分摊费用）作为入库成本
            // 如果 unitCost 为 null，则使用 unitPrice
            const inboundUnitCost = item.unitCost || item.unitPrice;

            if (existingInventory) {
              // 计算加权平均成本
              const newUnitCost = calculateWeightedAverageCost(
                existingInventory.quantity,
                existingInventory.unitCost || 0,
                quantityDelta,
                inboundUnitCost
              );

              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantity: {
                    increment: quantityDelta,
                  },
                  unitCost: newUnitCost,
                },
              });
            } else {
              // 如果库存不存在，创建新的库存记录
              await tx.inventory.create({
                data: {
                  productId: item.productId,
                  quantity: quantityDelta,
                  reservedQuantity: 0,
                  unitCost: inboundUnitCost,
                },
              });
            }
          }
        }

        // 更新自有货入库状态
        await tx.factoryShipmentOrderItem.updateMany({
          where: {
            factoryShipmentOrderId: data.shipmentId,
            ownership: 'self',
            selfInboundStatus: { not: 'received' },
          },
          data: {
            selfInboundStatus: 'received',
            inboundReceivedAt: new Date(),
          },
        });
      }
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${data.shipmentId}`);
    revalidatePath('/inventory');

    return { success: true };
  } catch (error) {
    logger.error('actions:factory-shipments', '更新发货单状态失败', error, {
      action: 'updateFactoryShipmentStatus',
      shipmentId: shipmentIdForLog,
      status: statusForLog,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '更新发货单状态失败' };
  }
}

/**
 * 删除厂家发货订单
 * 权限规则：草稿状态和已取消状态允许删除
 */
export async function deleteFactoryShipment(
  shipmentId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 只允许删除草稿和已取消的订单
      if (
        shipment.status !== FACTORY_SHIPMENT_STATUS.DRAFT &&
        shipment.status !== FACTORY_SHIPMENT_STATUS.CANCELLED
      ) {
        throw new Error('只能删除草稿或已取消的订单');
      }

      // 删除发货单项
      await tx.factoryShipmentOrderItem.deleteMany({
        where: { factoryShipmentOrderId: shipmentId },
      });

      // 删除发货单
      await tx.factoryShipmentOrder.delete({
        where: { id: shipmentId },
      });
    });

    revalidatePath('/factory-shipments');

    return { success: true };
  } catch (error) {
    logger.error('actions:factory-shipments', '删除发货单失败', error, {
      action: 'deleteFactoryShipment',
      shipmentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除发货单失败',
    };
  }
}

/**
 * 取消厂家发货订单
 * 权限规则：待确认和已确认状态允许取消
 */
export async function cancelFactoryShipment(
  shipmentId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 只允许取消草稿、已确认、待发货状态的订单
      if (
        shipment.status !== FACTORY_SHIPMENT_STATUS.DRAFT &&
        shipment.status !== FACTORY_SHIPMENT_STATUS.CONFIRMED &&
        shipment.status !== FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT
      ) {
        throw new Error('只能取消草稿、已确认或待发货的订单');
      }

      // 更新订单状态为已取消
      await tx.factoryShipmentOrder.update({
        where: { id: shipmentId },
        data: {
          status: FACTORY_SHIPMENT_STATUS.CANCELLED,
        },
      });
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${shipmentId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:factory-shipments', '取消发货单失败', error, {
      action: 'cancelFactoryShipment',
      shipmentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '取消发货单失败',
    };
  }
}

/**
 * 更新厂家发货订单
 */
export async function updateFactoryShipment(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let shipmentIdForLog: string | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const shipmentIdValue = formData.get('shipmentId');
    if (typeof shipmentIdValue !== 'string' || !shipmentIdValue) {
      return { success: false, error: '发货单 ID 不能为空' };
    }
    shipmentIdForLog = shipmentIdValue;
    const shipmentId = shipmentIdValue;

    const rawData = parseJsonPayload<FactoryShipmentFormData>(formData, 'data');
    const data = createFactoryShipmentSchema.parse(rawData);

    // 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const grandTotal = totalAmount;

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const existingShipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true },
      });

      if (!existingShipment) {
        throw new Error('发货单不存在');
      }

      // 不能修改已到港的发货单
      if (existingShipment.status === 'arrived') {
        throw new Error('不能修改已到港的发货单');
      }

      // 删除旧的发货单项和临时产品
      await tx.factoryShipmentOrderItem.deleteMany({
        where: { factoryShipmentOrderId: shipmentId },
      });

      const itemsPayload = await resolveShipmentItems(tx, data.items);
      const receivableAmount = data.receivableAmount ?? grandTotal;
      const depositAmount = Math.min(
        data.depositAmount ?? existingShipment.depositAmount ?? 0,
        receivableAmount
      );
      const updateData: Prisma.FactoryShipmentOrderUncheckedUpdateInput = {
        customerId: data.customerId,
        status: data.status ?? existingShipment.status,
        totalAmount: grandTotal,
        receivableAmount,
        depositAmount,
        remarks: data.remarks?.trim() ?? existingShipment.remarks ?? undefined,
        items: {
          create: itemsPayload,
        },
      };

      if (data.containerNumber !== undefined) {
        const trimmed = data.containerNumber.trim();
        if (trimmed.length > 0) {
          updateData.containerNumber = trimmed;
        }
      }

      if (data.shipmentDate) {
        updateData.shipmentDate = new Date(data.shipmentDate);
      }

      if (data.arrivalDate) {
        updateData.arrivalDate = new Date(data.arrivalDate);
      }

      // 更新发货单
      await tx.factoryShipmentOrder.update({
        where: { id: shipmentId },
        data: updateData,
      });
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${shipmentId}`);

    return { success: true, data: { id: shipmentId } };
  } catch (error) {
    logger.error('actions:factory-shipments', '更新厂家发货订单失败', error, {
      action: 'updateFactoryShipment',
      shipmentId: shipmentIdForLog,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新厂家发货订单失败',
    };
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算加权平均成本
 *
 * 公式: 新单位成本 = (原库存金额 + 新入库金额) / (原库存数量 + 新入库数量)
 *
 * @param currentStock - 当前库存数量
 * @param currentUnitCost - 当前单位成本
 * @param inboundQuantity - 入库数量
 * @param inboundUnitCost - 入库单位成本
 * @returns 新的单位成本
 */
function calculateWeightedAverageCost(
  currentStock: number,
  currentUnitCost: number,
  inboundQuantity: number,
  inboundUnitCost: number
): number {
  const currentValue = currentStock * currentUnitCost;
  const inboundValue = inboundQuantity * inboundUnitCost;
  const totalQuantity = currentStock + inboundQuantity;

  return totalQuantity > 0
    ? roundToTwoDecimals((currentValue + inboundValue) / totalQuantity)
    : inboundUnitCost;
}

/**
 * 重新计算发货单的利润和成本
 * 用于费用录入/修改后重新计算
 *
 * @param factoryShipmentOrderId - 发货单ID
 */
export async function recalculateProfitAndCost(
  factoryShipmentOrderId: string
): Promise<ActionResult<void>> {
  try {
    // 1. 身份认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 获取发货单和明细
    const order = await prisma.factoryShipmentOrder.findUnique({
      where: { id: factoryShipmentOrderId },
      include: {
        items: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: '发货单不存在' };
    }

    // 3. 获取费用
    const { totalExpenses } = await getFactoryShipmentExpenses(
      factoryShipmentOrderId
    );

    // 4. 分摊费用
    const normalizedItems: FactoryShipmentOrderItem[] = order.items.map(
      item => ({
        ...item,
        ownership: (item.ownership ||
          FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER) as FactoryShipmentItemOwnership,
        customerDeliveryStatus: (item.customerDeliveryStatus ?? undefined) as
          | FactoryShipmentItemDeliveryStatus
          | undefined,
        selfInboundStatus: (item.selfInboundStatus ?? undefined) as
          | FactoryShipmentItemInboundStatus
          | undefined,
        ownershipRemarks: item.ownershipRemarks ?? undefined,
        isManualProduct: item.isManualProduct ?? undefined,
      })
    );

    const expenseAllocation = allocateExpenses(
      normalizedItems,
      totalExpenses,
      'by_value'
    );

    const expenseMap = new Map(
      expenseAllocation.results.map(r => [r.itemId, r.allocatedAmount])
    );

    // 5. 计算利润
    const profitSummary = calculateOrderProfit(
      normalizedItems,
      order.receivableAmount || 0,
      expenseMap
    );

    // 6. 提取更新数据
    const itemUpdates = extractItemUpdates(
      profitSummary,
      normalizedItems,
      expenseMap
    );

    // 7. 更新数据库
    await prisma.$transaction([
      prisma.factoryShipmentOrder.update({
        where: { id: factoryShipmentOrderId },
        data: {
          costAmount: profitSummary.totalCost,
          expenseAmount: profitSummary.totalExpenses,
          profitAmount: profitSummary.customerProfit,
          customerProfit: profitSummary.customerProfit,
          selfCostAmount: profitSummary.selfCostAmount,
        },
      }),
      ...itemUpdates.map(update =>
        prisma.factoryShipmentOrderItem.update({
          where: { id: update.itemId },
          data: {
            unitCost: update.unitCost,
            allocatedExpense: update.allocatedExpense,
            profitAmount: update.profitAmount,
            profitMargin: update.profitMargin,
          },
        })
      ),
    ]);

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${factoryShipmentOrderId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:factory-shipments', '重新计算利润和成本失败', error, {
      action: 'recalculateProfitAndCost',
      factoryShipmentOrderId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '重新计算利润和成本失败',
    };
  }
}
