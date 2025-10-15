/**
 * 分类类型定义 - 向后兼容性导出
 *
 * 警告：此文件已废弃，仅用于向后兼容
 * 新代码请直接从 @/lib/types/category-unified 导入
 */

// 重新导出所有类型以保持向后兼容
export type {
  Category,
  CategorySummary,
  CategoryDetail,
  CategoryQueryParams,
  CategoryListResult,
  CategoryOption,
  CreateCategoryData,
  UpdateCategoryData,
  CategoryStatus,
  CategoryDbModel,
  CategoryDbModelWithRelations,
  CreateCategoryParams,
  UpdateCategoryParams,
} from '@/lib/types/category-unified';
