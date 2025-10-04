/**
 * 分类管理业务逻辑服务层
 * 职责:
 * - 封装所有分类相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { generateCategoryCode } from '@/lib/utils/category-code-generator';

// ==================== 类型定义 ====================

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  parent?: {
    id: string;
    name: string;
    code: string;
  };
  children: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  productCount: number;
}

export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  parentId?: string;
}

export interface CategoryListResult {
  categories: CategoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCategoryParams {
  name: string;
  code?: string;
  parentId?: string;
  sortOrder?: number;
}

// ==================== 辅助函数 ====================

/**
 * 构建查询条件
 */
function buildWhereConditions(params: {
  search?: string;
  parentId?: string;
}): Prisma.CategoryWhereInput {
  const where: Prisma.CategoryWhereInput = {
    status: 'active', // 只返回启用的分类
  };

  // 搜索条件
  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { code: { contains: params.search } },
    ];
  }

  // 父级分类筛选
  if (params.parentId) {
    where.parentId = params.parentId;
  }

  return where;
}

/**
 * 转换分类数据格式
 */
function transformCategory(category: {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  sortOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  parent?: {
    id: string;
    name: string;
    code: string;
  } | null;
  children: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  _count: {
    products: number;
  };
}): CategoryItem {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    parentId: category.parentId || undefined,
    sortOrder: category.sortOrder,
    status: category.status as 'active' | 'inactive',
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    parent: category.parent
      ? {
          id: category.parent.id,
          name: category.parent.name,
          code: category.parent.code,
        }
      : undefined,
    children: category.children.map((child) => ({
      id: child.id,
      name: child.name,
      code: child.code,
    })),
    productCount: category._count.products,
  };
}

// ==================== 公共服务函数 ====================

/**
 * 获取分类列表
 */
export async function getCategories(
  params: CategoryQueryParams = {}
): Promise<CategoryListResult> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    ...filterParams
  } = params;

  // 构建查询条件
  const where = buildWhereConditions(filterParams);

  // 计算偏移量
  const skip = (page - 1) * limit;

  // 执行查询
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
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

  // 转换数据格式
  const transformedCategories = categories.map(transformCategory);

  // 计算分页信息
  const totalPages = Math.ceil(total / limit);

  return {
    categories: transformedCategories,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * 创建分类
 */
export async function createCategory(
  params: CreateCategoryParams
): Promise<CategoryItem> {
  // 生成分类编码（如果未提供）
  let code = params.code;
  if (!code) {
    // 使用编码生成器
    const baseCode = generateCategoryCode(params.name);

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
      throw new Error('分类编码已存在');
    }
  }

  // 检查名称唯一性
  const existingName = await prisma.category.findFirst({
    where: { name: params.name },
  });

  if (existingName) {
    throw new Error('分类名称已存在');
  }

  // 创建分类
  const category = await prisma.category.create({
    data: {
      name: params.name,
      code,
      parentId: params.parentId,
      sortOrder: params.sortOrder || 0,
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
  return transformCategory(category);
}

/**
 * 获取单个分类详情
 */
export async function getCategoryById(id: string): Promise<CategoryItem | null> {
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
    return null;
  }

  return transformCategory(category);
}

