// 应付款管理验证规则
// 基于Zod实现严格的数据验证，确保端到端类型安全

import { z } from 'zod';

// 应付款状态验证
export const payableStatusSchema = z.enum([
  'pending',
  'partial', 
  'paid',
  'overdue',
  'cancelled'
], {
  errorMap: () => ({ message: '请选择有效的应付款状态' }),
});

// 应付款来源类型验证
export const payableSourceTypeSchema = z.enum([
  'purchase_order',
  'factory_shipment',
  'service',
  'other'
], {
  errorMap: () => ({ message: '请选择有效的来源类型' }),
});

// 付款方式验证
export const paymentOutMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'check',
  'other'
], {
  errorMap: () => ({ message: '请选择有效的付款方式' }),
});

// 付款状态验证
export const paymentOutStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled'
], {
  errorMap: () => ({ message: '请选择有效的付款状态' }),
});

// 创建应付款记录验证规则
export const createPayableRecordSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  sourceType: payableSourceTypeSchema,
  sourceId: z.string().optional(),
  sourceNumber: z.string().optional(),
  payableAmount: z
    .number()
    .positive('应付金额必须大于0')
    .max(999999999, '应付金额不能超过999,999,999'),
  dueDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的到期日期'
    ),
  paymentTerms: z
    .string()
    .max(100, '付款条件不能超过100字符')
    .optional(),
  description: z
    .string()
    .max(500, '描述不能超过500字符')
    .optional(),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000字符')
    .optional(),
});

// 更新应付款记录验证规则
export const updatePayableRecordSchema = z.object({
  id: z.string().min(1, '应付款记录ID不能为空'),
  payableAmount: z
    .number()
    .positive('应付金额必须大于0')
    .max(999999999, '应付金额不能超过999,999,999')
    .optional(),
  dueDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的到期日期'
    ),
  status: payableStatusSchema.optional(),
  paymentTerms: z
    .string()
    .max(100, '付款条件不能超过100字符')
    .optional(),
  description: z
    .string()
    .max(500, '描述不能超过500字符')
    .optional(),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000字符')
    .optional(),
});

// 创建付款记录验证规则
export const createPaymentOutRecordSchema = z.object({
  payableRecordId: z.string().optional(),
  supplierId: z.string().min(1, '请选择供应商'),
  paymentMethod: paymentOutMethodSchema,
  paymentAmount: z
    .number()
    .positive('付款金额必须大于0')
    .max(999999999, '付款金额不能超过999,999,999'),
  paymentDate: z
    .string()
    .refine(
      (date) => !isNaN(Date.parse(date)),
      '请输入有效的付款日期'
    ),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000字符')
    .optional(),
  voucherNumber: z
    .string()
    .max(100, '凭证号不能超过100字符')
    .optional(),
  bankInfo: z
    .string()
    .max(500, '银行信息不能超过500字符')
    .optional(),
});

// 更新付款记录验证规则
export const updatePaymentOutRecordSchema = z.object({
  id: z.string().min(1, '付款记录ID不能为空'),
  paymentMethod: paymentOutMethodSchema.optional(),
  paymentAmount: z
    .number()
    .positive('付款金额必须大于0')
    .max(999999999, '付款金额不能超过999,999,999')
    .optional(),
  paymentDate: z
    .string()
    .refine(
      (date) => !isNaN(Date.parse(date)),
      '请输入有效的付款日期'
    )
    .optional(),
  status: paymentOutStatusSchema.optional(),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000字符')
    .optional(),
  voucherNumber: z
    .string()
    .max(100, '凭证号不能超过100字符')
    .optional(),
  bankInfo: z
    .string()
    .max(500, '银行信息不能超过500字符')
    .optional(),
});

// 应付款查询参数验证规则
export const payableRecordQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, '页码必须大于0'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, '每页数量必须在1-100之间'),
  search: z.string().optional(),
  supplierId: z.string().optional(),
  status: payableStatusSchema.optional(),
  sourceType: payableSourceTypeSchema.optional(),
  startDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的开始日期'
    ),
  endDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的结束日期'
    ),
  sortBy: z
    .enum(['createdAt', 'payableAmount', 'dueDate', 'remainingAmount'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// 付款记录查询参数验证规则
export const paymentOutRecordQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, '页码必须大于0'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, '每页数量必须在1-100之间'),
  search: z.string().optional(),
  payableRecordId: z.string().optional(),
  supplierId: z.string().optional(),
  status: paymentOutStatusSchema.optional(),
  paymentMethod: paymentOutMethodSchema.optional(),
  startDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的开始日期'
    ),
  endDate: z
    .string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      '请输入有效的结束日期'
    ),
  sortBy: z
    .enum(['createdAt', 'paymentAmount', 'paymentDate'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// 批量操作验证规则
export const batchPayableOperationSchema = z.object({
  ids: z
    .array(z.string().min(1, 'ID不能为空'))
    .min(1, '至少选择一条记录')
    .max(100, '批量操作不能超过100条记录'),
  operation: z.enum(['delete', 'updateStatus'], {
    errorMap: () => ({ message: '请选择有效的操作类型' }),
  }),
  status: payableStatusSchema.optional(),
});

// 批量付款操作验证规则
export const batchPaymentOutOperationSchema = z.object({
  ids: z
    .array(z.string().min(1, 'ID不能为空'))
    .min(1, '至少选择一条记录')
    .max(100, '批量操作不能超过100条记录'),
  operation: z.enum(['delete', 'updateStatus'], {
    errorMap: () => ({ message: '请选择有效的操作类型' }),
  }),
  status: paymentOutStatusSchema.optional(),
});

// 导出类型
export type CreatePayableRecordData = z.infer<typeof createPayableRecordSchema>;
export type UpdatePayableRecordData = z.infer<typeof updatePayableRecordSchema>;
export type CreatePaymentOutRecordData = z.infer<typeof createPaymentOutRecordSchema>;
export type UpdatePaymentOutRecordData = z.infer<typeof updatePaymentOutRecordSchema>;
export type PayableRecordQuery = z.infer<typeof payableRecordQuerySchema>;
export type PaymentOutRecordQuery = z.infer<typeof paymentOutRecordQuerySchema>;
export type BatchPayableOperation = z.infer<typeof batchPayableOperationSchema>;
export type BatchPaymentOutOperation = z.infer<typeof batchPaymentOutOperationSchema>;
