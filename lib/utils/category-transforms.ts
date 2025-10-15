/**
 * 分类数据转换工具
 *
 * 职责：
 * 1. 统一所有分类数据转换逻辑
 * 2. 消除重复的转换代码
 * 3. 确保数据格式一致性
 *
 * 设计原则：
 * - DRY：所有转换逻辑集中在此文件
 * - 纯函数：无副作用，可测试
 * - 类型安全：严格的类型约束
 */

import type {
  Category,
  CategorySummary,
  CategoryDbModelWithRelations,
} from '@/lib/types/category-unified';

// ==================== 数据库到API转换 ====================

/**
 * 转换数据库模型为CategorySummary
 */
export function toCategorySummary(
  db: Pick<CategoryDbModelWithRelations, 'id' | 'name' | 'code'>
): CategorySummary {
  return {
    id: db.id,
    name: db.name,
    code: db.code,
  };
}

/**
 * 转换数据库模型为Category（API响应）
 *
 * @param db - Prisma查询结果（包含Date对象）
 * @returns Category对象（Date转为ISO字符串）
 */
export function toCategory(db: CategoryDbModelWithRelations): Category {
  return {
    id: db.id,
    name: db.name,
    code: db.code,
    description: db.description,
    parentId: db.parentId || undefined,
    sortOrder: db.sortOrder,
    status: db.status as 'active' | 'inactive',
    createdAt: db.createdAt.toISOString(),
    updatedAt: db.updatedAt.toISOString(),
    parent: db.parent ? toCategorySummary(db.parent) : undefined,
    children: db.children ? db.children.map(toCategorySummary) : undefined,
    productCount: db._count.products,
  };
}

/**
 * 批量转换数据库模型为Category数组
 */
export function toCategoryList(
  dbList: CategoryDbModelWithRelations[]
): Category[] {
  return dbList.map(toCategory);
}

// ==================== 客户端到服务端转换 ====================

/**
 * 规范化查询参数
 * 确保查询参数符合服务端期望的格式
 */
export function normalizeQueryParams<T extends Record<string, unknown>>(
  params: T
): T {
  const normalized = { ...params };

  // 移除空值和undefined
  Object.keys(normalized).forEach(key => {
    const value = normalized[key];
    if (value === null || value === undefined || value === '') {
      delete normalized[key];
    }
  });

  return normalized;
}

// ==================== 序列化/反序列化 ====================

/**
 * 序列化Category用于客户端传输
 * 确保Date对象转换为字符串
 */
export function serializeCategory(category: Category): Category {
  return {
    ...category,
    createdAt:
      typeof category.createdAt === 'string'
        ? category.createdAt
        : new Date(category.createdAt).toISOString(),
    updatedAt:
      typeof category.updatedAt === 'string'
        ? category.updatedAt
        : new Date(category.updatedAt).toISOString(),
  };
}

/**
 * 批量序列化Category数组
 */
export function serializeCategoryList(categories: Category[]): Category[] {
  return categories.map(serializeCategory);
}

/**
 * 反序列化Category（将字符串日期转为Date对象）
 * 注意：通常客户端使用字符串即可，此函数用于特殊场景
 */
export function deserializeCategory(category: Category): Omit<
  Category,
  'createdAt' | 'updatedAt'
> & {
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    ...category,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt),
  };
}

// ==================== 验证工具 ====================

/**
 * 验证分类数据完整性
 */
export function validateCategoryData(category: Partial<Category>): boolean {
  // 必填字段检查
  if (!category.id || !category.name || !category.code) {
    return false;
  }

  // 状态值检查
  if (category.status && !['active', 'inactive'].includes(category.status)) {
    return false;
  }

  return true;
}

/**
 * 过滤空值字段
 */
export function removeEmptyFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      result[key as keyof T] = value as T[keyof T];
    }
  });

  return result;
}
