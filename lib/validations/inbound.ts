// 产品入库验证规则
// 使用 Zod 定义完整的验证规则，确保前后端统一的类型安全验证

import { z } from 'zod';

export type { InboundReason } from '@/lib/types/inbound';

// 入库原因验证
export const inboundReasonSchema = z.enum([
  'purchase',
  'return',
  'transfer',
  'surplus',
  'other',
  'sales_cancel',
  'return_inbound',
  'opening_balance',
] as const);

// 入库单位类型
export const inboundUnitSchema = z.enum(['pieces', 'units'] as const);

// 创建入库记录验证规则
export const createInboundSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(1, '幂等性键不能为空')
      .max(100, '幂等性键过长')
      .describe('幂等性键,防止重复操作'),

    productId: z.string().min(1, '请选择产品'),

    variantId: z.string().uuid('产品变体ID格式不正确').optional(),

    // 用户输入的数量（根据选择的单位）
    // ✅ 使用 z.preprocess 正确处理 undefined、null、空字符串
    inputQuantity: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined ? '请填写入库数量' : '数量必须是数字',
        })
        .min(1, { message: '数量必须大于等于1' })
        .max(999999, { message: '数量不能超过999999' })
        .int({ message: '数量必须是整数' })
    ),

    // 用户选择的单位
    inputUnit: inboundUnitSchema.default('pieces'),

    // 最终存储的片数（由前端计算后传入）
    // ✅ 使用 z.preprocess 正确处理 undefined、null、空字符串
    quantity: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined ? '最终片数不能为空' : '数量必须是数字',
        })
        .min(1, { message: '数量必须大于等于1片' })
        .max(999999, { message: '数量不能超过999999片' })
        .int({ message: '数量必须是整数' })
    ),

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
    // ✅ 修复：批次号设为必填，符合瓷砖行业要求
    batchNumber: z
      .string({ message: '批次号/色号为必填项' })
      .min(1, '批次号/色号不能为空')
      .max(50, '批次号不能超过50个字符')
      .transform(val => val?.trim()), // 去除首尾空格

    purchaseOrderId: z
      .string()
      .uuid('采购订单ID格式不正确')
      .optional()
      .or(z.literal(''))
      .transform(val =>
        val && val.trim().length > 0 ? val.trim() : undefined
      ),

    purchaseOrderItemId: z
      .string()
      .uuid('采购订单明细ID格式不正确')
      .optional()
      .or(z.literal(''))
      .transform(val =>
        val && val.trim().length > 0 ? val.trim() : undefined
      ),

    // 产品参数字段（入库时确定）
    // ✅ 使用 z.preprocess 正确处理 undefined、null、空字符串
    piecesPerUnit: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({ message: '每单位片数必须是数字' })
        .int({ message: '每单位片数必须是整数' })
        .min(1, { message: '每单位片数至少为1' })
        .max(10000, { message: '每单位片数不能超过10000' })
        .optional()
    ),

    weight: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({ message: '重量必须是数字' })
        .min(0.01, { message: '重量必须大于0' })
        .max(10000, { message: '重量不能超过10000kg' })
        .optional()
    ),

    // 成本字段（入库时必填）
    // ✅ 使用 z.preprocess 正确处理 undefined、null、空字符串，避免 NaN 错误
    unitCost: z.preprocess(
      val => {
        // 处理 undefined、null、空字符串
        if (val === undefined || val === null || val === '') {
          return undefined;
        }

        // 转换为数字
        const num = typeof val === 'number' ? val : Number(val);

        // 如果转换失败，返回 undefined（触发后续验证错误）
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined ? '请填写单位成本' : '单位成本必须是数字',
        })
        .min(0.01, { message: '单位成本必须大于0' })
        .max(999999.99, { message: '单位成本不能超过999,999.99' })
        .multipleOf(0.01, { message: '单位成本最多保留2位小数' })
    ),
  })
  .refine(data => !data.purchaseOrderItemId || Boolean(data.purchaseOrderId), {
    message: '传入采购订单明细时必须指定采购订单ID',
    path: ['purchaseOrderId'],
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
        [
          'purchase',
          'return',
          'transfer',
          'surplus',
          'other',
          'sales_cancel',
          'return_inbound',
        ].includes(val),
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

// ✅ 表单专用 Schema - 不含 transform 和 default,用于 React Hook Form
// 遵循 DRY 和 SRP 原则: 基于 createInboundSchema,但移除 transform/default 避免类型推断问题
export const inboundFormSchema = z
  .object({
    productId: z.string().min(1, '请选择产品'),

    variantId: z.string().uuid('产品变体ID格式不正确').optional(),

    // 用户输入的数量（根据选择的单位）- ✅ 修复：使用 optional + refine 实现必填验证
    inputQuantity: z
      .preprocess(
        val => {
          if (val === undefined || val === null || val === '') {
            return undefined;
          }
          const num = typeof val === 'number' ? val : Number(val);
          return Number.isNaN(num) ? undefined : num;
        },
        z
          .number()
          .min(1, { message: '入库数量必须大于0' })
          .max(999999, { message: '入库数量不能超过999999' })
          .int({ message: '入库数量必须是整数' })
          .optional()
      )
      .refine(val => val !== undefined && val !== null, {
        message: '请输入入库数量',
      }),

    // 用户选择的单位 - ✅ 移除 .default()
    inputUnit: inboundUnitSchema,

    // 最终存储的片数（由前端计算后传入）- ✅ 修复：使用 optional + refine 实现必填验证
    quantity: z
      .preprocess(
        val => {
          if (val === undefined || val === null || val === '') {
            return undefined;
          }
          const num = typeof val === 'number' ? val : Number(val);
          return Number.isNaN(num) ? undefined : num;
        },
        z
          .number()
          .min(1, { message: '最终片数必须大于0' })
          .max(999999, { message: '最终片数不能超过999999' })
          .int({ message: '最终片数必须是整数' })
          .optional()
      )
      .refine(val => val !== undefined && val !== null, {
        message: '最终片数不能为空',
      }),

    reason: inboundReasonSchema, // ✅ 移除 .default()

    remarks: z
      .string()
      .max(500, '备注不能超过500个字符')
      .optional()
      .refine(
        val => !val || !/<script|<iframe|javascript:|onerror=/i.test(val),
        '备注包含不安全的内容'
      ), // ✅ 移除 .transform()

    // 批次管理字段
    // ✅ 修复：批次号设为必填
    batchNumber: z
      .string({ message: '批次号/色号为必填项' })
      .min(1, '批次号/色号不能为空')
      .max(50, '批次号不能超过50个字符'),

    purchaseOrderId: z
      .string()
      .uuid('采购订单ID格式不正确')
      .optional()
      .or(z.literal('')),

    purchaseOrderItemId: z
      .string()
      .uuid('采购订单明细ID格式不正确')
      .optional()
      .or(z.literal('')),

    supplierId: z.string().uuid('供应商ID格式不正确').optional(),

    productionDate: z
      .string()
      .refine(val => !val || !isNaN(Date.parse(val)), '生产日期格式不正确')
      .optional(),

    colorCode: z.string().max(50, '色号不能超过50个字符').optional(),

    location: z.string().max(100, '存储位置不能超过100个字符').optional(),

    // 批次规格参数
    piecesPerUnit: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined
              ? '每单位片数不能为空'
              : '每单位片数必须是数字',
        })
        .min(1, { message: '每单位片数必须大于等于1' })
        .max(999999, { message: '每单位片数不能超过999999' })
        .int({ message: '每单位片数必须是整数' })
        .optional()
    ),

    weight: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined ? '重量不能为空' : '重量必须是数字',
        })
        .min(0.01, { message: '重量必须大于0' })
        .max(999999.99, { message: '重量不能超过999,999.99' })
        .multipleOf(0.01, { message: '重量最多保留2位小数' })
        .optional()
    ),

    thickness: z.preprocess(
      val => {
        if (val === undefined || val === null || val === '') {
          return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isNaN(num) ? undefined : num;
      },
      z
        .number({
          error: issue =>
            issue.input === undefined ? '厚度不能为空' : '厚度必须是数字',
        })
        .min(0.01, { message: '厚度必须大于0' })
        .max(999.99, { message: '厚度不能超过999.99' })
        .multipleOf(0.01, { message: '厚度最多保留2位小数' })
        .optional()
    ),

    // 成本字段（入库时必填）- ✅ 修复：使用 optional + refine 实现必填验证
    unitCost: z
      .preprocess(
        val => {
          if (val === undefined || val === null || val === '') {
            return undefined;
          }
          const num = typeof val === 'number' ? val : Number(val);
          return Number.isNaN(num) ? undefined : num;
        },
        z
          .number()
          .min(0.01, { message: '单位成本必须大于0' })
          .max(999999.99, { message: '单位成本不能超过999,999.99' })
          .multipleOf(0.01, { message: '单位成本最多保留2位小数' })
          .optional()
      )
      .refine(val => val !== undefined && val !== null, {
        message: '请输入单位成本',
      }),
  })
  .refine(data => !data.purchaseOrderItemId || Boolean(data.purchaseOrderId), {
    message: '传入采购订单明细时必须指定采购订单ID',
    path: ['purchaseOrderId'],
  });

// 类型导出
export type CreateInboundData = z.infer<typeof createInboundSchema>;
export type UpdateInboundData = z.infer<typeof updateInboundSchema>;
export type InboundQueryData = z.infer<typeof inboundQuerySchema>;
export type BatchInboundData = z.infer<typeof batchInboundSchema>;
export type InboundIdData = z.infer<typeof inboundIdSchema>;
export type ProductSearchData = z.infer<typeof productSearchSchema>;
// ✅ 表单数据类型 - 用于 React Hook Form
export type InboundFormData = z.infer<typeof inboundFormSchema>;

// 验证辅助函数
export const validateInboundReason = (
  reason: string
): reason is InboundReason =>
  [
    'purchase',
    'return',
    'transfer',
    'surplus',
    'other',
    'sales_cancel',
    'return_inbound',
  ].includes(reason);

// 数量格式化辅助函数
export const formatQuantity = (quantity: number): number =>
  Math.round(quantity * 100) / 100;

// 备注清理辅助函数
export const cleanRemarks = (remarks?: string): string | undefined => {
  if (!remarks) {
    return undefined;
  }
  const cleaned = remarks.trim();
  return cleaned.length > 0 ? cleaned : undefined;
};
