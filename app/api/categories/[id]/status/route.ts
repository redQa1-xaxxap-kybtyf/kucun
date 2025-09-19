/**
 * 分类状态管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/lib/types/api';

// 状态更新Schema
const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    required_error: '状态不能为空',
    invalid_type_error: '状态值无效',
  }),
});

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
 * PUT /api/categories/[id]/status - 更新分类状态
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
    const validatedData = UpdateStatusSchema.parse(body);

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

    // 如果要禁用分类，检查是否有启用的子分类
    if (validatedData.status === 'inactive') {
      const activeChildren = await prisma.category.findMany({
        where: {
          parentId: id,
          status: 'active',
        },
      });

      if (activeChildren.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: '该分类下还有启用的子分类，请先禁用子分类',
          },
          { status: 400 }
        );
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('更新分类状态失败:', error);

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
