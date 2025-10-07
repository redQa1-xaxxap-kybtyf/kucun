'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
  categoryId: z.string().min(1, '分类 ID 不能为空'),
  status: z.enum(['active', 'inactive']),
});

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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createCategorySchema.parse(rawData);

    // 3. 检查分类编码是否已存在（如果提供了编码）
    if (data.code) {
      const existingCategory = await prisma.category.findUnique({
        where: { code: data.code },
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
    const category = await prisma.category.create({
      data: {
        name: data.name,
        code: data.code,
        parentId: data.parentId,
        sortOrder: data.sortOrder,
        status: data.status,
      },
    });

    // 6. 重新验证路径
    revalidatePath('/categories');

    return {
      success: true,
      data: { id: category.id, name: category.name },
    };
  } catch (error) {
    console.error('创建分类失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const categoryId = formData.get('categoryId') as string;
    const rawData = JSON.parse(formData.get('data') as string);
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
    if (data.code && data.code !== existingCategory.code) {
      const codeExists = await prisma.category.findUnique({
        where: { code: data.code },
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
          if (!nextParent) {break;}
          currentParent = nextParent;
        }
      }
    }

    // 更新分类
    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: data.name,
        code: data.code,
        parentId: data.parentId === null ? undefined : data.parentId,
        sortOrder: data.sortOrder,
        status: data.status,
      },
    });

    revalidatePath('/categories');
    revalidatePath(`/categories/${categoryId}`);

    return {
      success: true,
      data: { id: category.id, name: category.name },
    };
  } catch (error) {
    console.error('更新分类失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      categoryId: formData.get('categoryId') as string,
      status: formData.get('status') as string,
    };

    const data = updateCategoryStatusSchema.parse(rawData);

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
    console.error('更新分类状态失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
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
    console.error('删除分类失败:', error);
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const categoryIds = JSON.parse(
      formData.get('categoryIds') as string
    ) as string[];
    const status = formData.get('status') as 'active' | 'inactive';

    if (!categoryIds || categoryIds.length === 0) {
      return { success: false, error: '未选择分类' };
    }

    // 如果要停用分类，需要检查每个分类
    if (status === 'inactive') {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        include: {
          children: true,
          products: true,
        },
      });

      for (const category of categories) {
        if (category.children.length > 0) {
          return {
            success: false,
            error: `分类 "${category.name}" 下有子分类，无法批量停用`,
          };
        }

        const activeProducts = category.products.filter(
          p => p.status === 'active'
        );
        if (activeProducts.length > 0) {
          return {
            success: false,
            error: `分类 "${category.name}" 下有 ${activeProducts.length} 个活跃产品，无法批量停用`,
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
    console.error('批量更新分类状态失败:', error);
    return { success: false, error: '批量更新分类状态失败' };
  }
}

/**
 * 批量删除分类
 */
export async function batchDeleteCategories(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const categoryIds = JSON.parse(
      formData.get('categoryIds') as string
    ) as string[];

    if (!categoryIds || categoryIds.length === 0) {
      return { success: false, error: '未选择分类' };
    }

    await prisma.$transaction(async tx => {
      // 检查所有分类
      const categories = await tx.category.findMany({
        where: { id: { in: categoryIds } },
        include: {
          children: true,
          products: true,
        },
      });

      for (const category of categories) {
        if (category.children.length > 0) {
          throw new Error(`分类 "${category.name}" 下有子分类，无法批量删除`);
        }

        if (category.products.length > 0) {
          throw new Error(
            `分类 "${category.name}" 下有 ${category.products.length} 个产品，无法批量删除`
          );
        }
      }

      // 删除所有分类
      await tx.category.deleteMany({
        where: { id: { in: categoryIds } },
      });
    });

    revalidatePath('/categories');

    return { success: true };
  } catch (error) {
    console.error('批量删除分类失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量删除分类失败',
    };
  }
}
