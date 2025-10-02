// 产品入库验证规则
// 使用 Zod 定义完整的验证规则，确保前后端统一的类型安全验证

import { z } from 'zod';

import type { InboundReason } from '@/lib/types/inbound';

// 入库原因验证
export const inboundReasonSchema = z.enum([
  'purchase',
  'return',
  'transfer',
  'surplus',
  'other',
] as const);

// 入库单位类型
export const inboundUnitSchema = z.enum(['pieces', 'units'] as const);

// 创建入库记录验证规则
export const createInboundSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid('幂等性键格式不正确')
    .describe('幂等性键,防止重复操作'),

  productId: z.string().min(1, '请选择产品'),

  variantId: z.string().uuid('产品变体ID格式不正确').optional(),

  // 用户输入的数量（根据选择的单位）
  inputQuantity: z
    .number({ message: '数量必须是数字' })
    .min(1, { error: '数量必须大于等于1' })
    .max(999999, { error: '数量不能超过999999' })
    .int({ error: '数量必须是整数' }),

  // 用户选择的单位
  inputUnit: inboundUnitSchema.default('pieces'),

  // 最终存储的片数（由前端计算后传入）
  quantity: z
    .number({ message: '数量必须是数字' })
    .min(1, { error: '数量必须大于等于1片' })
    .max(999999, { error: '数量不能超过999999片' })
    .int({ error: '数量必须是整数' }),

  reason: inboundReasonSchema.default('purchase'),

  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    ),

  // 批次管理字段
  batchNumber: z
    .string()
    .min(1, '批次号不能为空')
    .max(50, '批次号不能超过50个字符')
    .optional(),

  // 产品参数字段（入库时确定）
  piecesPerUnit: z
    .number({ message: '每单位片数必须是数字' })
    .int({ error: '每单位片数必须是整数' })
    .min(1, { error: '每单位片数至少为1' })
    .max(10000, { error: '每单位片数不能超过10000' })
    .optional()
    .default(1), // 提供默认值，避免字段缺失导致 "Required" 错误

  weight: z
    .number({ message: '重量必须是数字' })
    .min(0.01, { error: '重量必须大于0' })
    .max(10000, { error: '重量不能超过10000kg' })
    .optional()
    .default(0.01), // 提供默认值，避免字段缺失导致 "Required" 错误
});

// 更新入库记录验证规则
export const updateInboundSchema = z.object({
  quantity: z
    .number()
    .min(1, '数量必须大于等于1片')
    .max(999999, '数量不能超过999999片')
    .int('数量必须是整数')
    .optional(),

  reason: inboundReasonSchema.optional(),

  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .transform(val => val?.trim() || undefined)
    .refine(
      val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
      '备注包含不安全的内容'
    ),
});

// 入库记录查询参数验证
export const inboundQuerySchema = z.object({
  page: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 1))
    .refine(val => val > 0, '页码必须大于0'),

  limit: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 20))
    .refine(val => val > 0 && val <= 100, '每页数量必须在1-100之间'),

  search: z
    .string()
    .nullable()
    .optional()
    .transform(val => val?.trim() || undefined),

  productId: z
    .string()
    .nullable()
    .optional()
    .refine(
      val =>
        !val ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val
        ),
      '产品ID格式不正确'
    ),

  reason: z
    .string()
    .nullable()
    .optional()
    .refine(
      val =>
        !val ||
        ['purchase', 'return', 'transfer', 'surplus', 'other'].includes(val),
      '入库原因格式不正确'
    ),

  userId: z
    .string()
    .nullable()
    .optional()
    .refine(
      val =>
        !val ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val
        ),
      '用户ID格式不正确'
    ),

  startDate: z
    .string()
    .nullable()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), '开始日期格式不正确'),

  endDate: z
    .string()
    .nullable()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), '结束日期格式不正确'),

  sortBy: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || 'createdAt')
    .refine(
      val => ['createdAt', 'quantity', 'recordNumber'].includes(val),
      '排序字段不正确'
    ),

  sortOrder: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || 'desc')
    .refine(val => ['asc', 'desc'].includes(val), '排序方向不正确'),
});

// 批量入库验证规则
export const batchInboundSchema = z.object({
  records: z
    .array(createInboundSchema)
    .min(1, '至少需要一条入库记录')
    .max(100, '单次最多支持100条记录'),
});

// 入库记录ID验证
export const inboundIdSchema = z.object({
  id: z.string().min(1, '入库记录ID不能为空').uuid('入库记录ID格式不正确'),
});

// 产品搜索验证
export const productSearchSchema = z.object({
  search: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词不能超过100个字符')
    .transform(val => val.trim()),

  limit: z.number().min(1).max(50).default(20),
});

// 类型导出
export type CreateInboundData = z.infer<typeof createInboundSchema>;
export type UpdateInboundData = z.infer<typeof updateInboundSchema>;
export type InboundQueryData = z.infer<typeof inboundQuerySchema>;
export type BatchInboundData = z.infer<typeof batchInboundSchema>;
export type InboundIdData = z.infer<typeof inboundIdSchema>;
export type ProductSearchData = z.infer<typeof productSearchSchema>;

// 验证辅助函数
export const validateInboundReason = (
  reason: string
): reason is InboundReason =>
  ['purchase', 'return', 'transfer', 'surplus', 'other'].includes(reason);

// 数量格式化辅助函数
export const formatQuantity = (quantity: number): number =>
  Math.round(quantity * 100) / 100;

// 备注清理辅助函数
export const cleanRemarks = (remarks?: string): string | undefined => {
  if (!remarks) return undefined;
  const cleaned = remarks.trim();
  return cleaned.length > 0 ? cleaned : undefined;
};
