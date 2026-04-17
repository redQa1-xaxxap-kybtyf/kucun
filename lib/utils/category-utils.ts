/**
 * 分类工具函数
 * 从 lib/schemas/category.ts 迁移而来
 */

/**
 * 分类基础接口
 */
interface CategoryBase {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  description?: string | null;
}

/**
 * 分类树节点接口
 */
interface CategoryTreeNode extends CategoryBase {
  children: CategoryTreeNode[];
  level?: number;
}

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
export function validateCategoryDepth(
  categories: CategoryBase[],
  parentId: string | undefined,
  maxDepth: number = 3
): boolean {
  if (!parentId) {
    return true;
  }

  let depth = 1;
  let currentParentId: string | undefined | null = parentId;

  while (currentParentId && depth < maxDepth) {
    const parent = categories.find(cat => cat.id === currentParentId);
    if (!parent) {
      break;
    }
    currentParentId = parent.parentId;
    depth++;
  }

  return depth <= maxDepth;
}

/**
 * 检查循环引用
 */
export function checkCircularReference(
  categories: CategoryBase[],
  categoryId: string,
  parentId: string
): boolean {
  if (categoryId === parentId) {
    return true;
  }

  let currentParentId: string | undefined | null = parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId) || currentParentId === categoryId) {
      return true; // 发现循环引用
    }

    visited.add(currentParentId);
    const parent = categories.find(cat => cat.id === currentParentId);
    if (!parent) {
      break;
    }
    currentParentId = parent.parentId;
  }

  return false;
}

/**
 * 构建分类树结构
 */
export function buildCategoryTree(
  categories: CategoryBase[]
): CategoryTreeNode[] {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // 创建映射
  categories.forEach(category => {
    categoryMap.set(category.id, { ...category, children: [] });
  });

  // 构建树结构
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id);
    if (!categoryNode) {
      return;
    }

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
export function flattenCategoryTree(
  tree: CategoryTreeNode[],
  level: number = 0
): Array<CategoryTreeNode & { level: number }> {
  const result: Array<CategoryTreeNode & { level: number }> = [];

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
export function getCategoryPath(
  categories: CategoryBase[],
  categoryId: string
): string[] {
  const path: string[] = [];
  let currentId: string | undefined | null = categoryId;

  while (currentId) {
    const category = categories.find(cat => cat.id === currentId);
    if (!category) {
      break;
    }

    path.unshift(category.name);
    currentId = category.parentId;
  }

  return path;
}

/**
 * 批量构建分类完整路径映射
 */
export function buildCategoryPathMap(
  categories: CategoryBase[],
  separator: string = ' / '
): Map<string, string> {
  const categoryById = new Map<string, CategoryBase>();
  const pathById = new Map<string, string>();

  categories.forEach(category => {
    categoryById.set(category.id, category);
  });

  const buildPath = (categoryId: string): string => {
    const cached = pathById.get(categoryId);
    if (cached) {
      return cached;
    }

    const parts: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null | undefined = categoryId;
    let safetyCounter = 0;

    while (currentId && safetyCounter < 10 && !visited.has(currentId)) {
      const current = categoryById.get(currentId);
      if (!current) {
        break;
      }

      visited.add(currentId);
      parts.unshift(current.name);
      currentId = current.parentId;
      safetyCounter += 1;
    }

    const path = parts.join(separator);
    pathById.set(categoryId, path);
    return path;
  };

  categories.forEach(category => {
    buildPath(category.id);
  });

  return pathById;
}

/**
 * 批量构建分类层级映射
 * 顶级分类为 0，二级分类为 1，依次递增。
 */
export function buildCategoryLevelMap(
  categories: CategoryBase[]
): Map<string, number> {
  const categoryById = new Map<string, CategoryBase>();
  const levelById = new Map<string, number>();

  categories.forEach(category => {
    categoryById.set(category.id, category);
  });

  const resolveLevel = (categoryId: string): number => {
    const cached = levelById.get(categoryId);
    if (cached !== undefined) {
      return cached;
    }

    const visited = new Set<string>();
    let currentId: string | null | undefined = categoryId;
    let level = 0;
    let safetyCounter = 0;

    while (currentId && safetyCounter < 10 && !visited.has(currentId)) {
      const current = categoryById.get(currentId);
      if (!current) {
        break;
      }

      visited.add(currentId);
      if (!current.parentId) {
        break;
      }

      level += 1;
      currentId = current.parentId;
      safetyCounter += 1;
    }

    levelById.set(categoryId, level);
    return level;
  };

  categories.forEach(category => {
    resolveLevel(category.id);
  });

  return levelById;
}
