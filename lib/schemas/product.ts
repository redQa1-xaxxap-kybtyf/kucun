/**
 * 产品相关的Zod验证Schema
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 产品单位枚举
 */
export const ProductUnitEnum = z.enum([
  'piece',
  'sheet',
  'strip',
  'box',
  'square_meter',
]);

/**
 * 产品状态枚举
 */
export const ProductStatusEnum = z.enum(['active', 'inactive']);

/**
 * 创建产品Schema
 */
export const CreateProductSchema = z.object({
  code: z
    .string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Za-z0-9_-]+$/, '产品编码只能包含字母、数字、下划线和短横线'),

  name: z
    .string()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),

  specification: z.string().max(200, '规格描述不能超过200个字符').optional(),

  unit: ProductUnitEnum.default('piece'),

  piecesPerUnit: z
    .number()
    .int('每单位片数必须是整数')
    .min(1, '每单位片数必须大于0')
    .optional(),

  weight: z
    .number()
    .min(0, '重量不能为负数')
    .max(10000, '重量不能超过10000kg')
    .optional(),

  status: ProductStatusEnum.default('active'),

  categoryId: z.string().optional(),

  specifications: z.record(z.any()).optional(),
});

/**
 * 更新产品Schema
 */
export const UpdateProductSchema = CreateProductSchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
});

/**
 * 产品查询参数Schema
 */
export const ProductQuerySchema = z.object({
  page: z.number().int().min(1).default(1),

  limit: z.number().int().min(1).max(100).default(20),

  search: z.string().optional(),

  sortBy: z
    .enum(['code', 'name', 'createdAt', 'updatedAt', 'status'])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  status: ProductStatusEnum.optional(),

  unit: ProductUnitEnum.optional(),
});

/**
 * 产品状态更新Schema
 */
export const UpdateProductStatusSchema = z.object({
  status: ProductStatusEnum,
});

/**
 * 批量删除产品Schema
 */
export const BatchDeleteProductsSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, '至少选择一个产品')
    .max(100, '一次最多删除100个产品'),
});

/**
 * 产品搜索Schema
 */
export const ProductSearchSchema = z.object({
  q: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词不能超过100个字符'),

  limit: z.number().int().min(1).max(50).default(10),
});

// 导出类型
export type CreateProductData = z.infer<typeof CreateProductSchema>;
export type UpdateProductData = z.infer<typeof UpdateProductSchema>;
export type ProductQueryParams = z.infer<typeof ProductQuerySchema>;
export type UpdateProductStatusData = z.infer<typeof UpdateProductStatusSchema>;
export type BatchDeleteProductsData = z.infer<typeof BatchDeleteProductsSchema>;
export type ProductSearchParams = z.infer<typeof ProductSearchSchema>;

/**
 * 产品表单默认值
 */
export const productFormDefaults: CreateProductData = {
  code: '',
  name: '',
  specification: '',
  unit: 'piece',
  piecesPerUnit: undefined,
  weight: undefined,
  status: 'active',
  categoryId: '',
  specifications: {},
};

/**
 * 验证产品编码唯一性（前端预检查）
 */
export function validateProductCode(code: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(code) && code.length >= 1 && code.length <= 50;
}

/**
 * 格式化产品重量显示
 */
export function formatProductWeight(weight?: number): string {
  if (!weight) return '-';
  return `${weight.toFixed(2)} kg`;
}

/**
 * 格式化产品规格显示
 */
export function formatProductSpecification(specification?: string): string {
  if (!specification) return '-';
  return specification.length > 50
    ? `${specification.substring(0, 50)}...`
    : specification;
}

/**
 * 计算产品总重量
 */
export function calculateTotalWeight(
  weight?: number,
  quantity?: number
): number {
  if (!weight || !quantity) return 0;
  return weight * quantity;
}

/**
 * 验证产品规格JSON
 */
export function validateProductSpecifications(specifications: any): boolean {
  try {
    if (!specifications) return true;
    if (typeof specifications !== 'object') return false;
    if (Array.isArray(specifications)) return false;

    // 检查是否为有效的键值对对象
    for (const [key, value] of Object.entries(specifications)) {
      if (typeof key !== 'string' || key.length === 0) return false;
      if (value === undefined || value === null) return false;
    }

    return true;
  } catch {
    return false;
  }
}
