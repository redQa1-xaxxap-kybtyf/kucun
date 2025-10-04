/**
 * 分类相关类型定义
 * 遵循全栈开发执行手册：Zod Schema 作为单一真理源
 *
 * 重要：表单输入类型从 lib/validations/category.ts 导入
 * 本文件只定义 API 响应、选项和扩展类型
 */

// 从 Zod Schema 导入基础类型（单一真理源）
import type {
  CreateCategoryData,
  UpdateCategoryData,
  CategoryQueryParams,
  CategoryStatus,
} from '@/lib/validations/category';

// 重新导出以保持向后兼容
export type {
  CreateCategoryData,
  UpdateCategoryData,
  CategoryQueryParams,
  CategoryStatus,
};

/**
 * 分类选项
 * 用于下拉选择器等 UI 组件
 */
export interface CategoryOption {
  /** 分类唯一标识符 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类编码 */
  code: string;
  /** 分类描述（可选） */
  description?: string;
}

/**
 * 分类详情
 * 包含完整的分类信息（API响应）
 */
export interface Category {
  /** 分类唯一标识符 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类编码 */
  code: string;
  /** 分类描述 */
  description?: string | null;
  /** 分类状态 */
  status: CategoryStatus;
  /** 排序顺序 */
  sortOrder: number;
  /** 父级分类ID */
  parentId?: string | null;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}
