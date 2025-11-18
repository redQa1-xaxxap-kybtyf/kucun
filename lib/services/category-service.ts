/**
 * 分类管理业务逻辑服务层
 * 职责:
 * - 封装所有分类相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import type { Prisma } from '@prisma/client';

import { revalidateCachePath, revalidateCaches } from '@/lib/cache/revalidate';
import { CacheTags } from '@/lib/cache/tags';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  Category,
  CategoryListResult,
  CategoryQueryParams,
  CreateCategoryParams,
  UpdateCategoryParams,
} from '@/lib/types/category-unified';
import { generateCategoryCode } from '@/lib/utils/category-code-generator';
import { toCategory, toCategoryList } from '@/lib/utils/category-transforms';

// ==================== 辅助函数 ====================

/**
 * 获取分类的层级深度
 * @param categoryId - 分类ID
 * @returns 层级深度（1表示顶级分类，2表示二级分类，以此类推）
 */
async function getCategoryDepth(categoryId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = categoryId;

  while (currentId) {
    const category: { parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

    if (!category) {
      break;
    }

    if (category.parentId) {
      depth++;
      currentId = category.parentId;
    } else {
      currentId = null;
    }
  }

  return depth;
}

/**
 * 检查分类层级限制
 * 最多支持3级分类
 * @param parentId - 父分类ID
 * @throws Error 如果超过层级限制
 */
async function validateCategoryDepth(parentId?: string | null): Promise<void> {
  const MAX_DEPTH = 3;

  if (!parentId) {
    // 顶级分类，层级为1
    return;
  }

  const parentDepth = await getCategoryDepth(parentId);

  if (parentDepth >= MAX_DEPTH) {
    throw new Error(
      `分类层级不能超过${MAX_DEPTH}级，当前父分类已是第${parentDepth}级`
    );
  }
}

/**
 * 确保更新父子关系不会导致循环引用
 */
async function ensureNoCircularRelationship(
  categoryId: string,
  parentId?: string | null
): Promise<void> {
  if (!parentId) {
    return;
  }

  const visited = new Set<string>();
  let currentId: string | null | undefined = parentId;

  while (currentId) {
    if (currentId === categoryId) {
      throw new Error('不能将分类移动到其自身或子分类下');
    }

    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);

    const parentRecord: { parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

    if (!parentRecord) {
      break;
    }

    currentId = parentRecord.parentId;
  }
}

/**
 * 构建查询条件
 * 优化: 移除 MySQL 不支持的 mode: 'insensitive',简化状态过滤逻辑
 */
function buildWhereConditions(params: {
  search?: string;
  parentId?: string;
  status?: 'active' | 'inactive' | 'all';
}): Prisma.CategoryWhereInput {
  const where: Prisma.CategoryWhereInput = {};

  // 状态过滤: 默认返回全部，只有明确筛选时才应用
  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  // 搜索条件 (MySQL 默认不区分大小写)
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

// transformCategory 函数已移至 lib/utils/category-transforms.ts
// 使用统一的 toCategory 函数代替

async function revalidateCategoryCache(): Promise<void> {
  try {
    const { getCategoriesServer } = await import('@/lib/api/categories-server');
    const maybeCache = (
      getCategoriesServer as unknown as {
        cache?: { clear?: () => void };
      }
    )?.cache;
    maybeCache?.clear?.();
  } catch (_error) {
    // ignore cache clear errors
  }

  await revalidateCaches(
    [
      CacheTags.Categories.all,
      CacheTags.Categories.list,
      CacheTags.Categories.tree,
    ],
    { cascade: false }
  );
  await revalidateCachePath('/categories');
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

  // 性能监控: 记录查询开始时间
  const startTime = Date.now();

  // 执行查询 - 优化: 使用 select 替代 include,只选择需要的字段
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        parentId: true,
        sortOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // 只选择父分类的必要字段
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        // 产品计数
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.category.count({ where }),
  ]);

  // 性能监控: 计算查询耗时
  const duration = Date.now() - startTime;

  // 性能监控: 慢查询警告
  if (duration > 1000) {
    logger.warn('分类查询性能慢', {
      context: {
        operation: 'getCategories',
        duration,
        page,
        limit,
        search: filterParams.search || undefined,
        parentId: filterParams.parentId || undefined,
        status: filterParams.status || undefined,
        sortBy,
        sortOrder,
        total,
      },
    });
  }

  // 转换数据格式 - 使用统一的转换函数
  const transformedCategories = toCategoryList(categories);

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
): Promise<Category> {
  // 1. 检查层级限制
  await validateCategoryDepth(params.parentId);

  // 2. 生成分类编码（如果未提供）
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

  // 3. 检查名称唯一性（同一父分类下名称唯一）
  const existingName = await prisma.category.findFirst({
    where: {
      name: params.name,
      parentId: params.parentId || null, // null 表示顶级分类
    },
  });

  if (existingName) {
    throw new Error('同一父分类下已存在相同名称的分类');
  }

  const parentId = params.parentId ?? null;

  // 4. 计算排序值（默认使用同级最大值+1）
  let sortOrder = params.sortOrder;
  if (
    sortOrder === undefined ||
    sortOrder === null ||
    Number.isNaN(sortOrder) ||
    sortOrder === 0
  ) {
    const { _max } = await prisma.category.aggregate({
      where: { parentId },
      _max: { sortOrder: true },
    });
    sortOrder = (_max.sortOrder ?? 0) + 1;
  }

  // 创建分类
  const category = await prisma.category.create({
    data: {
      name: params.name,
      code,
      description: params.description ?? null,
      parentId,
      sortOrder,
      status: params.status === 'inactive' ? 'inactive' : 'active',
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

  await revalidateCategoryCache();

  // 转换数据格式 - 使用统一的转换函数
  return toCategory(category);
}

/**
 * 获取单个分类详情
 */
export async function getCategoryById(id: string): Promise<Category | null> {
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

  return toCategory(category);
}

/**
 * 更新分类
 */
export async function updateCategory(
  params: UpdateCategoryParams
): Promise<Category> {
  const { id, ...updateData } = params;

  // 1. 检查分类是否存在
  const existingCategory = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, parentId: true },
  });

  if (!existingCategory) {
    throw new Error('分类不存在');
  }

  // 2. 如果要修改父级分类，检查层级限制
  if (updateData.parentId !== undefined) {
    // 不能将自己设为父级
    if (updateData.parentId === id) {
      throw new Error('不能将自己设为父级分类');
    }

    // 检查父级分类是否存在
    if (updateData.parentId) {
      const parentExists = await prisma.category.findUnique({
        where: { id: updateData.parentId },
        select: { id: true },
      });

      if (!parentExists) {
        throw new Error('父级分类不存在');
      }
    }

    await ensureNoCircularRelationship(id, updateData.parentId);

    if (updateData.parentId) {
      await validateCategoryDepth(updateData.parentId);
    }
  }

  // 3. 检查名称唯一性（同一父分类下名称唯一）
  // 如果名称或父分类发生变化，需要检查
  const nameChanged =
    updateData.name && updateData.name !== existingCategory.name;
  const parentChanged =
    updateData.parentId !== undefined &&
    updateData.parentId !== existingCategory.parentId;

  if (nameChanged || parentChanged) {
    // 确定最终的名称和父分类ID
    const finalName = updateData.name || existingCategory.name;
    const finalParentId =
      updateData.parentId !== undefined
        ? updateData.parentId
        : existingCategory.parentId;

    const nameExists = await prisma.category.findFirst({
      where: {
        name: finalName,
        parentId: finalParentId || null,
        id: { not: id },
      },
      select: { id: true },
    });

    if (nameExists) {
      throw new Error('同一父分类下已存在相同名称的分类');
    }
  }

  // 4. 更新分类
  const updatePayload: Prisma.CategoryUncheckedUpdateInput = {};

  if (updateData.name !== undefined) {
    updatePayload.name = updateData.name;
  }

  if (updateData.parentId !== undefined) {
    updatePayload.parentId = updateData.parentId ?? null;
  }

  if (updateData.sortOrder !== undefined) {
    updatePayload.sortOrder = updateData.sortOrder;
  }

  if (updateData.description !== undefined) {
    updatePayload.description = updateData.description ?? null;
  }

  if (updateData.status !== undefined) {
    updatePayload.status = updateData.status;
  }

  const updatedCategory = await prisma.category.update({
    where: { id },
    data: updatePayload,
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

  await revalidateCategoryCache();

  return toCategory(updatedCategory);
}

export { revalidateCategoryCache };
