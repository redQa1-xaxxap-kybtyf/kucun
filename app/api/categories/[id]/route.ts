/**
 * 单个分类管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
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

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existingCategory) {
      throw ApiError.notFound('分类');
    }

    // 注意：分类编码不允许修改，由系统自动生成

    // 检查名称唯一性（如果名称有变化）
    if (validatedData.name && validatedData.name !== existingCategory.name) {
      const nameExists = await prisma.category.findFirst({
        where: {
          name: validatedData.name,
          id: { not: id },
        },
        select: { id: true },
      });

      if (nameExists) {
        throw ApiError.badRequest('分类名称已存在');
      }
    }

    // 检查父级分类循环引用
    if (validatedData.parentId) {
      // 简单检查：不能将自己设为父级
      if (validatedData.parentId === id) {
        throw ApiError.badRequest('不能将自己设为父级分类');
      }

      // 检查父级分类是否存在
      const parentExists = await prisma.category.findUnique({
        where: { id: validatedData.parentId },
        select: { id: true },
      });

      if (!parentExists) {
        throw ApiError.badRequest('父级分类不存在');
      }
    }

    // 更新分类
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: validatedData.name,
        // code 字段不允许修改，保持原值
        parentId: validatedData.parentId,
        sortOrder: validatedData.sortOrder,
      },
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

    return NextResponse.json({
      success: true,
      data: {
        ...updatedCategory,
        productCount: updatedCategory._count.products,
      },
    });
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
