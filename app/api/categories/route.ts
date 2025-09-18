/**
 * 分类管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { CategoryQuerySchema, CreateCategorySchema } from '@/lib/schemas/category';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import { generateCategoryCode } from '@/lib/utils/category-code-generator';

// 分类类型定义
interface Category {
  id: string;
  name: string;
  code: string;
  parentId: string | null | undefined;
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
 * GET /api/categories - 获取分类列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      parentId: searchParams.get('parentId') || undefined,
    };

    // 验证查询参数
    const validatedParams = CategoryQuerySchema.parse(queryParams);

    // 构建查询条件
    const where: any = {
      status: 'active', // 只返回启用的分类
    };

    // 搜索条件
    if (validatedParams.search) {
      where.OR = [
        { name: { contains: validatedParams.search } },
        { code: { contains: validatedParams.search } },
      ];
    }

    // 父级分类筛选
    if (validatedParams.parentId) {
      where.parentId = validatedParams.parentId;
    }

    // 计算偏移量
    const skip = (validatedParams.page - 1) * validatedParams.limit;

    // 执行查询
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: validatedParams.limit,
        orderBy: {
          [validatedParams.sortBy]: validatedParams.sortOrder,
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
      }),
      prisma.category.count({ where }),
    ]);

    // 转换数据格式（snake_case -> camelCase）
    const transformedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      code: category.code,
      parentId: category.parentId || undefined,
      sortOrder: category.sortOrder,
      status: category.status as 'active' | 'inactive',
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
      parent: category.parent ? {
        id: category.parent.id,
        name: category.parent.name,
        code: category.parent.code,
        parentId: category.parent.parentId || undefined,
        sortOrder: category.parent.sortOrder,
        status: category.parent.status as 'active' | 'inactive',
        createdAt: category.parent.createdAt.toISOString(),
        updatedAt: category.parent.updatedAt.toISOString(),
      } : undefined,
      children: category.children.map(child => ({
        id: child.id,
        name: child.name,
        code: child.code,
        parentId: child.parentId || undefined,
        sortOrder: child.sortOrder,
        status: child.status as 'active' | 'inactive',
        createdAt: child.createdAt.toISOString(),
        updatedAt: child.updatedAt.toISOString(),
      })),
      productCount: category._count.products,
    }));

    // 计算分页信息
    const totalPages = Math.ceil(total / validatedParams.limit);

    const response: PaginatedResponse<Category> = {
      data: transformedCategories,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取分类列表失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数无效',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '获取分类列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories - 创建分类
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证请求数据
    const validatedData = CreateCategorySchema.parse(body);

    // 生成分类编码（如果未提供）
    let code = validatedData.code;
    if (!code) {
      // 使用新的编码生成器
      const baseCode = generateCategoryCode(validatedData.name);

      let counter = 1;
      code = baseCode;

      // 确保编码唯一性
      while (await prisma.category.findUnique({ where: { code } })) {
        code = `${baseCode}_${counter}`;
        counter++;
      }
    } else {
      // 检查编码唯一性
      const existingCategory = await prisma.category.findUnique({
        where: { code },
      });

      if (existingCategory) {
        return NextResponse.json(
          {
            success: false,
            error: '分类编码已存在',
          },
          { status: 400 }
        );
      }
    }

    // 检查名称唯一性
    const existingName = await prisma.category.findFirst({
      where: { name: validatedData.name },
    });

    if (existingName) {
      return NextResponse.json(
        {
          success: false,
          error: '分类名称已存在',
        },
        { status: 400 }
      );
    }

    // 创建分类
    const category = await prisma.category.create({
      data: {
        name: validatedData.name,
        code,
        parentId: validatedData.parentId,
        sortOrder: validatedData.sortOrder || 0,
        status: 'active',
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
      id: category.id,
      name: category.name,
      code: category.code,
      parentId: category.parentId || undefined,
      sortOrder: category.sortOrder,
      status: category.status as 'active' | 'inactive',
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
      parent: category.parent ? {
        id: category.parent.id,
        name: category.parent.name,
        code: category.parent.code,
        parentId: category.parent.parentId || undefined,
        sortOrder: category.parent.sortOrder,
        status: category.parent.status as 'active' | 'inactive',
        createdAt: category.parent.createdAt.toISOString(),
        updatedAt: category.parent.updatedAt.toISOString(),
      } : undefined,
      children: category.children.map(child => ({
        id: child.id,
        name: child.name,
        code: child.code,
        parentId: child.parentId || undefined,
        sortOrder: child.sortOrder,
        status: child.status as 'active' | 'inactive',
        createdAt: child.createdAt.toISOString(),
        updatedAt: child.updatedAt.toISOString(),
      })),
      productCount: category._count.products,
    };

    const response: ApiResponse<Category> = {
      success: true,
      data: transformedCategory,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('创建分类失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '请求数据无效',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '创建分类失败',
      },
      { status: 500 }
    );
  }
}
