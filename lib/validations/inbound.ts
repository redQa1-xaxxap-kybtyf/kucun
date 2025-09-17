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
  'other'
] as const);

// 创建入库记录验证规则
export const createInboundSchema = z.object({
  productId: z
    .string()
    .min(1, '请选择产品')
    .uuid('产品ID格式不正确'),
  
  quantity: z
    .number()
    .min(0.01, '数量必须大于0.01')
    .max(999999.99, '数量不能超过999999.99')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      '数量最多支持2位小数'
    ),
  
  reason: inboundReasonSchema.default('purchase'),
  
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .transform(val => val?.trim() || undefined),
});

// 更新入库记录验证规则
export const updateInboundSchema = z.object({
  quantity: z
    .number()
    .min(0.01, '数量必须大于0.01')
    .max(999999.99, '数量不能超过999999.99')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      '数量最多支持2位小数'
    )
    .optional(),
  
  reason: inboundReasonSchema.optional(),
  
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .transform(val => val?.trim() || undefined),
});

// 入库记录查询参数验证
export const inboundQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val) : 1)
    .refine(val => val > 0, '页码必须大于0'),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val) : 20)
    .refine(val => val > 0 && val <= 100, '每页数量必须在1-100之间'),
  
  search: z
    .string()
    .optional()
    .transform(val => val?.trim() || undefined),
  
  productId: z
    .string()
    .uuid('产品ID格式不正确')
    .optional(),
  
  reason: inboundReasonSchema.optional(),
  
  userId: z
    .string()
    .uuid('用户ID格式不正确')
    .optional(),
  
  startDate: z
    .string()
    .optional()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      '开始日期格式不正确'
    ),
  
  endDate: z
    .string()
    .optional()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      '结束日期格式不正确'
    ),
  
  sortBy: z
    .enum(['createdAt', 'quantity', 'recordNumber'])
    .default('createdAt'),
  
  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc'),
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
  id: z
    .string()
    .min(1, '入库记录ID不能为空')
    .uuid('入库记录ID格式不正确'),
});

// 产品搜索验证
export const productSearchSchema = z.object({
  search: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词不能超过100个字符')
    .transform(val => val.trim()),
  
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20),
});

// 类型导出
export type CreateInboundData = z.infer<typeof createInboundSchema>;
export type UpdateInboundData = z.infer<typeof updateInboundSchema>;
export type InboundQueryData = z.infer<typeof inboundQuerySchema>;
export type BatchInboundData = z.infer<typeof batchInboundSchema>;
export type InboundIdData = z.infer<typeof inboundIdSchema>;
export type ProductSearchData = z.infer<typeof productSearchSchema>;

// 验证辅助函数
export const validateInboundReason = (reason: string): reason is InboundReason => {
  return ['purchase', 'return', 'transfer', 'surplus', 'other'].includes(reason);
};

// 数量格式化辅助函数
export const formatQuantity = (quantity: number): number => {
  return Math.round(quantity * 100) / 100;
};

// 备注清理辅助函数
export const cleanRemarks = (remarks?: string): string | undefined => {
  if (!remarks) return undefined;
  const cleaned = remarks.trim();
  return cleaned.length > 0 ? cleaned : undefined;
};
