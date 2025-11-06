'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  executeMinimalInboundTransaction,
  type MinimalInboundTransactionResult,
} from '@/lib/api/minimal-inbound-transaction';
import { auth } from '@/lib/auth';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withIdempotency } from '@/lib/utils/idempotency';

/**
 * 销售订单模块 Server Actions
 *
 * ✅ Next.js 15 最佳实践：
 * 1. 'use server' 指令
 * 2. Zod 参数验证
 * 3. 身份认证检查
 * 4. Prisma 事务处理
 * 5. 路径重新验证
 */

// ============================================
// 类型定义
// ============================================

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// Zod 验证模式
// ============================================

const salesOrderItemSchema = z
  .object({
    productId: z.string().optional(),
    isManualProduct: z.boolean().default(false),
    manualProductName: z.string().optional(),
    manualSpecification: z.string().optional(),
    manualWeight: z.number().optional(),
    manualUnit: z.string().optional(),
    colorCode: z.string().optional(),
    productionDate: z.string().optional(),
    quantity: z.number().positive('数量必须大于 0'),
    unitPrice: z.number().positive('单价必须大于 0'),
    subtotal: z.number().nonnegative('小计不能为负'),
    unitCost: z.number().optional(),
    costSubtotal: z.number().optional(),
    profitAmount: z.number().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.isManualProduct) {
      // 临时产品只需要产品编码，产品名称为可选
      // 不再强制要求 manualProductName
    } else {
      const productId = item.productId?.trim();
      if (!productId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '产品ID不能为空',
          path: ['productId'],
        });
      }
    }
  });

const createSalesOrderSchema = z.object({
  customerId: z.string().min(1, '客户 ID 不能为空'),
  supplierId: z.string().optional(),
  orderType: z.enum(['NORMAL', 'TRANSFER']).default('NORMAL'),
  status: z
    .enum(['draft', 'confirmed', 'shipped', 'delivered', 'cancelled'])
    .default('draft'),
  items: z.array(salesOrderItemSchema).min(1, '至少需要一个订单项'),
  remarks: z.string().optional(),
});

const updateSalesOrderStatusSchema = z.object({
  orderId: z.string().min(1, '订单 ID 不能为空'),
  status: z.enum(['draft', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  cancelReason: z.string().max(500, '取消原因不能超过500个字符').optional(),
  idempotencyKey: z.string().uuid('幂等性键格式不正确').optional(),
});

// ============================================
// Server Actions
// ============================================

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  formData: FormData
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createSalesOrderSchema.parse(rawData);

    // 3. 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const costAmount = data.items.reduce(
      (sum, item) => sum + (item.costSubtotal || 0),
      0
    );
    const profitAmount = totalAmount - costAmount;

    // 4. 生成订单号（使用并发安全的生成服务）
    const { generateSalesOrderNumber } = await import(
      '@/lib/services/simple-order-number-generator'
    );
    const orderNumber = await generateSalesOrderNumber();

    // 5. 数据库事务
    const result = await prisma.$transaction(async tx => {
      // 创建销售订单
      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          supplierId: data.supplierId,
          userId: session.user.id,
          orderType: data.orderType,
          status: data.status,
          totalAmount,
          costAmount,
          profitAmount,
          paidAmount: 0,
          remarks: data.remarks,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              isManualProduct: item.isManualProduct,
              manualProductName: item.manualProductName,
              manualSpecification: item.manualSpecification,
              manualWeight: item.manualWeight,
              manualUnit: item.manualUnit,
              colorCode: item.colorCode,
              productionDate: item.productionDate
                ? typeof item.productionDate === 'string'
                  ? item.productionDate
                  : (item.productionDate as Date).toISOString()
                : null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              unitCost: item.unitCost,
              costSubtotal: item.costSubtotal,
              profitAmount: item.profitAmount,
            })),
          },
        },
      });

      // 如果订单状态为已确认，减少库存
      if (data.status === 'confirmed') {
        for (const item of data.items) {
          if (item.productId && !item.isManualProduct) {
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: {
                quantity: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }
      }

      return order;
    });

    // 5. 重新验证路径
    revalidatePath('/sales-orders');
    revalidatePath('/finance/receivables');

    return {
      success: true,
      data: { id: result.id, orderNumber: result.orderNumber },
    };
  } catch (error) {
    logger.error('actions:sales-orders', '创建销售订单失败', error, {
      action: 'createSalesOrder',
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: '创建销售订单失败' };
  }
}

/**
 * 更新销售订单状态
 */
export async function updateSalesOrderStatus(
  formData: FormData
): Promise<ActionResult> {
  let orderIdForLog: string | undefined;
  let statusForLog:
    | 'draft'
    | 'confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const cancelReasonRaw = formData.get('cancelReason');
    const idempotencyKeyRaw = formData.get('idempotencyKey');
    const rawData = {
      orderId: formData.get('orderId') as string,
      status: formData.get('status') as string,
      cancelReason:
        typeof cancelReasonRaw === 'string' ? cancelReasonRaw : undefined,
      idempotencyKey:
        typeof idempotencyKeyRaw === 'string' ? idempotencyKeyRaw : undefined,
    };

    const data = updateSalesOrderStatusSchema.parse({
      ...rawData,
      cancelReason:
        rawData.cancelReason && rawData.cancelReason.trim().length > 0
          ? rawData.cancelReason.trim()
          : undefined,
      idempotencyKey:
        rawData.idempotencyKey && rawData.idempotencyKey.trim().length > 0
          ? rawData.idempotencyKey.trim()
          : undefined,
    });
    orderIdForLog = data.orderId;
    statusForLog = data.status;

    const orderSnapshot = await prisma.salesOrder.findUnique({
      where: { id: data.orderId },
      select: { status: true, updatedAt: true },
    });

    if (!orderSnapshot) {
      return { success: false, error: '订单不存在' };
    }

    const fallbackIdempotencyKey = `sales-order-status:${data.orderId}:${orderSnapshot.status}->${data.status}:${orderSnapshot.updatedAt.getTime()}`;
    const resolvedIdempotencyKey =
      data.idempotencyKey ?? fallbackIdempotencyKey;

    const operationResult = await withIdempotency(
      resolvedIdempotencyKey,
      'sales_order_status_change',
      data.orderId,
      session.user.id,
      {
        previousStatus: orderSnapshot.status,
        nextStatus: data.status,
        cancelReason: data.cancelReason ?? null,
      },
      async () =>
        await prisma.$transaction(async tx => {
          const order = await tx.salesOrder.findUnique({
            where: { id: data.orderId },
            include: { items: true },
          });

          if (!order) {
            throw new Error('订单不存在');
          }

          const updatedOrder = await tx.salesOrder.update({
            where: { id: data.orderId },
            data: { status: data.status },
          });

          const inboundResults: MinimalInboundTransactionResult[] = [];
          let inventoryUpdated = false;
          let reservedInventoryReleased = false;

          if (order.status === 'draft' && data.status === 'confirmed') {
            for (const item of order.items) {
              if (item.productId && !item.isManualProduct) {
                await tx.inventory.updateMany({
                  where: { productId: item.productId },
                  data: {
                    quantity: {
                      decrement: item.quantity,
                    },
                  },
                });
                inventoryUpdated = true;
              }
            }
          }

          if (order.status === 'confirmed' && data.status === 'cancelled') {
            const cancellationRemarkBase = `销售订单${order.orderNumber}取消回库`;
            const cancellationRemark = data.cancelReason
              ? `${cancellationRemarkBase}，原因：${data.cancelReason}`
              : cancellationRemarkBase;

            for (const item of order.items) {
              if (!item.productId || item.isManualProduct) {
                continue;
              }

              const inventory = await tx.inventory.findFirst({
                where: {
                  productId: item.productId,
                  variantId: item.variantId || null,
                  batchNumber: item.batchNumber || null,
                },
              });

              const inboundQuantity = Number(item.quantity) || 0;
              if (inboundQuantity <= 0) {
                continue;
              }

              const unitCost =
                typeof inventory?.unitCost === 'number'
                  ? inventory.unitCost
                  : (item.unitCost ?? 0);

              const inboundRecord = await executeMinimalInboundTransaction(
                {
                  productId: item.productId,
                  variantId: item.variantId ?? undefined,
                  quantity: inboundQuantity,
                  unitCost,
                  reason: 'sales_cancel',
                  remarks: cancellationRemark,
                  batchNumber: item.batchNumber ?? '',
                  userId: session.user.id,
                },
                { tx }
              );

              inboundResults.push(inboundRecord);
              inventoryUpdated = true;

              if (inventory?.id) {
                const releaseQuantity = Math.min(
                  inboundQuantity,
                  inventory.reservedQuantity || 0
                );
                if (releaseQuantity > 0) {
                  await tx.inventory.update({
                    where: { id: inventory.id },
                    data: {
                      reservedQuantity: {
                        decrement: releaseQuantity,
                      },
                    },
                  });
                  reservedInventoryReleased = true;
                }
              }
            }
          }

          return {
            order: updatedOrder,
            inventoryUpdated,
            reservedInventoryReleased,
            inboundResults,
          };
        })
    );

    if (operationResult.inboundResults.length > 0) {
      const productIds = Array.from(
        new Set(operationResult.inboundResults.map(record => record.productId))
      );
      await Promise.allSettled([
        ...productIds.map(id => invalidateInventoryCache(id)),
        ...productIds.map(id => revalidateProducts(id)),
      ]);
    }

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${data.orderId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:sales-orders', '更新订单状态失败', error, {
      action: 'updateSalesOrderStatus',
      salesOrderId: orderIdForLog,
      status: statusForLog,
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: '更新订单状态失败' };
  }
}

/**
 * 删除销售订单
 */
export async function deleteSalesOrder(orderId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查订单是否存在
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      // 不能删除已确认或已完成的订单
      if (
        order.status === 'confirmed' ||
        order.status === 'shipped' ||
        order.status === 'delivered'
      ) {
        throw new Error('不能删除已确认或已完成的订单');
      }

      // 删除订单项
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: orderId },
      });

      // 删除订单
      await tx.salesOrder.delete({
        where: { id: orderId },
      });
    });

    revalidatePath('/sales-orders');

    return { success: true };
  } catch (error) {
    logger.error('actions:sales-orders', '删除订单失败', error, {
      action: 'deleteSalesOrder',
      orderId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除订单失败',
    };
  }
}

/**
 * 增量更新销售订单明细项
 * 采用智能差异对比策略，避免"先删后建"的数据丢失风险
 *
 * @param tx - Prisma事务对象
 * @param orderId - 订单ID
 * @param newItems - 新的订单项数据
 * @param existingItems - 现有的订单项数据
 */
async function updateSalesOrderItemsIncremental(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  newItems: Array<{
    id?: string;
    productId?: string | null;
    isManualProduct?: boolean | null;
    manualProductName?: string | null;
    manualSpecification?: string | null;
    manualWeight?: number | null;
    manualUnit?: string | null;
    colorCode?: string | null;
    productionDate?: string | Date | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitCost?: number | null;
    costSubtotal?: number | null;
    profitAmount?: number | null;
  }>,
  existingItems: Array<{ id: string }>
) {
  // 构建现有订单项ID集合
  const existingItemIds = new Set(existingItems.map(item => item.id));

  // 构建新订单项ID集合（过滤掉undefined和空字符串）
  const newItemIds = new Set(
    newItems
      .filter((item): item is typeof item & { id: string } =>
        Boolean(item.id && item.id.trim())
      )
      .map(item => item.id)
  );

  // 1. 处理新增和修改的订单项
  for (const newItem of newItems) {
    const itemData = {
      productId: newItem.productId || null,
      isManualProduct: newItem.isManualProduct,
      manualProductName: newItem.manualProductName,
      manualSpecification: newItem.manualSpecification,
      manualWeight: newItem.manualWeight,
      manualUnit: newItem.manualUnit,
      colorCode: newItem.colorCode,
      productionDate: newItem.productionDate
        ? typeof newItem.productionDate === 'string'
          ? newItem.productionDate
          : (newItem.productionDate as Date).toISOString()
        : null,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      subtotal: newItem.subtotal,
      unitCost: newItem.unitCost,
      costSubtotal: newItem.costSubtotal,
      profitAmount: newItem.profitAmount,
    };

    if (!newItem.id || !newItem.id.trim()) {
      // 新增订单项
      await tx.salesOrderItem.create({
        data: {
          ...itemData,
          salesOrderId: orderId,
        },
      });
    } else if (existingItemIds.has(newItem.id)) {
      // 修改现有订单项
      await tx.salesOrderItem.update({
        where: { id: newItem.id },
        data: itemData,
      });
    }
  }

  // 2. 处理需要删除的订单项
  const itemsToDelete = existingItems.filter(item => !newItemIds.has(item.id));

  for (const item of itemsToDelete) {
    // 检查是否存在退货记录
    const returnItemCount = await tx.returnOrderItem.count({
      where: { salesOrderItemId: item.id },
    });

    if (returnItemCount > 0) {
      throw new Error(
        `订单项 ${item.id} 存在 ${returnItemCount} 条退货记录，无法删除。请先处理相关退货记录。`
      );
    }

    // 安全删除
    await tx.salesOrderItem.delete({
      where: { id: item.id },
    });
  }
}

/**
 * 更新销售订单
 * 使用增量更新策略，避免"先删后建"的数据丢失风险
 */
export async function updateSalesOrder(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let orderIdForLog: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const orderId = formData.get('orderId') as string;
    orderIdForLog = orderId;
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createSalesOrderSchema.parse(rawData);

    // 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const costAmount = data.items.reduce(
      (sum, item) => sum + (item.costSubtotal || 0),
      0
    );
    const profitAmount = totalAmount - costAmount;

    await prisma.$transaction(async tx => {
      // 检查订单是否存在
      const existingOrder = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!existingOrder) {
        throw new Error('订单不存在');
      }

      // 不能修改已完成的订单
      if (existingOrder.status === 'delivered') {
        throw new Error('不能修改已完成的订单');
      }

      // 使用增量更新策略更新订单项
      await updateSalesOrderItemsIncremental(
        tx,
        orderId,
        data.items,
        existingOrder.items
      );

      // 更新订单主表
      await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          customerId: data.customerId,
          supplierId: data.supplierId,
          orderType: data.orderType,
          status: data.status,
          totalAmount,
          costAmount,
          profitAmount,
          remarks: data.remarks,
        },
      });
    });

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);

    return { success: true, data: { id: orderId } };
  } catch (error) {
    logger.error('actions:sales-orders', '更新销售订单失败', error, {
      action: 'updateSalesOrder',
      orderId: orderIdForLog,
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新销售订单失败',
    };
  }
}
