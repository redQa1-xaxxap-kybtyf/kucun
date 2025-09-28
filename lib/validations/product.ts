/**
 * 产品表单验证规则
 * 遵循全栈开发执行手册：使用Zod进行表单验证，与React Hook Form集成
 *
 * 这是产品验证规则的唯一真理源，所有产品相关的验证逻辑都应该在此文件中定义
 * 与 lib/types/product.ts 中的类型定义保持同步
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

/**
 * 产品基础验证规则
 * 定义了产品各个字段的通用验证逻辑
 */
const baseValidations = {
  /** 产品编码验证：必填，最多50字符，只允许字母数字和特殊符号 */
  code: z
    .string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Za-z0-9-_]+$/, '产品编码只能包含字母、数字、短横线和下划线'),

  /** 产品名称验证：必填，最多100字符 */
  name: z
    .string()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),

  /** 规格描述验证：可选，最多200字符 */
  specification: z
    .string()
    .max(200, '规格描述不能超过200个字符')
    .optional()
    .or(z.literal('')),

  /** 产品描述验证：可选，最多1000字符 */
  description: z
    .string()
    .max(1000, '产品描述不能超过1000个字符')
    .optional()
    .or(z.literal('')),

  /** 计量单位验证：必须是预定义的枚举值 */
  unit: z.enum(['piece', 'sheet', 'strip', 'box', 'square_meter'], {
    errorMap: () => ({ message: '请选择有效的计量单位' }),
  }),

  /** 每件片数验证：可选正整数，范围1-10000，入库时确定 */
  piecesPerUnit: z
    .number({
      invalid_type_error: '每件片数必须是数字',
    })
    .int('每件片数必须是整数')
    .min(1, '每件片数至少为1')
    .max(10000, '每件片数不能超过10000')
    .optional(),

  /** 重量验证：可选正数，最大100000kg */
  weight: z
    .number({
      invalid_type_error: '重量必须是数字',
    })
    .min(0, '重量不能为负数')
    .max(100000, '重量不能超过100000kg')
    .optional(),

  /** 厚度验证：可选正数，最大100mm */
  thickness: z
    .number({
      invalid_type_error: '厚度必须是数字',
    })
    .min(0, '厚度不能为负数')
    .max(100, '厚度不能超过100mm')
    .optional(),

  /** 产品状态验证：必须是active或inactive */
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: '请选择有效的产品状态' }),
  }),

  /** 缩略图URL验证：可选，必须是有效的URL */
  thumbnailUrl: z
    .string()
    .url('缩略图URL格式不正确')
    .optional()
    .or(z.literal('')),

  /** 产品图片验证：支持主图和效果图 */
  images: z
    .array(
      z.object({
        url: z.string().url('图片URL格式不正确'),
        type: z.enum(['main', 'effect'], {
          errorMap: () => ({ message: '图片类型必须是主图或效果图' }),
        }),
        alt: z.string().max(200, '图片描述不能超过200个字符').optional(),
        order: z.number().int().min(0).optional(), // 图片排序
      })
    )
    .max(10, '最多只能上传10张图片')
    .optional(),
};

// 产品创建表单验证 - 移除重量和每单位片数字段
export const productCreateSchema = z.object({
  code: baseValidations.code,
  name: baseValidations.name,
  specification: baseValidations.specification,
  description: baseValidations.description,
  unit: baseValidations.unit.default('piece'),
  thickness: baseValidations.thickness,
  status: baseValidations.status.default('active'),
  categoryId: z.string().optional(),
  // 产品图片
  thumbnailUrl: baseValidations.thumbnailUrl,
  images: baseValidations.images,
});

// 产品更新表单验证
export const productUpdateSchema = z.object({
  id: z.string().min(1, '产品ID不能为空'),
  code: baseValidations.code.optional(),
  name: baseValidations.name.optional(),
  specification: baseValidations.specification,
  description: baseValidations.description,
  unit: baseValidations.unit.optional(),
  piecesPerUnit: baseValidations.piecesPerUnit.optional(),
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

// 批量删除产品验证
export const batchDeleteProductsSchema = z.object({
  productIds: z
    .array(z.string().min(1, '产品ID不能为空'))
    .min(1, '至少需要选择一个产品')
    .max(100, '一次最多只能删除100个产品'),
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

// 导出类型推断
export type ProductCreateFormData = z.infer<typeof productCreateSchema>;
export type ProductUpdateFormData = z.infer<typeof productUpdateSchema>;
export type ProductSearchFormData = z.infer<typeof productSearchSchema>;
export type BatchDeleteProductsData = z.infer<typeof batchDeleteProductsSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;

// 表单默认值 - 移除重量和每单位片数的默认值
export const productCreateDefaults: Partial<ProductCreateFormData> = {
  unit: 'piece',
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
