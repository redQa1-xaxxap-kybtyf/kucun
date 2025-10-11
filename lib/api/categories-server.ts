/**
 * 分类服务端 API
 * 用于 Server Components 中的数据获取
 * 遵循 Next.js 15 官方最佳实践：使用 React.cache() 避免重复查询
 */

import { cache } from 'react';
import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type { CategoryStatus } from '@/lib/validations/category';
import type { CategoryQueryParams } from '@/lib/validations/category';

export interface CategoryWithCounts {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
  parent?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * 服务端获取分类列表
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getCategoriesServer = cache(
  async (
    params: Partial<CategoryQueryParams> = {}
  ): Promise<{
    data: CategoryWithCounts[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const {
      page = 1,
      limit = paginationConfig.defaultPageSize,
      search = '',
      status,
      parentId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // 构建查询条件
    const where: Prisma.CategoryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    // status 为 'all' 时不添加过滤条件，只有 'active' 或 'inactive' 时才过滤
    if (status && status !== 'all') {
      where.status = status;
    }

    if (parentId !== undefined) {
      where.parentId = parentId || null;
    }

    // 分页计算
    const skip = (page - 1) * limit;

    // 查询分类列表
    const [categories, totalCount] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          parent: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    // 转换为带计数的分类
    const categoriesWithCounts: CategoryWithCounts[] = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      code: cat.code,
      description: cat.description,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      status: cat.status,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      productCount: cat._count.products,
      parent: cat.parent,
    }));

    return {
      data: categoriesWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
);

/**
 * 服务端获取单个分类详情
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getCategoryServer = cache(
  async (id: string): Promise<CategoryWithCounts | null> => {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      description: category.description,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productCount: category._count.products,
      parent: category.parent,
    };
  }
);

