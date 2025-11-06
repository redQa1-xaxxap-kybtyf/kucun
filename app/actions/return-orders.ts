'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { returnRefundConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { SalesOrderStatus } from '@/lib/types/sales-order';
import { withIdempotency } from '@/lib/utils/idempotency';

import {
  ALLOWED_RETURN_SALES_ORDER_STATUSES,
  approveReturnOrderSchema,
  createReturnOrderSchema,
  updateReturnOrderStatusSchema,
} from './return-orders.schemas';

/**
 * 退货订单管理模块 Server Actions
 *
 * ✅ Next.js 15 最佳实践：
 * 1. 'use server' 指令
 * 2. Zod 参数验证
 * 3. 身份认证检查
 * 4. Prisma 事务处理
 * 5. 路径重新验证
 * 6. 幂等性保证
 */

// ============================================
// 类型定义
// ============================================

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Zod 模式与允许状态已拆分到 return-orders.schemas.ts

// ============================================
// Server Actions
// ============================================

/**
 * 创建退货订单
 */
export async function createReturnOrder(
  formData: FormData
): Promise<ActionResult<{ id: string; returnNumber: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createReturnOrderSchema.parse(rawData);

    // 3. 生成退货单号
    const { generateReturnNumber } = await import('./return-orders.utils');
    const returnNumber = generateReturnNumber(
      returnRefundConfig.returnOrderPrefix
    );

    // 4. 验证销售订单存在
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      include: {
        items: true,
      },
    });

    if (!salesOrder) {
      return { success: false, error: '关联的销售订单不存在' };
    }

    // 5. 验证销售订单状态（仅允许已发货及之后的订单退货）
    const orderStatus = salesOrder.status as SalesOrderStatus;
    if (!ALLOWED_RETURN_SALES_ORDER_STATUSES.includes(orderStatus)) {
      return {
        success: false,
        error: `销售订单尚未发货，无法创建退货单（当前状态：${salesOrder.status}）`,
      };
    }

    // 6. 验证退货数量不超过原始数量
    {
      const { validateReturnQuantities } = await import(
        './return-orders.utils'
      );
      const err = validateReturnQuantities(
        data.items.map(i => ({
          salesOrderItemId: i.salesOrderItemId,
          returnQuantity: i.returnQuantity,
        })),
        salesOrder.items.map(i => ({ id: i.id, quantity: i.quantity }))
      );
      if (err) return { success: false, error: err };
    }

    // 7. 计算总金额
    const { calcTotalAmount, createReturnOrderTx } = await import(
      './return-orders.utils'
    );
    const totalAmount = calcTotalAmount(
      data.items.map(i => ({ subtotal: i.subtotal }))
    );

    // 8. 创建退货订单（事务）
    const result = await prisma.$transaction(
      async tx =>
        await createReturnOrderTx(
          tx,
          {
            salesOrderId: data.salesOrderId,
            customerId: data.customerId,
            userId: session.user.id,
            type: data.type,
            processType: data.processType,
            reason: data.reason,
            remarks: data.remarks,
            items: data.items,
          },
          returnNumber,
          totalAmount
        )
    );

    // 8. 重新验证路径
    revalidatePath('/return-orders');
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${data.salesOrderId}`);

    return {
      success: true,
      data: {
        id: result.id,
        returnNumber: result.returnNumber,
      },
    };
  } catch (error) {
    logger.error('actions:return-orders', '创建退货订单失败', error, {
      action: 'createReturnOrder',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '创建退货订单失败' };
  }
}

/**
 * 更新退货订单状态
 */
export async function updateReturnOrderStatus(
  formData: FormData
): Promise<ActionResult> {
  let returnOrderId: string | undefined;
  let nextStatus: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const idempotencyKeyRaw = formData.get('idempotencyKey');
    const rawData = {
      returnOrderId: formData.get('returnOrderId') as string,
      status: formData.get('status') as string,
      remarks: formData.get('remarks') as string,
      refundAmount: formData.get('refundAmount')
        ? parseFloat(formData.get('refundAmount') as string)
        : undefined,
      idempotencyKey:
        typeof idempotencyKeyRaw === 'string' ? idempotencyKeyRaw : undefined,
    };

    const data = updateReturnOrderStatusSchema.parse({
      ...rawData,
      idempotencyKey:
        rawData.idempotencyKey && rawData.idempotencyKey.trim().length > 0
          ? rawData.idempotencyKey.trim()
          : undefined,
    });
    returnOrderId = data.returnOrderId;
    nextStatus = data.status;

    // 检查退货订单是否存在
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: data.returnOrderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!returnOrder) {
      return { success: false, error: '退货订单不存在' };
    }

    // 验证状态流转
    const { canTransition, applyCompletionEffects, mergeRemarks } =
      await import('./return-orders.utils');
    if (!canTransition(returnOrder.status, data.status)) {
      return {
        success: false,
        error: `不能从 ${returnOrder.status} 状态变更为 ${data.status} 状态`,
      };
    }

    const fallbackIdempotencyKey = `return-order-status:${returnOrder.id}:${returnOrder.status}->${data.status}:${returnOrder.updatedAt?.getTime() ?? Date.now()}`;
    const resolvedIdempotencyKey =
      data.idempotencyKey ?? fallbackIdempotencyKey;

    const operationResult = await withIdempotency(
      resolvedIdempotencyKey,
      'return_order_status_change',
      returnOrder.id,
      session.user.id,
      {
        previousStatus: returnOrder.status,
        nextStatus: data.status,
      },
      async () =>
        await prisma.$transaction(async tx => {
          await tx.returnOrder.update({
            where: { id: data.returnOrderId },
            data: {
              status: data.status,
              refundAmount: data.refundAmount ?? returnOrder.refundAmount,
              remarks: mergeRemarks(returnOrder.remarks, data.remarks),
            },
          });

          let inboundResults: Array<{ productId: string }> = [];

          if (data.status === 'completed') {
            inboundResults = await applyCompletionEffects(
              tx,
              {
                returnNumber: returnOrder.returnNumber,
                items: returnOrder.items,
              },
              session.user.id
            );
          }

          return { inboundResults };
        })
    );

    if (
      operationResult?.inboundResults &&
      operationResult.inboundResults.length > 0
    ) {
      const productIds = Array.from(
        new Set(operationResult.inboundResults.map(record => record.productId))
      );
      await Promise.allSettled([
        ...productIds.map(id => invalidateInventoryCache(id)),
        ...productIds.map(id => revalidateProducts(id)),
      ]);
    }

    revalidatePath('/return-orders');
    revalidatePath(`/return-orders/${data.returnOrderId}`);
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${returnOrder.salesOrderId}`);
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${returnOrder.salesOrderId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '更新退货订单状态失败', error, {
      action: 'updateReturnOrderStatus',
      returnOrderId,
      status: nextStatus,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '更新退货订单状态失败' };
  }
}

/**
 * 审核退货订单（批准/拒绝）
 */
export async function approveReturnOrder(
  formData: FormData
): Promise<ActionResult> {
  let returnOrderId: string | undefined;
  let approved: boolean | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      returnOrderId: formData.get('returnOrderId') as string,
      approved: formData.get('approved') === 'true',
      refundAmount: formData.get('refundAmount')
        ? parseFloat(formData.get('refundAmount') as string)
        : undefined,
      remarks: formData.get('remarks') as string,
    };

    const data = approveReturnOrderSchema.parse(rawData);
    returnOrderId = data.returnOrderId;
    approved = data.approved;

    // 检查退货订单是否存在
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: data.returnOrderId },
    });

    if (!returnOrder) {
      return { success: false, error: '退货订单不存在' };
    }

    // 只有 submitted 状态的订单才能审核
    if (returnOrder.status !== 'submitted') {
      return { success: false, error: '只有已提交的退货订单才能审核' };
    }

    // 如果批准，必须设置退款金额
    if (data.approved && !data.refundAmount) {
      return { success: false, error: '批准退货时必须设置退款金额' };
    }

    // 验证退款金额不超过总金额
    if (data.refundAmount && data.refundAmount > returnOrder.totalAmount) {
      return { success: false, error: '退款金额不能超过退货总金额' };
    }

    // 更新状态
    await prisma.$transaction(async tx => {
      await tx.returnOrder.update({
        where: { id: data.returnOrderId },
        data: {
          status: data.approved ? 'approved' : 'rejected',
          refundAmount: data.approved ? data.refundAmount : 0,
          remarks: data.remarks
            ? `${returnOrder.remarks || ''}\n审核备注: ${data.remarks}`
            : returnOrder.remarks,
        },
      });
    });

    revalidatePath('/return-orders');
    revalidatePath(`/return-orders/${data.returnOrderId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '审核退货订单失败', error, {
      action: 'approveReturnOrder',
      returnOrderId,
      approved,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '审核退货订单失败' };
  }
}

/**
 * 取消退货订单
 */
export async function cancelReturnOrder(
  returnOrderId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 检查退货订单是否存在
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: returnOrderId },
    });

    if (!returnOrder) {
      return { success: false, error: '退货订单不存在' };
    }

    // 已完成的订单不能取消
    if (returnOrder.status === 'completed') {
      return { success: false, error: '已完成的退货订单不能取消' };
    }

    // 已取消的订单不能重复取消
    if (returnOrder.status === 'cancelled') {
      return { success: false, error: '退货订单已取消' };
    }

    // 取消订单
    await prisma.$transaction(async tx => {
      await tx.returnOrder.update({
        where: { id: returnOrderId },
        data: {
          status: 'cancelled',
        },
      });
    });

    revalidatePath('/return-orders');
    revalidatePath(`/return-orders/${returnOrderId}`);
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${returnOrder.salesOrderId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '取消退货订单失败', error, {
      action: 'cancelReturnOrder',
      returnOrderId,
    });
    return { success: false, error: '取消退货订单失败' };
  }
}

/**
 * 删除退货订单
 */
export async function deleteReturnOrder(
  returnOrderId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    let relatedSalesOrderId: string | null = null;

    await prisma.$transaction(async tx => {
      // 检查退货订单是否存在
      const returnOrder = await tx.returnOrder.findUnique({
        where: { id: returnOrderId },
      });

      if (!returnOrder) {
        throw new Error('退货订单不存在');
      }

      // 只有草稿和已取消的订单才能删除
      if (
        returnOrder.status !== 'draft' &&
        returnOrder.status !== 'cancelled'
      ) {
        throw new Error('只有草稿和已取消的退货订单才能删除');
      }

      relatedSalesOrderId = returnOrder.salesOrderId;

      // 删除退货订单明细
      await tx.returnOrderItem.deleteMany({
        where: { returnOrderId },
      });

      // 删除退货订单
      await tx.returnOrder.delete({
        where: { id: returnOrderId },
      });
    });

    revalidatePath('/return-orders');
    if (relatedSalesOrderId) {
      revalidatePath(`/sales-orders/${relatedSalesOrderId}`);
    }
    revalidatePath('/sales-orders');

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '删除退货订单失败', error, {
      action: 'deleteReturnOrder',
      returnOrderId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除退货订单失败',
    };
  }
}

/**
 * 批量更新退货订单状态
 */
export async function batchUpdateReturnOrderStatus(
  formData: FormData
): Promise<ActionResult> {
  let returnOrderIds: string[] = [];
  let batchAction: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    returnOrderIds = JSON.parse(
      formData.get('returnOrderIds') as string
    ) as string[];
    batchAction = formData.get('action') as string;

    if (!returnOrderIds || returnOrderIds.length === 0) {
      return { success: false, error: '未选择退货订单' };
    }

    if (returnOrderIds.length > 50) {
      return { success: false, error: '批量操作不能超过50个订单' };
    }

    // 根据操作类型执行不同的逻辑
    const { batchUpdateReturnOrderStatusTx } = await import(
      './return-orders.utils'
    );
    const affectedSalesOrderIds = await prisma.$transaction(
      async tx =>
        await batchUpdateReturnOrderStatusTx(
          tx,
          returnOrderIds,
          batchAction as 'cancel' | 'approve' | 'reject'
        )
    );

    revalidatePath('/return-orders');
    revalidatePath('/sales-orders');
    affectedSalesOrderIds.forEach(salesOrderId => {
      revalidatePath(`/sales-orders/${salesOrderId}`);
    });

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '批量更新退货订单状态失败', error, {
      action: 'batchUpdateReturnOrderStatus',
      batchAction,
      count: returnOrderIds.length || undefined,
    });
    return { success: false, error: '批量更新退货订单状态失败' };
  }
}

/**
 * 批量删除退货订单
 */
export async function batchDeleteReturnOrders(
  formData: FormData
): Promise<ActionResult> {
  let returnOrderIds: string[] = [];

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    returnOrderIds = JSON.parse(
      formData.get('returnOrderIds') as string
    ) as string[];

    if (!returnOrderIds || returnOrderIds.length === 0) {
      return { success: false, error: '未选择退货订单' };
    }

    const { batchDeleteReturnOrdersTx } = await import('./return-orders.utils');
    await prisma.$transaction(async tx =>
      batchDeleteReturnOrdersTx(tx, returnOrderIds)
    );

    revalidatePath('/return-orders');
    revalidatePath('/sales-orders');

    return { success: true };
  } catch (error) {
    logger.error('actions:return-orders', '批量删除退货订单失败', error, {
      action: 'batchDeleteReturnOrders',
      count: returnOrderIds.length || undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量删除退货订单失败',
    };
  }
}
