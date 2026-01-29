/**
 * 产品表单验证规则
 * 遵循全栈开发执行手册：使用Zod进行表单验证，与React Hook Form集成
 *
 * 这是产品验证规则的唯一真理源，所有产品相关的验证逻辑都应该在此文件中定义
 * 与 lib/types/product.ts 中的类型定义保持同步
 */

import { z } from 'zod';

import {
  PRODUCT_STATUS_VALUES,
  PRODUCT_UNIT_VALUES,
} from '@/lib/config/product';
import { paginationConfig } from '@/lib/env';

const isUrlOrPath = (value: string): boolean => {
  if (!value) {
    return true;
  }

  if (value.startsWith('/')) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * 产品基础验证规则
 * 定义了产品各个字段的通用验证逻辑
 */
const baseValidations = {
  /** 产品编码验证：必填，最多50字符，只允许字母数字和特殊符号 */
  code: z
    .string()
    .trim()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Za-z0-9-_]+$/, '产品编码只能包含字母、数字、短横线和下划线'),

  /** 产品名称验证：必填，最多100字符，不允许HTML标签 */
  name: z
    .string()
    .trim()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符')
    .refine(val => !/<[^>]*>/g.test(val), '产品名称不能包含HTML标签'),

  /** 规格描述验证：必填，最多200字符 */
  specification: z
    .string()
    .trim()
    .min(1, '产品规格不能为空')
    .max(200, '规格描述不能超过200个字符'),

  /** 产品描述验证：可选，最多1000字符 */
  description: z
    .string()
    .max(1000, '产品描述不能超过1000个字符')
    .optional()
    .or(z.literal('')),

  /** 计量单位验证：必须是预定义的枚举值 */
  unit: z.enum(PRODUCT_UNIT_VALUES as [string, ...string[]], {
    message: '请选择有效的计量单位',
  }),

  /** 每件片数验证：可选正整数，范围1-10000，入库时确定 */
  piecesPerUnit: z
    .number({ message: '装箱数必须是数字' })
    .int({ error: '装箱数必须是整数' })
    .min(1, { error: '装箱数至少为1' })
    .max(10000, { error: '装箱数不能超过10000' })
    .optional(),

  /** 重量验证：可选正数，最大100000kg */
  weight: z
    .number({ message: '重量必须是数字' })
    .min(0, { error: '重量不能为负数' })
    .max(100000, { error: '重量不能超过100000kg' })
    .optional(),

  /** 厚度验证：可选正数，最大100mm */
  thickness: z
    .number({ message: '厚度必须是数字' })
    .min(0, { error: '厚度不能为负数' })
    .max(100, { error: '厚度不能超过100mm' })
    .optional(),

  /** 产品状态验证：必须是active或inactive */
  status: z.enum(PRODUCT_STATUS_VALUES as [string, ...string[]], {
    message: '请选择有效的产品状态',
  }),

  /** 缩略图URL验证：可选，支持绝对地址或以 / 开头的相对路径 */
  thumbnailUrl: z
    .string()
    .trim()
    .refine(isUrlOrPath, '缩略图URL格式不正确')
    .optional()
    .or(z.literal('')),

  /** 产品图片验证：支持主图和效果图 */
  images: z
    .array(
      z.object({
        url: z
          .string()
          .trim()
          .refine(isUrlOrPath, { message: '图片URL格式不正确' }),
        type: z.enum(['main', 'effect'], {
          message: '图片类型必须是主图或效果图',
        }),
        alt: z
          .string()
          .max(200, { error: '图片描述不能超过200个字符' })
          .optional(),
        order: z.number().int().min(0).optional(), // 图片排序
      })
    )
    .max(10, { error: '最多只能上传10张图片' })
    .optional(),
};

// 产品创建表单验证 - 移除重量、每单位片数和计量单位字段
export const productCreateSchema = z.object({
  code: baseValidations.code, // 必填
  name: baseValidations.name, // 必填
  specification: baseValidations.specification, // 必填
  description: baseValidations.description, // 选填
  thickness: baseValidations.thickness, // 选填
  status: baseValidations.status.default('active'),
  categoryId: z.string().min(1, '请选择产品分类'), // 必选
  // 产品图片
  thumbnailUrl: baseValidations.thumbnailUrl,
  images: baseValidations.images,
});

// 产品更新表单验证
export const productUpdateSchema = z.object({
  code: baseValidations.code.optional(),
  name: baseValidations.name.optional(),
  specification: baseValidations.specification,
  description: baseValidations.description,
  piecesPerUnit: baseValidations.piecesPerUnit,
  weight: baseValidations.weight,
  thickness: baseValidations.thickness,
  status: baseValidations.status.optional(),
  categoryId: z.string().optional(),
  // 产品图片
  thumbnailUrl: baseValidations.thumbnailUrl,
  images: baseValidations.images,
});

// 产品搜索表单验证
export const productSearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  unit: z.enum(['piece', 'sheet', 'strip', '']).optional(),
  sortBy: z
    .enum(['name', 'code', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 产品查询参数验证
export const productQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize),
  search: z.string().optional(),
  sortBy: z
    .enum(['name', 'code', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  unit: z.string().optional(),
  categoryId: z.string().optional(),
});

// 产品变体查询参数验证
export const productVariantQuerySchema = z.object({
  productId: z.string().uuid('产品ID格式不正确').optional(),
  colorCode: z.string().max(20, '色号不能超过20个字符').optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize),
  sortBy: z.enum(['colorCode', 'sku', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 产品变体创建验证
export const productVariantCreateSchema = z.object({
  productId: z.string().uuid('产品ID格式不正确'),
  colorCode: z.string().min(1, '色号不能为空').max(20, '色号不能超过20个字符'),
  colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
  colorValue: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确')
    .optional(),
  sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
});

// 产品变体更新验证
export const productVariantUpdateSchema = z.object({
  colorCode: z
    .string()
    .min(1, '色号不能为空')
    .max(20, '色号不能超过20个字符')
    .optional(),
  colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
  colorValue: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确')
    .optional(),
  sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// 产品变体批量创建验证
export const productVariantBatchCreateSchema = z.object({
  productId: z.string().uuid('产品ID格式不正确'),
  variants: z
    .array(
      z.object({
        colorCode: z
          .string()
          .min(1, '色号不能为空')
          .max(20, '色号不能超过20个字符'),
        colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
        colorValue: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确')
          .optional(),
        sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
      })
    )
    .min(1, '至少需要一个变体')
    .max(50, '批量创建最多支持50个变体'),
});

// 产品变体批量操作验证
export const productVariantBatchOperationSchema = z.object({
  operation: z.enum(['delete', 'activate', 'deactivate']),
  variantIds: z
    .array(z.string().uuid('变体ID格式不正确'))
    .min(1, '至少需要选择一个变体')
    .max(100, '批量操作最多支持100个变体'),
});

// 产品变体SKU检查验证
export const productVariantCheckSkuSchema = z.object({
  sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50个字符'),
  excludeId: z.string().uuid('排除的变体ID格式不正确').optional(),
});

// 产品变体批量SKU检查验证
export const productVariantBatchCheckSkuSchema = z.object({
  skus: z
    .array(
      z.object({
        sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50个字符'),
        excludeId: z.string().uuid('排除的变体ID格式不正确').optional(),
      })
    )
    .min(1, '至少需要一个SKU')
    .max(100, '批量检查最多支持100个SKU'),
});

// 产品变体SKU生成验证
export const productVariantGenerateSkuSchema = z.object({
  productCode: z
    .string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符'),
  colorCode: z.string().min(1, '色号不能为空').max(20, '色号不能超过20个字符'),
  customSuffix: z.string().max(10, '自定义后缀不能超过10个字符').optional(),
});

// 产品变体批量SKU生成验证
export const productVariantBatchGenerateSkuSchema = z.object({
  items: z
    .array(
      z.object({
        productCode: z
          .string()
          .min(1, '产品编码不能为空')
          .max(50, '产品编码不能超过50个字符'),
        colorCode: z
          .string()
          .min(1, '色号不能为空')
          .max(20, '色号不能超过20个字符'),
        customSuffix: z
          .string()
          .max(10, '自定义后缀不能超过10个字符')
          .optional(),
      })
    )
    .min(1, '至少需要一个项目')
    .max(100, '批量生成最多支持100个项目'),
});

// 导出类型推断
export type ProductCreateFormData = z.infer<typeof productCreateSchema>;
export type ProductUpdateFormData = z.infer<typeof productUpdateSchema>;
export type ProductSearchFormData = z.infer<typeof productSearchSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
export type ProductVariantQueryParams = z.infer<
  typeof productVariantQuerySchema
>;
export type ProductVariantCreateInput = z.infer<
  typeof productVariantCreateSchema
>;
export type ProductVariantUpdateInput = z.infer<
  typeof productVariantUpdateSchema
>;
export type ProductVariantBatchCreateInput = z.infer<
  typeof productVariantBatchCreateSchema
>;
export type ProductVariantBatchOperationInput = z.infer<
  typeof productVariantBatchOperationSchema
>;
export type ProductVariantCheckSkuInput = z.infer<
  typeof productVariantCheckSkuSchema
>;
export type ProductVariantBatchCheckSkuInput = z.infer<
  typeof productVariantBatchCheckSkuSchema
>;
export type ProductVariantGenerateSkuInput = z.infer<
  typeof productVariantGenerateSkuSchema
>;
export type ProductVariantBatchGenerateSkuInput = z.infer<
  typeof productVariantBatchGenerateSkuSchema
>;

// 表单默认值 - 移除重量、每单位片数和计量单位的默认值
export const productCreateDefaults: Partial<ProductCreateFormData> = {
  specification: '',
  description: '',
  thickness: undefined, // 厚度字段是可选的
  thumbnailUrl: '',
  images: [],
  categoryId: 'uncategorized',
};

export const productSearchDefaults: ProductSearchFormData = {
  search: '',
  status: 'all',
  unit: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
