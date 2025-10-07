'use server';

/**
 * 库存 Server Actions
 *
 * ✅ Next.js 15 最佳实践：使用 Server Actions 处理表单和数据变更
 *
 * 优势：
 * 1. 自动 CSRF 保护
 * 2. 减少客户端 JavaScript
 * 3. 更好的类型安全
 * 4. 自动错误处理
 * 5. 支持渐进式增强
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { inventoryAdjustSchema } from '@/lib/validations/inventory';
import { auth } from '@/lib/auth';

/**
 * 服务端操作结果类型
 */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

/**
 * 库存调整 Server Action
 *
 * @example
 * ```tsx
 * <form action={adjustInventory}>
 *   <input name="productId" />
 *   <input name="quantity" type="number" />
 *   <button type="submit">调整</button>
 * </form>
 * ```
 */
export async function adjustInventory(
  formData: FormData
): Promise<ActionResult<{ id: string; newQuantity: number }>> {
  try {
    // 1. 身份验证
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: '未授权：请先登录',
      };
    }

    // 2. 验证输入数据
    const rawData = {
      productId: formData.get('productId'),
      variantId: formData.get('variantId'),
      batchNumber: formData.get('batchNumber'),
      quantity: formData.get('quantity'),
      reason: formData.get('reason'),
      notes: formData.get('notes'),
    };

    const validationResult = inventoryAdjustSchema.safeParse(rawData);
    if (!validationResult.success) {
      return {
        success: false,
        error: '输入数据格式不正确',
        details: validationResult.error.issues,
      };
    }

    const data = validationResult.data;

    // 3. 执行数据库操作（事务）
    const result = await prisma.$transaction(async tx => {
      // 查找或创建库存记录
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: data.productId,
          variantId: data.variantId,
          batchNumber: data.batchNumber,
        },
      });

      if (!inventory) {
        // 创建新库存记录
        if (data.quantity < 0) {
          throw new Error('无法扣减不存在的库存');
        }

        const newInventory = await tx.inventory.create({
          data: {
            productId: data.productId,
            variantId: data.variantId,
            batchNumber: data.batchNumber,
            quantity: data.quantity,
            reservedQuantity: 0,
          },
        });

        // 记录调整记录
        await tx.inventoryAdjustment.create({
          data: {
            inventoryId: newInventory.id,
            adjustmentNumber: `ADJ-${Date.now()}`,
            quantity: data.quantity,
            reason: data.reason,
            notes: data.notes,
            operatorId: session.user.id,
            status: 'COMPLETED',
          },
        });

        return {
          id: newInventory.id,
          newQuantity: newInventory.quantity,
        };
      }

      // 更新现有库存
      const newQuantity = inventory.quantity + data.quantity;
      if (newQuantity < 0) {
        throw new Error('库存不足，无法扣减');
      }

      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity },
      });

      // 记录调整记录
      await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inventory.id,
          adjustmentNumber: `ADJ-${Date.now()}`,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes,
          operatorId: session.user.id,
          status: 'COMPLETED',
        },
      });

      return {
        id: updatedInventory.id,
        newQuantity: updatedInventory.quantity,
      };
    });

    // 4. 重新验证缓存
    revalidatePath('/inventory');
    revalidatePath('/inventory/adjustments');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('库存调整失败:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : '库存调整失败',
    };
  }
}

/**
 * 批量库存调整 Server Action
 */
export async function batchAdjustInventory(
  formData: FormData
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: '未授权' };
    }

    // 解析批量数据（JSON 字符串）
    const batchDataStr = formData.get('batchData') as string;
    if (!batchDataStr) {
      return { success: false, error: '缺少批量数据' };
    }

    const batchData = JSON.parse(batchDataStr);

    // 验证每条数据
    const validatedData = [];
    for (const item of batchData) {
      const result = inventoryAdjustSchema.safeParse(item);
      if (!result.success) {
        return {
          success: false,
          error: `数据验证失败: ${JSON.stringify(result.error.issues)}`,
        };
      }
      validatedData.push(result.data);
    }

    // 批量执行
    const results = await prisma.$transaction(
      validatedData.map(data =>
        prisma.inventory.update({
          where: {
            productId_variantId_batchNumber: {
              productId: data.productId,
              variantId: data.variantId ?? '',
              batchNumber: data.batchNumber ?? '',
            },
          },
          data: {
            quantity: { increment: data.quantity },
          },
        })
      )
    );

    revalidatePath('/inventory');

    return {
      success: true,
      data: { count: results.length },
    };
  } catch (error) {
    console.error('批量调整失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量调整失败',
    };
  }
}
