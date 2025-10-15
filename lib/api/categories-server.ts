/**
 * 分类服务端 API
 * 用于 Server Components 中的数据获取
 * 遵循 Next.js 15 官方最佳实践：使用 React.cache() 避免重复查询
 */

import { type Prisma } from '@prisma/client';
import { cache } from 'react';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type {
  Category,
  CategoryQueryParams,
} from '@/lib/types/category-unified';
import { toCategoryList, toCategory } from '@/lib/utils/category-transforms';

/**
 * 服务端获取分类列表
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getCategoriesServer = cache(
  async (
    params: Partial<CategoryQueryParams> = {}
  ): Promise<{
    data: Category[];
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

    // 转换为带计数的分类 - 使用统一的转换函数
    const transformedCategories = toCategoryList(categories);

    return {
      data: transformedCategories,
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
  async (id: string): Promise<Category | null> => {
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

    return toCategory(category);
  }
);
