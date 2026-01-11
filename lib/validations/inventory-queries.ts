import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

import { baseValidations } from './inventory-base';

/**
 * 库存查询验证规则
 * 包含库存查询、入库记录查询、出库记录查询、库存预警等API验证规则
 */

// 库存可用性检查验证规则
export const inventoryAvailabilityCheckSchema = z.object({
  productId: baseValidations.productId,
  quantity: baseValidations.quantity,
  variantId: z.string().optional(),
  batchNumber: z.string().optional(),
  location: z.string().optional(),
});

// 库存预警查询验证规则
export const inventoryAlertsQuerySchema = z.object({
  severity: z
    .enum(['all', 'critical', 'warning', 'info'])
    .optional()
    .default('all'),

  limit: z
    .number()
    .int()
    .positive()
    .max(100, '每页数量不能超过100')
    .optional()
    .default(50),

  productId: z.string().uuid().optional(),

  categoryId: z.string().uuid().optional(),
});

// 库存调整查询验证规则
export const inventoryAdjustmentsQuerySchema = z
  .object({
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
      .refine(
        val => val > 0 && val <= paginationConfig.maxPageSize,
        `每页数量必须在1-${paginationConfig.maxPageSize}之间`
      ),

    search: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    sortBy: z
      .enum(['createdAt', 'adjustmentNumber', 'quantity', 'reason'])
      .nullable()
      .optional()
      .transform(val => val || 'createdAt'),

    sortOrder: z
      .string()
      .nullable()
      .optional()
      .transform(val => (val === 'asc' ? 'asc' : 'desc')),

    productId: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    variantId: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    batchNumber: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    reason: z
      .enum([
        'inventory_gain',
        'inventory_loss',
        'damage_loss',
        'surplus_gain',
        'transfer',
        'other',
      ])
      .nullable()
      .optional()
      .transform(val => val || undefined),

    status: z
      .enum(['pending', 'approved', 'rejected', 'completed'])
      .nullable()
      .optional()
      .transform(val => val || undefined),

    operatorId: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    startDate: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined)
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), '日期格式不正确'),

    endDate: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined)
      .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), '日期格式不正确'),
  })
  .refine(
    data => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 库存查询API验证规则
export const inventoryQuerySchema = z
  .object({
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
      .transform(val =>
        val ? parseInt(val) : paginationConfig.defaultPageSize
      )
      .refine(
        val => val > 0 && val <= paginationConfig.maxPageSize,
        `每页数量必须在1-${paginationConfig.maxPageSize}之间`
      ),

    search: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    sortBy: z
      .enum([
        'updatedAt',
        'createdAt',
        'quantity',
        'reservedQuantity',
        'batchNumber',
        'productId',
      ])
      .nullable()
      .optional()
      .transform(val => val || 'updatedAt'),

    sortOrder: z
      .string()
      .nullable()
      .optional()
      .transform(val => (val === 'asc' ? 'asc' : 'desc')),

    productId: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    batchNumber: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    location: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    categoryId: z
      .string()
      .nullable()
      .optional()
      .transform(val => val?.trim() || undefined),

    lowStock: z
      .string()
      .nullable()
      .optional()
      .transform(val => val === 'true'),

    hasStock: z
      .string()
      .nullable()
      .optional()
      .transform(val => val === 'true'),

    startDate: z
      .string()
      .nullable()
      .optional()
      .transform(val => {
        const trimmed = val?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : undefined;
      })
      .refine(
        val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
        '开始日期格式不正确'
      ),

    endDate: z
      .string()
      .nullable()
      .optional()
      .transform(val => {
        const trimmed = val?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : undefined;
      })
      .refine(
        val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
        '结束日期格式不正确'
      ),

    // 移除悬空的变体相关参数，因为当前系统不支持产品变体功能
    // groupByVariant: z
    //   .string()
    //   .nullable()
    //   .optional()
    //   .transform(val => val === 'true'),

    // includeVariants: z
    //   .string()
    //   .nullable()
    //   .optional()
    //   .transform(val => val === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '开始日期不能晚于结束日期',
          path: ['endDate'],
        });
      }
    }
  });

// 库存搜索表单验证
export const inventorySearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
  productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
  batchNumber: z
    .string()
    .max(50, '批次号不能超过50个字符')
    .optional()
    .or(z.literal('')),
  lowStock: z.boolean().optional(),
  hasStock: z.boolean().optional(),
  sortBy: z
    .enum(['quantity', 'reservedQuantity', 'updatedAt'])
    .default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 入库记录搜索表单验证
export const inboundRecordSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    type: z
      .enum(['normal_inbound', 'return_inbound', 'adjust_inbound'])
      .optional()
      .or(z.literal('')),
    productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
    userId: z.string().uuid('用户ID格式不正确').optional().or(z.literal('')),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确')
      .optional()
      .or(z.literal('')),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确')
      .optional()
      .or(z.literal('')),
    sortBy: z
      .enum(['createdAt', 'recordNumber', 'quantity', 'totalCost'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 出库记录搜索表单验证
export const outboundRecordSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    type: z
      .enum(['normal_outbound', 'sales_outbound', 'adjust_outbound'])
      .optional()
      .or(z.literal('')),
    productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
    customerId: z
      .string()
      .uuid('客户ID格式不正确')
      .optional()
      .or(z.literal('')),
    salesOrderId: z
      .string()
      .uuid('销售订单ID格式不正确')
      .optional()
      .or(z.literal('')),
    userId: z.string().uuid('用户ID格式不正确').optional().or(z.literal('')),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确')
      .optional()
      .or(z.literal('')),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确')
      .optional()
      .or(z.literal('')),
    sortBy: z
      .enum(['createdAt', 'recordNumber', 'quantity', 'totalCost'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 表单数据类型推导
export type InventoryAvailabilityCheckInput = z.infer<
  typeof inventoryAvailabilityCheckSchema
>;
export type InventorySearchFormData = z.infer<typeof inventorySearchSchema>;
export type InboundRecordSearchFormData = z.infer<
  typeof inboundRecordSearchSchema
>;
export type OutboundRecordSearchFormData = z.infer<
  typeof outboundRecordSearchSchema
>;

// 表单默认值
export const inventorySearchDefaults: InventorySearchFormData = {
  search: '',
  productId: '',
  batchNumber: '',
  lowStock: undefined,
  hasStock: undefined,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

export const inboundRecordSearchDefaults: InboundRecordSearchFormData = {
  search: '',
  type: '',
  productId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const outboundRecordSearchDefaults: OutboundRecordSearchFormData = {
  search: '',
  type: '',
  productId: '',
  customerId: '',
  salesOrderId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
