/**
 * 分类状态管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';

import { type Category } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { revalidateCategoryCache } from '@/lib/services/category-service';
import type { ApiResponse } from '@/lib/types/api';
import { categoryStatusUpdateSchema } from '@/lib/validations/category';

/**
 * PATCH /api/categories/[id]/status - 更新分类状态
 */
export const PATCH = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (req, ctx) => {
      const { id } = await resolveParams(ctx.params);
      const body = await req.json();

      // 验证ID格式
      if (!id || typeof id !== 'string') {
        throw ApiError.badRequest('无效的分类ID');
      }

      // 验证请求数据（Zod 错误会自动处理）
      const validatedData = categoryStatusUpdateSchema.parse(body);

      // 检查分类是否存在
      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw ApiError.notFound('分类');
      }

      // 如果要禁用分类，检查是否有启用的子分类
      if (validatedData.status === 'inactive') {
        const activeChildrenCount = await prisma.category.count({
          where: {
            parentId: id,
            status: 'active',
          },
        });

        if (activeChildrenCount > 0) {
          throw ApiError.badRequest('该分类下还有启用的子分类，请先禁用子分类');
        }
      }

      // 更新分类状态
      const updatedCategory = await prisma.category.update({
        where: { id },
        data: {
          status: validatedData.status,
        },
        include: {
          parent: true,
          children: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      // 转换数据格式
      const transformedCategory: Category = {
        id: updatedCategory.id,
        name: updatedCategory.name,
        code: updatedCategory.code,
        description: updatedCategory.description,
        parentId: updatedCategory.parentId || undefined,
        sortOrder: updatedCategory.sortOrder,
        status: updatedCategory.status as 'active' | 'inactive',
        createdAt: updatedCategory.createdAt.toISOString(),
        updatedAt: updatedCategory.updatedAt.toISOString(),
        parent: updatedCategory.parent
          ? {
              id: updatedCategory.parent.id,
              name: updatedCategory.parent.name,
              code: updatedCategory.parent.code,
            }
          : undefined,
        children: updatedCategory.children.map(child => ({
          id: child.id,
          name: child.name,
          code: child.code,
        })),
        productCount: updatedCategory._count.products,
      };

      const response: ApiResponse<Category> = {
        success: true,
        data: transformedCategory,
      };

      await revalidateCategoryCache();

      return NextResponse.json(response);
    })(request, context),
  { permissions: ['categories:edit'] }
);
