/**
 * 分类相关的Zod验证Schema
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 创建分类Schema
 */
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符'),

  code: z
    .string()
    .max(50, '分类编码不能超过50个字符')
    .regex(/^[A-Za-z0-9_-]+$/, '分类编码只能包含字母、数字、下划线和短横线')
    .optional(),


  parentId: z.string().optional(),

  sortOrder: z.number().int().min(0).default(0),
});

/**
 * 更新分类Schema
 */
export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
});

/**
 * 分类查询参数Schema
 */
export const CategoryQuerySchema = z.object({
  page: z.number().int().min(1).default(1),

  limit: z.number().int().min(1).max(100).default(20),

  search: z.string().optional(),

  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt'])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  parentId: z.string().optional(),
});

/**
 * 批量删除分类Schema
 */
export const BatchDeleteCategoriesSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, '至少选择一个分类')
    .max(50, '一次最多删除50个分类'),
});

// 导出类型
export type CreateCategoryData = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryData = z.infer<typeof UpdateCategorySchema>;
export type CategoryQueryParams = z.infer<typeof CategoryQuerySchema>;
export type BatchDeleteCategoriesData = z.infer<typeof BatchDeleteCategoriesSchema>;

/**
 * 分类表单默认值
 */
export const categoryFormDefaults: CreateCategoryData = {
  name: '',
  code: undefined,
  parentId: undefined,
  sortOrder: 0,
};

/**
 * 验证分类名称唯一性（前端预检查）
 */
export function validateCategoryName(name: string): boolean {
  return name.length >= 1 && name.length <= 50;
}

/**
 * 验证分类编码格式（前端预检查）
 */
export function validateCategoryCode(code: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(code) && code.length >= 1 && code.length <= 50;
}

/**
 * 生成分类编码建议（基于名称）
 */
export function generateCategoryCodeSuggestion(name: string): string {
  return name
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') // 移除特殊字符
    .substring(0, 20) // 限制长度
    .toLowerCase();
}

/**
 * 验证分类层级深度
 */
export function validateCategoryDepth(categories: any[], parentId: string | undefined, maxDepth: number = 3): boolean {
  if (!parentId) return true;

  let depth = 1;
  let currentParentId = parentId;

  while (currentParentId && depth < maxDepth) {
    const parent = categories.find(cat => cat.id === currentParentId);
    if (!parent) break;
    currentParentId = parent.parentId;
    depth++;
  }

  return depth <= maxDepth;
}

/**
 * 检查循环引用
 */
export function checkCircularReference(categories: any[], categoryId: string, parentId: string): boolean {
  if (categoryId === parentId) return true;

  let currentParentId = parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId) || currentParentId === categoryId) {
      return true; // 发现循环引用
    }

    visited.add(currentParentId);
    const parent = categories.find(cat => cat.id === currentParentId);
    if (!parent) break;
    currentParentId = parent.parentId;
  }

  return false;
}

/**
 * 构建分类树结构
 */
export function buildCategoryTree(categories: any[]): any[] {
  const categoryMap = new Map();
  const rootCategories: any[] = [];

  // 创建映射
  categories.forEach(category => {
    categoryMap.set(category.id, { ...category, children: [] });
  });

  // 构建树结构
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id);

    if (category.parentId) {
      const parent = categoryMap.get(category.parentId);
      if (parent) {
        parent.children.push(categoryNode);
      } else {
        rootCategories.push(categoryNode);
      }
    } else {
      rootCategories.push(categoryNode);
    }
  });

  return rootCategories;
}

/**
 * 扁平化分类树
 */
export function flattenCategoryTree(tree: any[], level: number = 0): any[] {
  const result: any[] = [];

  tree.forEach(category => {
    result.push({ ...category, level });
    if (category.children && category.children.length > 0) {
      result.push(...flattenCategoryTree(category.children, level + 1));
    }
  });

  return result;
}

/**
 * 获取分类路径
 */
export function getCategoryPath(categories: any[], categoryId: string): string[] {
  const path: string[] = [];
  let currentId = categoryId;

  while (currentId) {
    const category = categories.find(cat => cat.id === currentId);
    if (!category) break;

    path.unshift(category.name);
    currentId = category.parentId;
  }

  return path;
}
