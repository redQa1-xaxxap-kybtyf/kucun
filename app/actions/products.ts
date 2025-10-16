'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * 产品模块 Server Actions
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

function isValidUrlOrPath(value: string): boolean {
  if (!value) {
    return true;
  }

  if (value.startsWith('/')) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const createProductSchema = z.object({
  code: z.string().min(1, '产品编码不能为空'),
  name: z.string().min(1, '产品名称不能为空'),
  unit: z.string().min(1, '计量单位不能为空'),
  categoryId: z.string().optional(),
  specification: z.string().optional(),
  description: z.string().optional(),
  piecesPerUnit: z.number().int().positive('每件片数必须为正整数').optional(),
  weight: z.number().nonnegative('重量不能为负').optional(),
  thickness: z.number().nonnegative('厚度不能为负').optional(),
  thumbnailUrl: z
    .string()
    .trim()
    .refine(isValidUrlOrPath, '缩略图地址格式不正确')
    .optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateProductSchema = createProductSchema.partial();

const updateProductStatusSchema = z.object({
  productId: z.string().min(1, '产品 ID 不能为空'),
  status: z.enum(['active', 'inactive']),
});

// ============================================
// Server Actions
// ============================================

/**
 * 创建产品
 */
export async function createProduct(
  formData: FormData
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createProductSchema.parse(rawData);

    // 3. 检查产品编码是否已存在
    const existingProduct = await prisma.product.findUnique({
      where: { code: data.code },
    });

    if (existingProduct) {
      return { success: false, error: '产品编码已存在' };
    }

    // 4. 数据库事务
    const result = await prisma.$transaction(async tx => {
      // 创建产品
      const product = await tx.product.create({
        data: {
          code: data.code,
          name: data.name,
          unit: data.unit,
          categoryId: data.categoryId ?? null,
          specification: data.specification ?? null,
          description: data.description ?? null,
          piecesPerUnit: data.piecesPerUnit ?? 1,
          weight: data.weight ?? null,
          thickness: data.thickness ?? null,
          thumbnailUrl: data.thumbnailUrl ?? null,
          status: data.status,
        },
      });

      return product;
    });

    // 5. 重新验证路径
    revalidatePath('/products');
    revalidatePath('/inventory');

    return {
      success: true,
      data: { id: result.id, code: result.code },
    };
  } catch (error) {
    console.error('创建产品失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '创建产品失败' };
  }
}

/**
 * 更新产品
 */
export async function updateProduct(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const productId = formData.get('productId') as string;
    const rawData = JSON.parse(formData.get('data') as string);
    const data = updateProductSchema.parse(rawData);

    // 检查产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return { success: false, error: '产品不存在' };
    }

    // 如果修改了产品编码，检查新编码是否已存在
    if (data.code && data.code !== existingProduct.code) {
      const codeExists = await prisma.product.findUnique({
        where: { code: data.code },
      });

      if (codeExists) {
        return { success: false, error: '产品编码已存在' };
      }
    }

    await prisma.$transaction(async tx => {
      // 更新产品
      await tx.product.update({
        where: { id: productId },
        data: {
          ...(data.code ? { code: data.code } : {}),
          ...(data.name ? { name: data.name } : {}),
          ...(data.unit ? { unit: data.unit } : {}),
          ...(data.categoryId !== undefined
            ? { categoryId: data.categoryId || null }
            : {}),
          ...(data.specification !== undefined
            ? { specification: data.specification || null }
            : {}),
          ...(data.description !== undefined
            ? { description: data.description || null }
            : {}),
          ...(data.piecesPerUnit !== undefined
            ? { piecesPerUnit: data.piecesPerUnit }
            : {}),
          ...(data.weight !== undefined ? { weight: data.weight ?? null } : {}),
          ...(data.thickness !== undefined
            ? { thickness: data.thickness ?? null }
            : {}),
          ...(data.thumbnailUrl !== undefined
            ? { thumbnailUrl: data.thumbnailUrl || null }
            : {}),
          ...(data.status ? { status: data.status } : {}),
        },
      });
    });

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    revalidatePath('/inventory');

    return { success: true, data: { id: productId } };
  } catch (error) {
    console.error('更新产品失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '更新产品失败' };
  }
}

/**
 * 更新产品状态
 */
export async function updateProductStatus(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      productId: formData.get('productId') as string,
      status: formData.get('status') as string,
    };

    const data = updateProductStatusSchema.parse(rawData);

    await prisma.product.update({
      where: { id: data.productId },
      data: { status: data.status },
    });

    revalidatePath('/products');
    revalidatePath(`/products/${data.productId}`);

    return { success: true };
  } catch (error) {
    console.error('更新产品状态失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '输入数据格式不正确',
      };
    }
    return { success: false, error: '更新产品状态失败' };
  }
}

/**
 * 删除产品
 */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查产品是否存在
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('产品不存在');
      }

      // 检查产品是否被使用
      const inventoryCount = await tx.inventory.count({
        where: {
          productId,
          quantity: { gt: 0 },
        },
      });

      if (inventoryCount > 0) {
        throw new Error('产品有库存，无法删除');
      }

      const salesOrderItemCount = await tx.salesOrderItem.count({
        where: { productId },
      });

      if (salesOrderItemCount > 0) {
        throw new Error('产品已被销售订单使用，无法删除');
      }

      // 删除库存记录
      await tx.inventory.deleteMany({
        where: { productId },
      });

      // 删除产品
      await tx.product.delete({
        where: { id: productId },
      });
    });

    revalidatePath('/products');
    revalidatePath('/inventory');

    return { success: true };
  } catch (error) {
    console.error('删除产品失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除产品失败',
    };
  }
}

/**
 * 批量更新产品状态
 */
export async function batchUpdateProductStatus(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const productIds = JSON.parse(
      formData.get('productIds') as string
    ) as string[];
    const status = formData.get('status') as 'active' | 'inactive';

    if (!productIds || productIds.length === 0) {
      return { success: false, error: '未选择产品' };
    }

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { status },
    });

    revalidatePath('/products');

    return { success: true };
  } catch (error) {
    console.error('批量更新产品状态失败:', error);
    return { success: false, error: '批量更新产品状态失败' };
  }
}
