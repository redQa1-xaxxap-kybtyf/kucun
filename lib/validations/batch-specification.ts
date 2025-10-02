/**
 * 批次规格参数验证规则
 * 使用Zod进行数据验证，确保类型安全
 */

import { z } from 'zod';

// 批次号验证规则
export const batchNumberSchema = z
  .string({ message: '批次号必须是字符串' })
  .min(1, { error: '批次号不能为空' })
  .max(50, { error: '批次号不能超过50个字符' })
  .regex(/^[A-Z0-9\-_]+$/i, {
    error: '批次号只能包含字母、数字、连字符和下划线',
  });

// 每单位片数验证规则
export const piecesPerUnitSchema = z
  .number({ message: '每单位片数必须是数字' })
  .int({ error: '每单位片数必须是整数' })
  .min(1, { error: '每单位片数至少为1' })
  .max(10000, { error: '每单位片数不能超过10000' });

// 重量验证规则
export const weightSchema = z
  .number({ message: '重量必须是数字' })
  .min(0.001, { error: '重量必须大于0' })
  .max(10000, { error: '重量不能超过10000kg' })
  .optional();

// 厚度验证规则
export const thicknessSchema = z
  .number({ message: '厚度必须是数字' })
  .min(0.1, { error: '厚度必须大于0.1mm' })
  .max(1000, { error: '厚度不能超过1000mm' })
  .optional();

// 创建批次规格参数验证规则
export const createBatchSpecificationSchema = z.object({
  productId: z
    .string({ message: '产品ID必须是字符串' })
    .uuid({ error: '产品ID格式不正确' }),

  batchNumber: batchNumberSchema,
  piecesPerUnit: piecesPerUnitSchema,
  weight: weightSchema,
  thickness: thicknessSchema,
});

// 更新批次规格参数验证规则
export const updateBatchSpecificationSchema = z.object({
  piecesPerUnit: piecesPerUnitSchema.optional(),
  weight: weightSchema,
  thickness: thicknessSchema,
});

// 批次规格参数查询参数验证规则
export const batchSpecificationQuerySchema = z.object({
  page: z
    .number()
    .int('页码必须是整数')
    .min(1, '页码必须大于0')
    .optional()
    .default(1),

  limit: z
    .number()
    .int('每页数量必须是整数')
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .optional()
    .default(20),

  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),

  productId: z.string().uuid('产品ID格式不正确').optional(),

  batchNumber: z.string().max(50, '批次号不能超过50个字符').optional(),

  sortBy: z
    .enum(['createdAt', 'batchNumber', 'piecesPerUnit', 'weight'], {
      message: '请选择有效的排序字段',
    })
    .optional()
    .default('createdAt'),

  sortOrder: z
    .enum(['asc', 'desc'], { message: '请选择有效的排序方向' })
    .optional()
    .default('desc'),
});

// 批次规格参数ID验证规则
export const batchSpecificationIdSchema = z
  .string({ message: '批次规格参数ID必须是字符串' })
  .uuid({ error: '批次规格参数ID格式不正确' });

// 批次规格参数对比验证规则
export const batchSpecificationComparisonSchema = z.object({
  specificationIds: z
    .array(batchSpecificationIdSchema)
    .min(2, '至少需要选择2个批次规格参数进行对比')
    .max(10, '最多只能对比10个批次规格参数'),
});

// 批次规格参数统计查询验证规则
export const batchSpecificationStatisticsSchema = z.object({
  productId: z.string().uuid('产品ID格式不正确').optional(),

  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确，应为YYYY-MM-DD')
    .optional(),

  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确，应为YYYY-MM-DD')
    .optional(),
});

// 类型导出
export type CreateBatchSpecificationFormData = z.infer<
  typeof createBatchSpecificationSchema
>;
export type UpdateBatchSpecificationFormData = z.infer<
  typeof updateBatchSpecificationSchema
>;
export type BatchSpecificationQueryFormData = z.infer<
  typeof batchSpecificationQuerySchema
>;
export type BatchSpecificationComparisonFormData = z.infer<
  typeof batchSpecificationComparisonSchema
>;
export type BatchSpecificationStatisticsFormData = z.infer<
  typeof batchSpecificationStatisticsSchema
>;

// 默认值
export const batchSpecificationDefaults = {
  piecesPerUnit: 1,
  weight: undefined,
  thickness: undefined,
} as const;

// 验证辅助函数
export function validateBatchNumber(batchNumber: string): boolean {
  try {
    batchNumberSchema.parse(batchNumber);
    return true;
  } catch {
    return false;
  }
}

export function validatePiecesPerUnit(piecesPerUnit: number): boolean {
  try {
    piecesPerUnitSchema.parse(piecesPerUnit);
    return true;
  } catch {
    return false;
  }
}

export function validateWeight(weight?: number): boolean {
  try {
    weightSchema.parse(weight);
    return true;
  } catch {
    return false;
  }
}

export function validateThickness(thickness?: number): boolean {
  try {
    thicknessSchema.parse(thickness);
    return true;
  } catch {
    return false;
  }
}
