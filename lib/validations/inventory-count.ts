// 库存盘点验证规则
// 使用 Zod 定义完整的验证规则，确保前后端统一的类型安全验证

import { z } from 'zod';

// 盘点类型枚举
export const countTypeSchema = z.enum([
  'full', // 全盘
  'partial', // 抽盘
  'cycle', // 循环盘点
] as const);

// 盘点状态枚举
export const countStatusSchema = z.enum([
  'draft', // 草稿
  'in_progress', // 进行中
  'completed', // 已完成
  'cancelled', // 已取消
] as const);

// 盘点明细状态枚举
export const countItemStatusSchema = z.enum([
  'pending', // 待盘点
  'counted', // 已盘点
  'adjusted', // 已调整
] as const);

// 盘点明细验证规则
export const inventoryCountItemSchema = z.object({
  productId: z
    .string({ message: '产品ID不能为空' })
    .uuid('产品ID格式不正确')
    .describe('产品ID'),

  variantId: z
    .string()
    .uuid('产品变体ID格式不正确')
    .optional()
    .describe('产品变体ID（可选）'),

  batchNumber: z
    .string()
    .max(100, '批次号不能超过100个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .describe('批次号（可选）'),

  systemQuantity: z
    .number({ message: '系统库存数量必须是数字' })
    .int('系统库存数量必须是整数')
    .min(0, '系统库存数量不能为负数')
    .describe('系统库存数量'),

  actualQuantity: z
    .number()
    .int('实际盘点数量必须是整数')
    .min(0, '实际盘点数量不能为负数')
    .optional()
    .describe('实际盘点数量（可选）'),

  location: z
    .string()
    .max(100, '盘点位置不能超过100个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .describe('盘点位置（可选）'),

  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'),
});

// 创建盘点计划验证规则
export const createInventoryCountSchema = z.object({
  countName: z
    .string({ message: '盘点名称不能为空' })
    .trim()
    .min(1, '盘点名称不能为空')
    .max(200, '盘点名称不能超过200个字符')
    .describe('盘点名称'),

  countType: countTypeSchema.describe('盘点类型'),

  planDate: z
    .string({ message: '计划盘点日期不能为空' })
    .refine(val => !isNaN(Date.parse(val)), '计划盘点日期格式不正确')
    .transform(val => new Date(val).toISOString())
    .describe('计划盘点日期'),

  location: z
    .string()
    .max(100, '盘点位置不能超过100个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .describe('盘点位置（可选）'),

  categoryId: z
    .string()
    .uuid('盘点分类ID格式不正确')
    .optional()
    .describe('盘点分类ID（可选）'),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'),

  attachments: z
    .string()
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(val => {
      if (!val) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, '附件格式不正确，必须是有效的JSON字符串')
    .describe('附件（可选，JSON字符串）'),

  items: z
    .array(inventoryCountItemSchema)
    .optional()
    .describe('盘点明细数组（可选）'),
});

// 更新盘点计划验证规则（所有字段可选）
export const updateInventoryCountSchema = z.object({
  countName: z
    .string()
    .trim()
    .min(1, '盘点名称不能为空')
    .max(200, '盘点名称不能超过200个字符')
    .optional()
    .describe('盘点名称'),

  countType: countTypeSchema.optional().describe('盘点类型'),

  planDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), '计划盘点日期格式不正确')
    .transform(val => new Date(val).toISOString())
    .optional()
    .describe('计划盘点日期'),

  location: z
    .string()
    .max(100, '盘点位置不能超过100个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .describe('盘点位置（可选）'),

  categoryId: z
    .string()
    .uuid('盘点分类ID格式不正确')
    .optional()
    .describe('盘点分类ID（可选）'),

  status: countStatusSchema.optional().describe('盘点状态'),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'),

  attachments: z
    .string()
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(val => {
      if (!val) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, '附件格式不正确，必须是有效的JSON字符串')
    .describe('附件（可选，JSON字符串）'),
});

// ✅ 表单专用 Schema - 不含 transform,用于 React Hook Form
// 遵循 DRY 和 SRP 原则: 基于 createInventoryCountSchema,但移除 transform 避免类型推断问题
export const inventoryCountFormSchema = z.object({
  countName: z
    .string({ message: '盘点名称不能为空' })
    .trim()
    .min(1, '盘点名称不能为空')
    .max(200, '盘点名称不能超过200个字符')
    .describe('盘点名称'),

  countType: countTypeSchema.describe('盘点类型'),

  planDate: z
    .string({ message: '计划盘点日期不能为空' })
    .refine(val => !isNaN(Date.parse(val)), '计划盘点日期格式不正确')
    .describe('计划盘点日期'), // ✅ 移除 .transform()

  location: z
    .string()
    .max(100, '盘点位置不能超过100个字符')
    .optional()
    .describe('盘点位置（可选）'), // ✅ 移除 .transform()

  categoryId: z
    .string()
    .uuid('盘点分类ID格式不正确')
    .optional()
    .describe('盘点分类ID（可选）'),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'), // ✅ 移除 .transform()
});

// 提交盘点数据验证规则
export const submitCountDataSchema = z.object({
  items: z
    .array(
      z.object({
        id: z
          .string({ message: '盘点明细ID不能为空' })
          .uuid('盘点明细ID格式不正确')
          .describe('盘点明细ID'),

        actualQuantity: z
          .number({ message: '实际盘点数量必须是数字' })
          .int('实际盘点数量必须是整数')
          .min(0, '实际盘点数量不能为负数')
          .describe('实际盘点数量'),

        remarks: z
          .string()
          .max(500, '备注不能超过500个字符')
          .optional()
          .transform(val => val?.trim() || undefined)
          .refine(
            val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
            '备注包含不安全的内容'
          )
          .describe('备注（可选）'),
      })
    )
    .min(1, '至少需要提交一条盘点数据')
    .describe('盘点明细数组'),
});

// 盘点查询参数验证规则
export const inventoryCountQuerySchema = z.object({
  status: countStatusSchema.optional().describe('状态筛选（可选）'),

  countType: countTypeSchema.optional().describe('类型筛选（可选）'),

  location: z
    .string()
    .optional()
    .transform(val => val?.trim() || undefined)
    .describe('位置筛选（可选）'),

  categoryId: z
    .string()
    .uuid('分类ID格式不正确')
    .optional()
    .describe('分类筛选（可选）'),

  startDate: z
    .string()
    .nullable()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), '开始日期格式不正确')
    .describe('开始日期（可选）'),

  endDate: z
    .string()
    .nullable()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), '结束日期格式不正确')
    .describe('结束日期（可选）'),

  page: z
    .number()
    .int('页码必须是整数')
    .min(1, '页码必须大于0')
    .default(1)
    .describe('页码'),

  pageSize: z
    .number()
    .int('每页数量必须是整数')
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20)
    .describe('每页数量'),

  sortBy: z
    .enum(['planDate', 'createdAt', 'countNumber'])
    .default('planDate')
    .describe('排序字段'),

  sortOrder: z.enum(['asc', 'desc']).default('desc').describe('排序方向'),
});

// 盘点ID验证
export const countIdSchema = z.object({
  id: z.string().min(1, '盘点ID不能为空').uuid('盘点ID格式不正确'),
});

// 类型导出
export type CountType = z.infer<typeof countTypeSchema>;
export type CountStatus = z.infer<typeof countStatusSchema>;
export type CountItemStatus = z.infer<typeof countItemStatusSchema>;
export type CreateInventoryCountInput = z.infer<
  typeof createInventoryCountSchema
>;
export type UpdateInventoryCountInput = z.infer<
  typeof updateInventoryCountSchema
>;
export type InventoryCountItemInput = z.infer<typeof inventoryCountItemSchema>;
export type SubmitCountDataInput = z.infer<typeof submitCountDataSchema>;
export type InventoryCountQuery = z.infer<typeof inventoryCountQuerySchema>;
export type CountIdData = z.infer<typeof countIdSchema>;
// ✅ 表单数据类型 - 用于 React Hook Form
export type InventoryCountFormData = z.infer<typeof inventoryCountFormSchema>;
