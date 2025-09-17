/**
 * 单个分类管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { UpdateCategorySchema } from '@/lib/schemas/category';
import type { ApiResponse } from '@/lib/types/api';

// 分类类型定义
interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;

  // 关联数据
  parent?: Category;
  children?: Category[];
  productCount?: number;
}

/**
 * GET /api/categories/[id] - 获取单个分类详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '无效的分类ID',
        },
        { status: 400 }
      );
    }

    // 查询分类
    const category = await prisma.category.findUnique({
      where: { id },
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

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: '分类不存在',
        },
        { status: 404 }
      );
    }

    // 转换数据格式
    const transformedCategory = {
      id: category.id,
      name: category.name,
      code: category.code,
      description: category.description,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      status: category.status as 'active' | 'inactive',
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
      parent: category.parent ? {
        id: category.parent.id,
        name: category.parent.name,
        code: category.parent.code,
      } : undefined,
      children: category.children.map(child => ({
        id: child.id,
        name: child.name,
        code: child.code,
      })),
      productCount: category._count.products,
    };

    const response: ApiResponse<Category> = {
      success: true,
      data: transformedCategory,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取分类详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories/[id] - 更新分类
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '无效的分类ID',
        },
        { status: 400 }
      );
    }

    // 验证请求数据
    const validatedData = UpdateCategorySchema.parse({ ...body, id });

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        {
          success: false,
          error: '分类不存在',
        },
        { status: 404 }
      );
    }

    // 注意：分类编码不允许修改，由系统自动生成

    // 检查名称唯一性（如果名称有变化）
    if (validatedData.name && validatedData.name !== existingCategory.name) {
      const nameExists = await prisma.category.findFirst({
        where: {
          name: validatedData.name,
          id: { not: id },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          {
            success: false,
            error: '分类名称已存在',
          },
          { status: 400 }
        );
      }
    }

    // 检查父级分类循环引用
    if (validatedData.parentId) {
      // 简单检查：不能将自己设为父级
      if (validatedData.parentId === id) {
        return NextResponse.json(
          {
            success: false,
            error: '不能将自己设为父级分类',
          },
          { status: 400 }
        );
      }

      // 检查父级分类是否存在
      const parentExists = await prisma.category.findUnique({
        where: { id: validatedData.parentId },
      });

      if (!parentExists) {
        return NextResponse.json(
          {
            success: false,
            error: '父级分类不存在',
          },
          { status: 400 }
        );
      }
    }

    // 更新分类
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: validatedData.name,
        // code 字段不允许修改，保持原值
        description: validatedData.description,
        parentId: validatedData.parentId,
        sortOrder: validatedData.sortOrder,
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
    const transformedCategory = {
      id: updatedCategory.id,
      name: updatedCategory.name,
      code: updatedCategory.code,
      description: updatedCategory.description,
      parentId: updatedCategory.parentId,
      sortOrder: updatedCategory.sortOrder,
      status: updatedCategory.status as 'active' | 'inactive',
      createdAt: updatedCategory.createdAt.toISOString(),
      updatedAt: updatedCategory.updatedAt.toISOString(),
      parent: updatedCategory.parent ? {
        id: updatedCategory.parent.id,
        name: updatedCategory.parent.name,
        code: updatedCategory.parent.code,
      } : undefined,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('更新分类失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id] - 删除分类
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '无效的分类ID',
        },
        { status: 400 }
      );
    }

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        {
          success: false,
          error: '分类不存在',
        },
        { status: 404 }
      );
    }

    // 检查是否有子分类
    if (existingCategory.children.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '该分类下还有子分类，无法删除',
        },
        { status: 400 }
      );
    }

    // 检查是否有关联产品
    if (existingCategory._count.products > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '该分类下还有产品，无法删除',
        },
        { status: 400 }
      );
    }

    // 删除分类
    await prisma.category.delete({
      where: { id },
    });

    const response: ApiResponse<void> = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
