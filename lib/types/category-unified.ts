/**
 * 分类统一类型定义
 *
 * 设计原则：
 * 1. DRY原则：所有类型定义集中在此文件
 * 2. 单一真理源：从Zod Schema推导基础类型
 * 3. 类型复用：通过继承和组合避免重复
 * 4. 清晰职责：区分请求、响应、内部使用的类型
 */

// ==================== 基础类型（从Zod Schema导入） ====================

import type {
  CreateCategoryData,
  UpdateCategoryData,
  CategoryQueryParams as ZodCategoryQueryParams,
  CategoryStatus,
} from '@/lib/validations/category';

// 重新导出基础类型
export type { CreateCategoryData, UpdateCategoryData, CategoryStatus };

// ==================== 通用类型 ====================

/**
 * 分类简要信息
 * 用于关联数据、父子关系展示
 */
export interface CategorySummary {
  id: string;
  name: string;
  code: string;
}

/**
 * 查询参数（扩展Zod类型）
 * 所有字段都是可选的，使用默认值
 */
export type CategoryQueryParams = Partial<ZodCategoryQueryParams>;

// ==================== API响应类型 ====================

/**
 * 分类完整信息
 * 用于API响应、列表展示
 */
export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  fullPath?: string;
  level?: number;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: string; // ISO 8601 字符串
  updatedAt: string; // ISO 8601 字符串

  // 关联数据（可选）
  parent?: CategorySummary | null;
  children?: CategorySummary[];
  productCount?: number;
}

/**
 * 分类详情（包含更多统计信息）
 */
export interface CategoryDetail extends Category {
  productCount: number; // 必填
  children: CategorySummary[]; // 必填
}

// ==================== 数据库模型类型 ====================

/**
 * 数据库查询结果（Date对象）
 * 用于Prisma查询结果
 */
export interface CategoryDbModel {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 带关联数据的数据库模型
 */
export interface CategoryDbModelWithRelations extends CategoryDbModel {
  parent?: CategorySummary | null;
  children?: CategorySummary[];
  _count: {
    products: number;
  };
}

// ==================== 服务层类型 ====================

/**
 * 分页查询结果
 */
export interface CategoryListResult {
  categories: Category[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 创建分类参数（服务层）
 */
export interface CreateCategoryParams {
  name: string;
  code?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  status?: CategoryStatus;
}

/**
 * 更新分类参数（服务层）
 */
export interface UpdateCategoryParams {
  id: string;
  name?: string;
  code?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  status?: CategoryStatus;
}

// ==================== UI组件类型 ====================

/**
 * 分类选项（用于下拉选择器）
 */
export interface CategoryOption {
  id: string;
  name: string;
  code: string;
  description?: string;
  fullPath?: string;
  level?: number;
  disabled?: boolean;
}

// ==================== 类型守卫和工具函数 ====================

/**
 * 检查是否为有效的分类状态
 */
export function isCategoryStatus(value: unknown): value is CategoryStatus {
  return value === 'active' || value === 'inactive';
}

/**
 * 检查是否为CategorySummary
 */
export function isCategorySummary(value: unknown): value is CategorySummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'code' in value
  );
}
