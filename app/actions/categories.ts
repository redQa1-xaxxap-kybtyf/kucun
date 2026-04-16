'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 分类管理模块 Server Actions
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

const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符'),
  code: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0, '排序顺序不能为负').default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符')
    .optional(),
  code: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0, '排序顺序不能为负').optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateCategoryStatusSchema = z.object({
  categoryId: z.string().min(1, '分类不能为空'),
  status: z.enum(['active', 'inactive']),
});

const CATEGORY_CODE_SANITIZE_REGEX = /[^a-zA-Z0-9]/g;

function generateCategoryCode(name: string): string {
  const cleanName = name
    .replace(CATEGORY_CODE_SANITIZE_REGEX, '')
    .toUpperCase();
  const base = cleanName || 'CATEGORY';
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

// ============================================
// Server Actions
// ============================================

/**
 * 创建分类
 */
export async function createCategory(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    // 1. 身份认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawPayload = formData.get('data');
    if (typeof rawPayload !== 'string') {
      return { success: false, error: '提交数据格式不正确' };
    }
    const rawData = JSON.parse(rawPayload) as unknown;
    const data = createCategorySchema.parse(rawData);

    // 3. 检查分类编码是否已存在（如果提供了编码）
    const normalizedCode = data.code?.trim();
    if (normalizedCode) {
      const existingCategory = await prisma.category.findUnique({
        where: { code: normalizedCode },
      });

      if (existingCategory) {
        return { success: false, error: '分类编码已存在' };
      }
    }

    // 4. 检查父级分类是否存在（如果提供了父级ID）
    if (data.parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: data.parentId },
      });

      if (!parentCategory) {
        return { success: false, error: '父级分类不存在' };
      }

      // 检查父级分类是否为活跃状态
      if (parentCategory.status !== 'active') {
        return { success: false, error: '父级分类未启用，无法添加子分类' };
      }
    }

    // 5. 创建分类
    const categoryData: Prisma.CategoryUncheckedCreateInput = {
      name: data.name,
      code: normalizedCode || generateCategoryCode(data.name),
      sortOrder: data.sortOrder,
      status: data.status,
      parentId: data.parentId ?? null,
    };

    const category = await prisma.category.create({
      data: categoryData,
    });

    // 6. 重新验证路径
    revalidatePath('/categories');

    return {
      success: true,
      data: { id: category.id, name: category.name },
    };
  } catch (error) {
    logger.error('actions:categories', '创建分类失败', error, {
      action: 'createCategory',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建分类失败' };
  }
}

/**
 * 更新分类
 */
export async function updateCategory(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  let categoryIdForLog: string | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const categoryIdValue = formData.get('categoryId');
    if (typeof categoryIdValue !== 'string' || !categoryIdValue) {
      return { success: false, error: '分类不能为空' };
    }
    categoryIdForLog = categoryIdValue;
    const categoryId = categoryIdValue;

    const rawPayload = formData.get('data');
    if (typeof rawPayload !== 'string') {
      return { success: false, error: '提交数据格式不正确' };
    }
    const rawData = JSON.parse(rawPayload) as unknown;
    const data = updateCategorySchema.parse(rawData);

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: true,
      },
    });

    if (!existingCategory) {
      return { success: false, error: '分类不存在' };
    }

    // 如果修改了分类编码，检查新编码是否已存在
    const updatedCode = data.code?.trim();
    if (updatedCode && updatedCode !== existingCategory.code) {
      const codeExists = await prisma.category.findUnique({
        where: { code: updatedCode },
      });

      if (codeExists) {
        return { success: false, error: '分类编码已存在' };
      }
    }

    // 如果修改了父级分类
    if (data.parentId !== undefined) {
      // 不能将分类设置为自己的子分类
      if (data.parentId === categoryId) {
        return { success: false, error: '不能将分类设置为自己的子分类' };
      }

      // 如果提供了父级ID，检查父级分类是否存在
      if (data.parentId) {
        const parentCategory = await prisma.category.findUnique({
          where: { id: data.parentId },
        });

        if (!parentCategory) {
          return { success: false, error: '父级分类不存在' };
        }

        // 检查是否会形成循环引用（父级分类不能是当前分类的子分类）
        let currentParent = parentCategory;
        while (currentParent.parentId) {
          if (currentParent.parentId === categoryId) {
            return { success: false, error: '不能选择子分类作为父级分类' };
          }
          const nextParent = await prisma.category.findUnique({
            where: { id: currentParent.parentId },
          });
          if (!nextParent) {
            break;
          }
          currentParent = nextParent;
        }
      }
    }

    // 更新分类
    const updateData: Prisma.CategoryUncheckedUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (updatedCode !== undefined) {
      updateData.code = updatedCode;
    }
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId ?? null;
    }
    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });

    revalidatePath('/categories');
    revalidatePath(`/categories/${categoryId}`);

    return {
      success: true,
      data: { id: category.id, name: category.name },
    };
  } catch (error) {
    logger.error('actions:categories', '更新分类失败', error, {
      action: 'updateCategory',
      categoryId: categoryIdForLog,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '更新分类失败' };
  }
}

/**
 * 更新分类状态
 */
export async function updateCategoryStatus(
  formData: FormData
): Promise<ActionResult> {
  let categoryIdForLog: string | undefined;
  let statusForLog: 'active' | 'inactive' | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const categoryId = formData.get('categoryId');
    const status = formData.get('status');
    const rawData = {
      categoryId: typeof categoryId === 'string' ? categoryId : '',
      status: typeof status === 'string' ? status : '',
    };

    const data = updateCategoryStatusSchema.parse(rawData);
    categoryIdForLog = data.categoryId;
    statusForLog = data.status;

    // 检查分类是否存在
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      include: {
        children: true,
        products: true,
      },
    });

    if (!category) {
      return { success: false, error: '分类不存在' };
    }

    // 如果要停用分类，检查是否有子分类或关联产品
    if (data.status === 'inactive') {
      if (category.children.length > 0) {
        return { success: false, error: '该分类下有子分类，无法停用' };
      }

      const activeProducts = category.products.filter(
        p => p.status === 'active'
      );
      if (activeProducts.length > 0) {
        return {
          success: false,
          error: `该分类下有 ${activeProducts.length} 个活跃产品，无法停用`,
        };
      }
    }

    await prisma.category.update({
      where: { id: data.categoryId },
      data: { status: data.status },
    });

    revalidatePath('/categories');
    revalidatePath(`/categories/${data.categoryId}`);

    return { success: true };
  } catch (error) {
    logger.error('actions:categories', '更新分类状态失败', error, {
      action: 'updateCategoryStatus',
      categoryId: categoryIdForLog,
      status: statusForLog,
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '更新分类状态失败' };
  }
}

/**
 * 删除分类
 */
export async function deleteCategory(
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查分类是否存在
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        include: {
          children: true,
          products: true,
        },
      });

      if (!category) {
        throw new Error('分类不存在');
      }

      // 检查是否有子分类
      if (category.children.length > 0) {
        throw new Error('该分类下有子分类，无法删除');
      }

      // 检查是否有关联产品
      if (category.products.length > 0) {
        throw new Error(
          `该分类下有 ${category.products.length} 个产品，无法删除`
        );
      }

      // 删除分类
      await tx.category.delete({
        where: { id: categoryId },
      });
    });

    revalidatePath('/categories');

    return { success: true };
  } catch (error) {
    logger.error('actions:categories', '删除分类失败', error, {
      action: 'deleteCategory',
      categoryId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除分类失败',
    };
  }
}

/**
 * 批量更新分类状态
 */
export async function batchUpdateCategoryStatus(
  formData: FormData
): Promise<ActionResult> {
  let categoryIds: string[] = [];
  let status: 'active' | 'inactive' | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    categoryIds = JSON.parse(formData.get('categoryIds') as string) as string[];
    status = formData.get('status') as 'active' | 'inactive';

    if (!categoryIds || categoryIds.length === 0) {
      return { success: false, error: '未选择分类' };
    }

    // 如果要停用分类，需要检查每个分类
    if (status === 'inactive') {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: {
          id: true,
          name: true,
          children: {
            select: { id: true },
            take: 1,
          },
          products: {
            where: { status: 'active' },
            select: { id: true },
            take: 1,
          },
        },
        take: categoryIds.length,
      });

      for (const category of categories) {
        if (category.children.length > 0) {
          return {
            success: false,
            error: `分类 "${category.name}" 下有子分类，无法批量停用`,
          };
        }

        if (category.products.length > 0) {
          const activeProductCount = await prisma.product.count({
            where: {
              categoryId: category.id,
              status: 'active',
            },
          });
          return {
            success: false,
            error: `分类 "${category.name}" 下有 ${activeProductCount} 个活跃产品，无法批量停用`,
          };
        }
      }
    }

    await prisma.category.updateMany({
      where: { id: { in: categoryIds } },
      data: { status },
    });

    revalidatePath('/categories');

    return { success: true };
  } catch (error) {
    logger.error('actions:categories', '批量更新分类状态失败', error, {
      action: 'bulkUpdateCategoryStatus',
      categoryCount: categoryIds.length || undefined,
      status,
    });
    return { success: false, error: '批量更新分类状态失败' };
  }
}
