'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
      if (
        !item.manualProductName ||
        item.manualProductName.trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '手动输入商品必须填写商品名称',
          path: ['manualProductName'],
        });
      }
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

    // 4. 数据库事务
    const result = await prisma.$transaction(async tx => {
      // 生成订单号
      const count = await tx.salesOrder.count();
      const orderNumber = `SO${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

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
    console.error('创建销售订单失败:', error);
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      orderId: formData.get('orderId') as string,
      status: formData.get('status') as string,
    };

    const data = updateSalesOrderStatusSchema.parse(rawData);

    await prisma.$transaction(async tx => {
      // 获取订单详情
      const order = await tx.salesOrder.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      // 更新订单状态
      await tx.salesOrder.update({
        where: { id: data.orderId },
        data: { status: data.status },
      });

      // 如果从草稿变为已确认，减少库存
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
          }
        }
      }

      // 如果从已确认变为取消，恢复库存
      if (order.status === 'confirmed' && data.status === 'cancelled') {
        for (const item of order.items) {
          if (item.productId && !item.isManualProduct) {
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: {
                quantity: {
                  increment: item.quantity,
                },
              },
            });
          }
        }
      }
    });

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${data.orderId}`);

    return { success: true };
  } catch (error) {
    console.error('更新订单状态失败:', error);
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
    console.error('删除订单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除订单失败',
    };
  }
}

/**
 * 更新销售订单
 */
export async function updateSalesOrder(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const orderId = formData.get('orderId') as string;
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

      // 删除旧的订单项
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: orderId },
      });

      // 更新订单
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
    });

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);

    return { success: true, data: { id: orderId } };
  } catch (error) {
    console.error('更新销售订单失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新销售订单失败',
    };
  }
}
