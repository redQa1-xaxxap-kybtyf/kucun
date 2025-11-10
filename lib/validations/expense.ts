// 费用记录验证规则
// 使用 Zod 定义完整的验证规则，确保前后端统一的类型安全验证

import { z } from 'zod';

// 费用类型枚举
export const expenseTypeSchema = z.enum([
  'shipping', // 运费
  'storage', // 仓储费
  'labor', // 人工费
  'travel', // 差旅费
  'living', // 生活费
  'loading_unloading', // 装卸费
  'other', // 其他费用
] as const);

// 关联业务类型枚举
export const expenseRelatedTypeSchema = z.enum([
  'inbound', // 入库记录
  'outbound', // 出库记录
  'sales_order', // 销售订单
  'purchase_order', // 采购订单
] as const);

// 创建费用记录验证规则
export const createExpenseSchema = z.object({
  expenseType: expenseTypeSchema.describe('费用类型'),

  expenseName: z
    .string({ message: '费用名称不能为空' })
    .trim()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符')
    .describe('费用名称'),

  expenseAmount: z
    .number({ message: '费用金额必须是数字' })
    .min(0.01, { message: '费用金额必须大于0' })
    .max(99999999.99, { message: '费用金额不能超过99,999,999.99' })
    .multipleOf(0.01, { message: '费用金额最多保留2位小数' })
    .describe('费用金额'),

  expenseDate: z
    .string({ message: '费用日期不能为空' })
    .refine(val => !isNaN(Date.parse(val)), '费用日期格式不正确')
    .transform(val => new Date(val).toISOString())
    .describe('费用日期'),

  // 关联业务（可选）
  relatedType: expenseRelatedTypeSchema
    .nullable()
    .optional()
    .describe('关联业务类型（可选）'),

  relatedId: z
    .string()
    .uuid('关联业务ID格式不正确')
    .nullable()
    .optional()
    .describe('关联业务ID（可选）'),

  relatedNumber: z
    .string()
    .max(100, '关联业务单号不能超过100个字符')
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .describe('关联业务单号（可选）'),

  // 备注和附件
  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'),

  attachments: z
    .string()
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(val => {
      if (val === null) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, '附件格式不正确，必须是有效的JSON字符串')
    .describe('附件（可选，JSON字符串）'),
});

// 更新费用记录验证规则（所有字段可选）
export const updateExpenseSchema = z.object({
  expenseType: expenseTypeSchema.optional().describe('费用类型'),

  expenseName: z
    .string()
    .trim()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符')
    .optional()
    .describe('费用名称'),

  expenseAmount: z
    .number()
    .min(0.01, '费用金额必须大于0')
    .max(99999999.99, '费用金额不能超过99,999,999.99')
    .multipleOf(0.01, '费用金额最多保留2位小数')
    .optional()
    .describe('费用金额'),

  expenseDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), '费用日期格式不正确')
    .transform(val => new Date(val).toISOString())
    .optional()
    .describe('费用日期'),

  relatedType: expenseRelatedTypeSchema
    .nullable()
    .optional()
    .describe('关联业务类型（可选）'),

  relatedId: z
    .string()
    .uuid('关联业务ID格式不正确')
    .nullable()
    .optional()
    .describe('关联业务ID（可选）'),

  relatedNumber: z
    .string()
    .max(100, '关联业务单号不能超过100个字符')
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .describe('关联业务单号（可选）'),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    )
    .describe('备注（可选）'),

  attachments: z
    .string()
    .nullable()
    .optional()
    .transform(val => {
      if (val === null || val === undefined) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    })
    .refine(val => {
      if (val === null) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, '附件格式不正确，必须是有效的JSON字符串')
    .describe('附件（可选，JSON字符串）'),
});

// 费用记录筛选验证规则
export const expenseFilterSchema = z.object({
  expenseType: expenseTypeSchema.optional().describe('费用类型筛选（可选）'),

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

  relatedType: expenseRelatedTypeSchema
    .optional()
    .describe('关联业务类型筛选（可选）'),

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
    .enum(['expenseDate', 'expenseAmount', 'createdAt'])
    .default('expenseDate')
    .describe('排序字段'),

  sortOrder: z.enum(['asc', 'desc']).default('desc').describe('排序方向'),
});

// 费用统计筛选验证规则
export const expenseStatisticsFilterSchema = z.object({
  startDate: z
    .string({ message: '开始日期不能为空' })
    .refine(val => !isNaN(Date.parse(val)), '开始日期格式不正确')
    .describe('开始日期（必填）'),

  endDate: z
    .string({ message: '结束日期不能为空' })
    .refine(val => !isNaN(Date.parse(val)), '结束日期格式不正确')
    .describe('结束日期（必填）'),

  groupBy: z
    .enum(['type', 'date', 'month'])
    .default('type')
    .describe('分组方式（可选）'),

  expenseType: expenseTypeSchema.optional().describe('费用类型筛选（可选）'),
});

// 费用记录ID验证
export const expenseIdSchema = z.object({
  id: z.string().min(1, '费用记录ID不能为空').uuid('费用记录ID格式不正确'),
});

// 类型导出
export type ExpenseType = z.infer<typeof expenseTypeSchema>;
export type ExpenseRelatedType = z.infer<typeof expenseRelatedTypeSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
export type ExpenseStatisticsFilterInput = z.infer<
  typeof expenseStatisticsFilterSchema
>;
export type ExpenseIdData = z.infer<typeof expenseIdSchema>;

// 验证辅助函数
export const validateExpenseType = (type: string): type is ExpenseType =>
  [
    'shipping',
    'storage',
    'labor',
    'travel',
    'living',
    'loading_unloading',
    'other',
  ].includes(type);

export const validateExpenseRelatedType = (
  type: string
): type is ExpenseRelatedType =>
  ['inbound', 'outbound', 'sales_order', 'purchase_order'].includes(type);

// 金额格式化辅助函数
export const formatExpenseAmount = (amount: number): number =>
  Math.round(amount * 100) / 100;

// 备注清理辅助函数
export const cleanExpenseRemarks = (remarks?: string): string | undefined => {
  if (!remarks) {
    return undefined;
  }
  const cleaned = remarks.trim();
  return cleaned.length > 0 ? cleaned : undefined;
};
