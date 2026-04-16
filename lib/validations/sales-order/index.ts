/**
 * 销售订单验证规则 - 统一导出
 * 职责：组合各个验证规则模块，提供完整的订单验证Schema
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';
import {
  DEFAULT_SAMPLE_SETTLEMENT_TYPE,
  SAMPLE_SETTLEMENT_TYPE_VALUES,
} from '@/lib/utils/sample-order';

import {
  nullableNumber,
  salesOrderFeeItemSchema,
  salesOrderItemSchema,
  salesOrderStatusSchema,
  salesOrderTypeSchema,
  transferFulfillmentModeSchema,
} from './schemas';
import {
  validateCustomerDirectShipment,
  validateItemCombinations,
  validateManualProductFields,
  validateRequiredFields,
} from './validators';

/**
 * ✅ 基础销售订单验证规则 - 移除.default()避免类型推断问题
 */
const baseSalesOrderSchema = z
  .object({
    orderNumber: z
      .string()
      .min(1, '订单号不能为空')
      .max(50, '订单号不能超过50个字符')
      .optional(), // 订单号可选，由后端自动生成

    customerId: z.string().min(1, '客户不能为空'),

    status: salesOrderStatusSchema, // 移除.default('draft')

    orderType: salesOrderTypeSchema, // 移除.default('NORMAL')

    transferMode: transferFulfillmentModeSchema.optional(), // 移除.default('SUPPLIER_ONLY')
    orderDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '销售日期格式不正确，请使用YYYY-MM-DD格式')
      .optional()
      .or(z.literal('')),

    isSampleOrder: z.boolean().optional(),
    sampleSettlementType: z.enum(SAMPLE_SETTLEMENT_TYPE_VALUES).optional(),

    supplierId: z
      .string()
      .min(1, '供应商不能为空')
      .optional()
      .or(z.literal('')),

    costAmount: nullableNumber(
      z
        .number()
        .min(0, '成本金额不能为负数')
        .max(999999999.99, '成本金额不能超过999,999,999.99')
        .multipleOf(0.01, '成本金额最多保留2位小数')
    ),
    expenseAmount: nullableNumber(
      z
        .number()
        .min(0, '费用金额不能为负数')
        .max(999999999.99, '费用金额不能超过999,999,999.99')
        .multipleOf(0.01, '费用金额最多保留2位小数')
    ),

    roundingAdjustment: nullableNumber(
      z
        .number()
        .min(-999999999.99, '抹零金额不能小于-999,999,999.99')
        .max(999999999.99, '抹零金额不能超过999,999,999.99')
        .multipleOf(0.01, '抹零金额最多保留2位小数')
    ),

    profitAmount: nullableNumber(
      z
        .number()
        .min(0, '毛利金额不能为负数')
        .max(999999999.99, '毛利金额不能超过999,999,999.99')
        .multipleOf(0.01, '毛利金额最多保留2位小数')
    ),

    shippedAt: z
      .string()
      .datetime('发货时间格式不正确')
      .optional()
      .or(z.literal('')),

    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),
    items: z
      .array(salesOrderItemSchema)
      .min(0, '订单明细不能为负')
      .max(100, '订单明细不能超过100条'),

    feeItems: z.array(salesOrderFeeItemSchema).optional(), // 移除.default([])

    itemsAmount: z.number().min(0, '产品金额不能为负数').optional(),
    additionalFees: z.number().min(0, '额外费用不能为负数').optional(),
    totalAmount: z.number().min(0, '总金额不能为负数').optional(),

    // 预收款相关字段
    usePrepayment: z.boolean().optional(), // 移除.default(false)
    prepaymentAmount: nullableNumber(
      z
        .number()
        .min(0, '预收款冲抵金额不能为负数')
        .max(999999999.99, '预收款冲抵金额不能超过999,999,999.99')
        .multipleOf(0.01, '预收款冲抵金额最多保留2位小数')
    ),
  })
  .superRefine((data, ctx) => {
    const status = data.status ?? 'draft';

    if (!Array.isArray(data.items)) {
      return;
    }

    validateRequiredFields(
      data.items,
      status,
      data.orderType,
      data.transferMode,
      ctx
    );

    // 验证客户直发订单的供应商信息
    if (status !== 'draft') {
      validateCustomerDirectShipment(
        data.orderType,
        data.transferMode,
        data.supplierId,
        ctx
      );
    }

    const sampleSettlementType =
      data.sampleSettlementType ?? DEFAULT_SAMPLE_SETTLEMENT_TYPE;
    if (
      data.isSampleOrder &&
      sampleSettlementType === 'FREE' &&
      data.usePrepayment
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['usePrepayment'],
        message: '免费样品单不能使用预收款冲抵',
      });
    }
  });

/**
 * 销售订单创建验证规则
 */
export const salesOrderCreateSchema = baseSalesOrderSchema
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      return data.items && data.items.length > 0;
    },
    {
      message: '至少需要一个订单项',
      path: ['items'],
    }
  )
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      return validateItemCombinations(data.items);
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  )
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      if (data.orderType === 'TRANSFER') {
        return data.supplierId && data.supplierId.trim() !== '';
      }
      return true;
    },
    {
      message: '调货销售必须选择供应商',
      path: ['supplierId'],
    }
  )
  .superRefine((data, ctx) => {
    validateManualProductFields(
      data.items,
      ctx,
      data.status ?? 'draft',
      data.orderType
    );
  });

/**
 * 销售订单更新验证规则
 */
export const salesOrderUpdateSchema = baseSalesOrderSchema
  .partial()
  .extend({
    id: z.string().min(1, '订单编号不能为空'),
  })
  .refine(
    data => {
      if (data.items && data.items.length > 0) {
        return validateItemCombinations(data.items);
      }
      return true;
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  );

/**
 * ✅ 销售订单表单验证规则 - 统一的表单Schema,避免联合类型
 * 用于 React Hook Form,包含创建和编辑两种模式
 */
export const salesOrderFormSchema = baseSalesOrderSchema
  .safeExtend({
    id: z.string().optional(), // 编辑模式需要id,创建模式不需要
  })
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      return data.items && data.items.length > 0;
    },
    {
      message: '至少需要一个订单项',
      path: ['items'],
    }
  )
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      return validateItemCombinations(data.items);
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  )
  .refine(
    data => {
      if (data.status === 'draft') {
        return true;
      }
      if (data.orderType === 'TRANSFER') {
        return data.supplierId && data.supplierId.trim() !== '';
      }
      return true;
    },
    {
      message: '调货销售必须选择供应商',
      path: ['supplierId'],
    }
  )
  .superRefine((data, ctx) => {
    validateManualProductFields(
      data.items,
      ctx,
      data.status ?? 'draft',
      data.orderType
    );
  });

/**
 * 销售订单查询参数验证规则
 */
export const salesOrderQuerySchema = z.object({
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
    .transform(val => (val ? parseInt(val) : paginationConfig.defaultPageSize))
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
      'orderNumber',
      'orderDate',
      'totalAmount',
      'createdAt',
      'updatedAt',
      'status',
      'shippedAt',
    ])
    .nullable()
    .optional()
    .default('orderDate')
    .transform(val => val ?? 'orderDate'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .nullable()
    .optional()
    .default('desc')
    .transform(val => val ?? 'desc'),
  status: z
    .enum([
      'pending',
      'draft',
      'confirmed',
      'shipped',
      'completed',
      'cancelled',
    ])
    .nullable()
    .optional()
    .transform(val => val ?? undefined),
  customerId: z
    .string()
    .nullable()
    .optional()
    .transform(val => val ?? undefined),
  startDate: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || undefined),
  endDate: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || undefined),
  orderType: salesOrderTypeSchema
    .nullable()
    .optional()
    .transform(val => val ?? undefined),
  isSampleOrder: z
    .string()
    .nullable()
    .optional()
    .transform(val => {
      if (val === 'true') {
        return true;
      }
      if (val === 'false') {
        return false;
      }
      return undefined;
    }),
  hasReturns: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val === 'true' ? true : undefined)),
  recordScope: z
    .enum(['history'])
    .nullable()
    .optional()
    .transform(val => val ?? undefined),
  includeTest: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val === 'true' ? true : undefined)),
  includeVoided: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val === 'true' ? true : undefined)),
});

/**
 * 批量删除销售订单验证规则
 */
export const batchDeleteSalesOrdersSchema = z.object({
  salesOrderIds: z
    .array(z.string().min(1, '销售订单编号不能为空'))
    .min(1, '至少需要选择一个销售订单')
    .max(100, '一次最多只能删除100个销售订单'),
});

/**
 * 订单状态更新验证规则
 */
export const updateOrderStatusSchema = z.object({
  id: z.string().min(1, '订单编号不能为空'),
  idempotencyKey: z
    .string()
    .uuid('幂等性键格式不正确')
    .describe('幂等性键,防止重复操作'),
  status: salesOrderStatusSchema,
  remarks: z.string().optional(),
});

// 重新导出基础schema和类型
export * from './schemas';

// 导出验证函数（供测试使用）
export {
  validateItemCombinations,
  validateManualProductFields,
} from './validators';

// 导出类型
export type SalesOrderCreateFormData = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateFormData = z.infer<typeof salesOrderUpdateSchema>;
export type SalesOrderFormData = z.infer<typeof salesOrderFormSchema>;
export type SalesOrderQueryFormData = z.infer<typeof salesOrderQuerySchema>;
export type BatchDeleteSalesOrdersFormData = z.infer<
  typeof batchDeleteSalesOrdersSchema
>;
export type UpdateOrderStatusFormData = z.infer<typeof updateOrderStatusSchema>;

// 兼容性导出（用于测试文件）
export const CreateSalesOrderSchema = salesOrderCreateSchema;

// 销售订单类型选项（用于UI组件）
export const SALES_ORDER_TYPE_OPTIONS = [
  { value: 'NORMAL', label: '普通销售' },
  { value: 'TRANSFER', label: '调货销售' },
] as const;

// 默认表单值
export const salesOrderFormDefaults = {
  customerId: '',
  orderType: 'NORMAL' as const,
  status: 'draft' as const,
  orderDate: '',
  isSampleOrder: false,
  sampleSettlementType: DEFAULT_SAMPLE_SETTLEMENT_TYPE,
  items: [],
  remarks: '',
  totalAmount: 0,
};

// 兼容性类型导出
export type SalesOrderItemData = z.infer<typeof salesOrderItemSchema>;
export type CreateSalesOrderData = SalesOrderCreateFormData;
