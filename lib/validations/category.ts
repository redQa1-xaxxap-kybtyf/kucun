/**
 * 分类验证规则
 * 遵循全栈开发执行手册：使用Zod进行表单验证
 *
 * 这是分类验证规则的唯一真理源
 */

import { z } from 'zod';

/**
 * 分类基础验证规则
 */
const baseValidations = {
  /** 分类名称验证：必填，最多50字符，不允许HTML标签 */
  name: z
    .string()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符')
    .refine(val => !/<[^>]*>/g.test(val), '分类名称不能包含HTML标签'),

  /** 分类编码验证：必填，最多20字符，只允许字母数字和特殊符号 */
  code: z
    .string()
    .min(1, '分类编码不能为空')
    .max(20, '分类编码不能超过20个字符')
    .regex(/^[A-Za-z0-9-_]+$/, '分类编码只能包含字母、数字、短横线和下划线'),

  /** 父级分类ID验证：可选 */
  parentId: z.string().optional(),

  /** 排序顺序验证：必须是非负整数 */
  sortOrder: z
    .number({ message: '排序顺序必须是数字' })
    .int({ error: '排序顺序必须是整数' })
    .min(0, { error: '排序顺序不能为负数' })
    .default(0),

  /** 分类状态验证：必须是active或inactive */
  status: z.enum(['active', 'inactive'], {
    message: '请选择有效的分类状态',
  }),
};

/**
 * 分类创建表单验证
 */
export const CreateCategorySchema = z.object({
  name: baseValidations.name,
  code: baseValidations.code.optional(),
  parentId: baseValidations.parentId,
  sortOrder: baseValidations.sortOrder,
  status: baseValidations.status.default('active'),
});

/**
 * 分类更新表单验证
 */
export const UpdateCategorySchema = z.object({
  id: z.string().min(1, '分类ID不能为空'),
  name: baseValidations.name.optional(),
  code: baseValidations.code.optional(),
  parentId: baseValidations.parentId,
  sortOrder: baseValidations.sortOrder.optional(),
  status: baseValidations.status.optional(),
});

/**
 * 分类查询参数验证
 */
export const CategoryQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'code', 'createdAt', 'updatedAt', 'sortOrder'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  parentId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
});

/**
 * 批量删除分类验证
 */
export const BatchDeleteCategoriesSchema = z.object({
  categoryIds: z
    .array(z.string().min(1, '分类ID不能为空'))
    .min(1, '至少需要选择一个分类')
    .max(50, '一次最多只能删除50个分类'),
});

// 导出类型推断
export type CreateCategoryData = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryData = z.infer<typeof UpdateCategorySchema>;
export type CategoryQueryParams = z.infer<typeof CategoryQuerySchema>;
export type BatchDeleteCategoriesData = z.infer<
  typeof BatchDeleteCategoriesSchema
>;

// 表单默认值
export const categoryCreateDefaults: Partial<CreateCategoryData> = {
  sortOrder: 0,
  status: 'active',
};

export const categorySearchDefaults: Partial<CategoryQueryParams> = {
  page: 1,
  limit: 20,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  status: 'active',
};
