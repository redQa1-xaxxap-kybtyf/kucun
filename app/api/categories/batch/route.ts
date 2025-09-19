import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import type { BatchDeleteResult } from '@/lib/api/categories';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 批量删除分类的验证Schema
const BatchDeleteCategoriesSchema = z.object({
  categoryIds: z
    .array(z.string().min(1, '分类ID不能为空'))
    .min(1, '至少需要选择一个分类')
    .max(100, '一次最多只能删除100个分类'),
});

/**
 * 批量删除分类
 * DELETE /api/categories/batch
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validationResult = BatchDeleteCategoriesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据无效',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { categoryIds } = validationResult.data;

    // 查询要删除的分类，包含关联数据检查
    const categoriesToDelete = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    // 检查哪些分类不存在
    const foundCategoryIds = categoriesToDelete.map(category => category.id);
    const notFoundCategoryIds = categoryIds.filter(
      id => !foundCategoryIds.includes(id)
    );

    // 检查哪些分类有关联数据，不能删除
    const categoriesWithReferences = categoriesToDelete.filter(
      category => category._count.products > 0 || category._count.children > 0
    );

    // 可以安全删除的分类
    const categoriesToSafelyDelete = categoriesToDelete.filter(
      category =>
        category._count.products === 0 && category._count.children === 0
    );

    // 执行批量删除
    let deletedCount = 0;
    if (categoriesToSafelyDelete.length > 0) {
      const deleteResult = await prisma.category.deleteMany({
        where: {
          id: { in: categoriesToSafelyDelete.map(category => category.id) },
        },
      });
      deletedCount = deleteResult.count;
    }

    // 构建失败的分类列表
    const failedCategories = [
      // 不存在的分类
      ...notFoundCategoryIds.map(id => ({
        id,
        name: '未知分类',
        reason: '分类不存在',
      })),
      // 有关联数据的分类
      ...categoriesWithReferences.map(category => {
        const reasons = [];
        if (category._count.products > 0) {
          reasons.push(`有${category._count.products}个产品关联`);
        }
        if (category._count.children > 0) {
          reasons.push(`有${category._count.children}个子分类`);
        }
        return {
          id: category.id,
          name: category.name,
          reason: reasons.join('，'),
        };
      }),
    ];

    const failedCount = failedCategories.length;
    const totalRequested = categoryIds.length;

    // 构建响应消息
    let message = '';
    if (deletedCount === totalRequested) {
      message = `成功删除${deletedCount}个分类`;
    } else if (deletedCount === 0) {
      message = `删除失败：所有${totalRequested}个分类都无法删除`;
    } else {
      message = `批量删除完成：成功删除${deletedCount}个分类，${failedCount}个分类删除失败`;
    }

    const result: BatchDeleteResult = {
      success: deletedCount > 0,
      deletedCount,
      failedCount,
      failedCategories:
        failedCategories.length > 0 ? failedCategories : undefined,
      message,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量删除分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
