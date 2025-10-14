'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { returnRefundConfig } from '@/lib/env';
import type { SalesOrderStatus } from '@/lib/types/sales-order';

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

const ALLOWED_RETURN_SALES_ORDER_STATUSES: ReadonlyArray<SalesOrderStatus> = [
  'shipped',
  'completed',
];

// ============================================
// Zod 验证模式
// ============================================

const returnOrderItemSchema = z.object({
  salesOrderItemId: z.string().min(1, '请选择销售订单明细'),
  productId: z.string().min(1, '产品ID不能为空'),
  returnQuantity: z
    .number()
    .min(0.01, '退货数量必须大于0')
    .max(999999, '退货数量不能超过999999'),
  originalQuantity: z.number().min(0, '原始数量不能为负数'),
  unitPrice: z
    .number()
    .min(0, '单价不能为负数')
    .max(999999, '单价不能超过999999'),
  subtotal: z.number().min(0, '小计不能为负数'),
  reason: z.string().optional(),
  condition: z.enum(['good', 'damaged', 'defective']),
});

const createReturnOrderSchema = z.object({
  salesOrderId: z.string().min(1, '请选择关联的销售订单'),
  customerId: z.string().min(1, '客户ID不能为空'),
  type: z.enum([
    'quality_issue',
    'wrong_product',
    'customer_change',
    'damage_in_transit',
    'other',
  ]),
  processType: z.enum(['refund', 'exchange']),
  reason: z
    .string()
    .min(1, '退货原因不能为空')
    .max(500, '退货原因不能超过500字符'),
  remarks: z.string().max(1000, '备注不能超过1000字符').optional(),
  items: z
    .array(returnOrderItemSchema)
    .min(1, '至少需要一个退货明细')
    .max(100, '退货明细不能超过100项'),
});

const updateReturnOrderStatusSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单ID不能为空'),
  status: z.enum([
    'draft',
    'submitted',
    'approved',
    'rejected',
    'processing',
    'completed',
    'cancelled',
  ]),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
  refundAmount: z
    .number()
    .min(0, '退款金额不能为负数')
    .max(999999, '退款金额不能超过999999')
    .optional(),
});

const approveReturnOrderSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单ID不能为空'),
  approved: z.boolean(),
  refundAmount: z.number().min(0, '退款金额不能为负数').optional(),
  remarks: z.string().max(500, '审核备注不能超过500字符').optional(),
});

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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    const returnNumber = `${returnRefundConfig.returnOrderPrefix}${year}${month}${day}${timestamp}`;

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
    for (const item of data.items) {
      const salesOrderItem = salesOrder.items.find(
        si => si.id === item.salesOrderItemId
      );

      if (!salesOrderItem) {
        return { success: false, error: '销售订单明细不存在' };
      }

      if (item.returnQuantity > salesOrderItem.quantity) {
        return { success: false, error: '退货数量不能超过原始数量' };
      }
    }

    // 7. 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    // 8. 创建退货订单（事务）
    const result = await prisma.$transaction(async tx => {
      const returnOrder = await tx.returnOrder.create({
        data: {
          returnNumber,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          userId: session.user.id,
          type: data.type,
          processType: data.processType,
          status: 'draft',
          reason: data.reason,
          remarks: data.remarks,
          totalAmount,
          refundAmount: 0, // 初始退款金额为0，审核通过后设置
          items: {
            create: data.items.map(item => ({
              salesOrderItemId: item.salesOrderItemId,
              productId: item.productId,
              returnQuantity: item.returnQuantity,
              originalQuantity: item.originalQuantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              reason: item.reason,
              condition: item.condition,
            })),
          },
        },
      });

      return returnOrder;
    });

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
    console.error('创建退货订单失败:', error);
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      returnOrderId: formData.get('returnOrderId') as string,
      status: formData.get('status') as string,
      remarks: formData.get('remarks') as string,
      refundAmount: formData.get('refundAmount')
        ? parseFloat(formData.get('refundAmount') as string)
        : undefined,
    };

    const data = updateReturnOrderStatusSchema.parse(rawData);

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
    const validTransitions: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['approved', 'rejected', 'cancelled'],
      approved: ['processing', 'cancelled'],
      rejected: ['cancelled'],
      processing: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[returnOrder.status]?.includes(data.status)) {
      return {
        success: false,
        error: `不能从 ${returnOrder.status} 状态变更为 ${data.status} 状态`,
      };
    }

    // 使用事务更新状态
    await prisma.$transaction(async tx => {
      // 更新退货订单状态
      await tx.returnOrder.update({
        where: { id: data.returnOrderId },
        data: {
          status: data.status,
          refundAmount: data.refundAmount ?? returnOrder.refundAmount,
          remarks: data.remarks
            ? `${returnOrder.remarks || ''}\n${data.remarks}`
            : returnOrder.remarks,
        },
      });

      // 如果状态变更为 completed，恢复库存
      if (data.status === 'completed') {
        for (const item of returnOrder.items) {
          if ((item.damagedQuantity ?? 0) === 0) {
            // 只有无破损的商品才恢复库存
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: {
                quantity: {
                  increment: item.returnQuantity,
                },
              },
            });
          }
        }
      }
    });

    revalidatePath('/return-orders');
    revalidatePath(`/return-orders/${data.returnOrderId}`);
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${returnOrder.salesOrderId}`);
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${returnOrder.salesOrderId}`);

    return { success: true };
  } catch (error) {
    console.error('更新退货订单状态失败:', error);
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
    console.error('审核退货订单失败:', error);
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
    console.error('取消退货订单失败:', error);
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
    console.error('删除退货订单失败:', error);
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const returnOrderIds = JSON.parse(
      formData.get('returnOrderIds') as string
    ) as string[];
    const action = formData.get('action') as string;

    if (!returnOrderIds || returnOrderIds.length === 0) {
      return { success: false, error: '未选择退货订单' };
    }

    if (returnOrderIds.length > 50) {
      return { success: false, error: '批量操作不能超过50个订单' };
    }

    // 根据操作类型执行不同的逻辑
    const affectedSalesOrderIds = new Set<string>();

    await prisma.$transaction(async tx => {
      const orders = await tx.returnOrder.findMany({
        where: { id: { in: returnOrderIds } },
        select: { id: true, salesOrderId: true },
      });

      orders.forEach(order => {
        if (order.salesOrderId) {
          affectedSalesOrderIds.add(order.salesOrderId);
        }
      });

      if (action === 'cancel') {
        // 批量取消
        await tx.returnOrder.updateMany({
          where: {
            id: { in: returnOrderIds },
            status: { notIn: ['completed', 'cancelled'] },
          },
          data: { status: 'cancelled' },
        });
      } else if (action === 'approve') {
        // 批量批准（仅限提交状态）
        await tx.returnOrder.updateMany({
          where: {
            id: { in: returnOrderIds },
            status: 'submitted',
          },
          data: { status: 'approved' },
        });
      } else if (action === 'reject') {
        // 批量拒绝（仅限提交状态）
        await tx.returnOrder.updateMany({
          where: {
            id: { in: returnOrderIds },
            status: 'submitted',
          },
          data: { status: 'rejected' },
        });
      } else {
        throw new Error('无效的操作类型');
      }
    });

    revalidatePath('/return-orders');
    revalidatePath('/sales-orders');
    affectedSalesOrderIds.forEach(salesOrderId => {
      revalidatePath(`/sales-orders/${salesOrderId}`);
    });

    return { success: true };
  } catch (error) {
    console.error('批量更新退货订单状态失败:', error);
    return { success: false, error: '批量更新退货订单状态失败' };
  }
}

/**
 * 批量删除退货订单
 */
export async function batchDeleteReturnOrders(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const returnOrderIds = JSON.parse(
      formData.get('returnOrderIds') as string
    ) as string[];

    if (!returnOrderIds || returnOrderIds.length === 0) {
      return { success: false, error: '未选择退货订单' };
    }

    const affectedSalesOrderIds = new Set<string>();

    await prisma.$transaction(async tx => {
      // 检查所有订单的状态
      const returnOrders = await tx.returnOrder.findMany({
        where: { id: { in: returnOrderIds } },
      });

      for (const order of returnOrders) {
        if (order.status !== 'draft' && order.status !== 'cancelled') {
          throw new Error(
            `退货订单 "${order.returnNumber}" 不是草稿或已取消状态，无法批量删除`
          );
        }
      }

      // 删除所有退货订单明细
      await tx.returnOrderItem.deleteMany({
        where: { returnOrderId: { in: returnOrderIds } },
      });

      // 删除所有退货订单
      await tx.returnOrder.deleteMany({
        where: { id: { in: returnOrderIds } },
      });

      returnOrders.forEach(order => {
        if (order.salesOrderId) {
          affectedSalesOrderIds.add(order.salesOrderId);
        }
      });
    });

    revalidatePath('/return-orders');
    revalidatePath('/sales-orders');
    affectedSalesOrderIds.forEach(salesOrderId => {
      revalidatePath(`/sales-orders/${salesOrderId}`);
    });

    return { success: true };
  } catch (error) {
    console.error('批量删除退货订单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量删除退货订单失败',
    };
  }
}
