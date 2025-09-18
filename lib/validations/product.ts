/**
 * 产品表单验证规则（前端）
 * 遵循全栈开发执行手册：统一验证规则，避免重复定义
 * 修复：引用lib/schemas/product.ts中的统一验证规则
 */

/**
 * 统一的验证规则导出
 * 修复：使用lib/schemas/product.ts中的统一定义，避免重复
 */
export const productCreateSchema = CreateProductSchema;
export const productUpdateSchema = UpdateProductSchema;
export const productSearchSchema = ProductQuerySchema;

// 导出类型推断
export type ProductCreateFormData = CreateProductData;
export type ProductUpdateFormData = UpdateProductData;
export type ProductSearchFormData = ProductQueryParams;

/**
 * 表单默认值
 * 修复：使用统一的类型定义，确保类型安全
 */
export const productCreateDefaults: Partial<CreateProductData> = {
  code: '',
  name: '',
  specification: '',
  unit: 'piece',
  piecesPerUnit: 1,
  weight: undefined,
  thickness: undefined,
  status: 'active',
  categoryId: undefined,
  specifications: {},
};

export const productSearchDefaults: Partial<ProductQueryParams> = {
  page: 1,
  limit: 10,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
