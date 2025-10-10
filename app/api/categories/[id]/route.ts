/**
 * 单个分类管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { updateCategory } from '@/lib/services/category-service';
import { UpdateCategorySchema } from '@/lib/validations/category';

/**
 * GET /api/categories/[id] - 获取单个分类详情
 */
export const GET = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    const { id } = await resolveParams(context.params);

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('无效的分类ID');
    }

    // 查询分类
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        sortOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw ApiError.notFound('分类');
    }

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        productCount: category._count.products,
      },
    });
  }
);

/**
 * PUT /api/categories/[id] - 更新分类
 */
export const PUT = withErrorHandling(
  async (
    request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    const { id } = await resolveParams(context.params);
    const body = await request.json();

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('无效的分类ID');
    }

    // 验证请求数据（Zod 错误会自动处理）
    const validatedData = UpdateCategorySchema.parse({ ...body, id });

    // 调用服务层更新分类（包含层级检查）
    try {
      const category = await updateCategory({
        id: validatedData.id,
        name: validatedData.name,
        parentId: validatedData.parentId,
        sortOrder: validatedData.sortOrder,
      });

      return NextResponse.json({
        success: true,
        data: category,
      });
    } catch (error) {
      // 将服务层错误转换为 API 错误
      if (error instanceof Error) {
        throw ApiError.badRequest(error.message);
      }
      throw error;
    }
  }
);

/**
 * DELETE /api/categories/[id] - 删除分类
 */
export const DELETE = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    const { id } = await resolveParams(context.params);

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('无效的分类ID');
    }

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        children: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingCategory) {
      throw ApiError.notFound('分类');
    }

    // 检查是否有子分类
    if (existingCategory.children.length > 0) {
      throw ApiError.badRequest('该分类下还有子分类，无法删除');
    }

    // 检查是否有关联产品
    if (existingCategory._count.products > 0) {
      throw ApiError.badRequest('该分类下还有产品，无法删除');
    }

    // 删除分类
    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  }
);
