/**
 * 销售订单验证规则 - 唯一真理源
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

const nullableNumber = (schema: z.ZodNumber) =>
  z
    .union([schema, z.null(), z.undefined()])
    .transform(value =>
      value === null || value === undefined ? undefined : value
    );

/**
 * 销售订单状态枚举
 */
export const salesOrderStatusSchema = z.enum([
  'draft', // 草稿
  'confirmed', // 已确认
  'shipped', // 已发货
  'completed', // 已完成
  'cancelled', // 已取消
]);

/**
 * 销售订单类型枚举
 */
export const salesOrderTypeSchema = z.enum(['NORMAL', 'TRANSFER']);

/**
 * 销售订单费用项验证规则
 */
export const salesOrderFeeItemSchema = z.object({
  id: z.string().optional(),
  feeType: z.enum(['processing', 'shipping', 'other']),
  feeName: z
    .string()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符'),
  feeAmount: z
    .number()
    .min(0, '费用金额不能为负数')
    .max(999999.99, '费用金额不能超过999,999.99')
    .multipleOf(0.01, '费用金额最多保留2位小数'),
  remarks: z
    .string()
    .max(200, '备注不能超过200个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 销售订单明细验证规则
 */
export const salesOrderItemSchema = z.object({
  productId: z.string().min(1, '产品ID不能为空').optional(),

  productCode: z
    .string()
    .max(50, '产品编码不能超过50个字符')
    .optional()
    .or(z.literal('')),

  batchNumber: z
    .string()
    .max(50, '批次号不能超过50个字符')
    .optional()
    .or(z.literal('')),

  colorCode: z
    .string()
    .max(20, '色号不能超过20个字符')
    .optional()
    .or(z.literal('')),

  productionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '生产日期格式不正确，请使用YYYY-MM-DD格式')
    .optional()
    .or(z.literal('')),

  specification: z
    .string()
    .max(100, '规格不能超过100个字符')
    .optional()
    .or(z.literal('')),

  // 用户界面显示的单位（片或件）
  displayUnit: z.enum(['片', '件']).default('片'),

  // 用户界面输入的数量（根据displayUnit）
  displayQuantity: z
    .number()
    .min(0, '数量不能为负数')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数')
    .optional(),

  // 系统内部存储的数量（始终以片为单位）
  quantity: z
    .number()
    .min(0, '数量不能为负数')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数')
    .optional(),

  // 保留原有的unit字段用于兼容性（从产品数据获取）
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),

  unitPrice: z
    .number()
    .min(0, '单价不能为负数')
    .max(999999.99, '单价不能超过999,999.99')
    .multipleOf(0.01, '单价最多保留2位小数')
    .optional(),

  piecesPerUnit: z
    .number()
    .min(1, '每件片数必须大于0')
    .max(9999, '每件片数不能超过9999')
    .optional(),

  remarks: z
    .string()
    .max(200, '备注不能超过200个字符')
    .optional()
    .or(z.literal('')),

  subtotal: z.number().min(0, '小计不能为负数').optional(),

  // 调货销售相关字段
  unitCost: nullableNumber(
    z
      .number()
      .min(0, '成本价不能为负数')
      .max(999999.99, '成本价不能超过999,999.99')
      .multipleOf(0.01, '成本价最多保留2位小数')
  ),

  // 手动输入商品信息（调货销售时使用）
  isManualProduct: z.boolean().optional(),

  manualProductName: z
    .string()
    .max(100, '商品名称不能超过100个字符')
    .optional()
    .or(z.literal('')),

  manualSpecification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal('')),

  manualWeight: nullableNumber(
    z
      .number()
      .min(0, '重量不能为负数')
      .max(99999.99, '重量不能超过99,999.99')
      .multipleOf(0.01, '重量最多保留2位小数')
  ),

  manualUnit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 基础销售订单验证规则
 */
const baseSalesOrderSchema = z
  .object({
    orderNumber: z
      .string()
      .min(1, '订单号不能为空')
      .max(50, '订单号不能超过50个字符')
      .optional(), // 订单号可选，由后端自动生成

    customerId: z.string().min(1, '客户ID不能为空'),

    status: salesOrderStatusSchema.default('draft'),

    orderType: salesOrderTypeSchema.default('NORMAL'),

    supplierId: z
      .string()
      .min(1, '供应商ID不能为空')
      .optional()
      .or(z.literal('')),

    costAmount: nullableNumber(
      z
        .number()
        .min(0, '成本金额不能为负数')
        .max(999999999.99, '成本金额不能超过999,999,999.99')
        .multipleOf(0.01, '成本金额最多保留2位小数')
    ),

    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),

    items: z
      .array(salesOrderItemSchema)
      .min(0, '订单明细不能为负')
      .max(100, '订单明细不能超过100条'),

    feeItems: z.array(salesOrderFeeItemSchema).optional().default([]),

    itemsAmount: z.number().min(0, '商品金额不能为负数').optional(),
    additionalFees: z.number().min(0, '额外费用不能为负数').optional(),
    totalAmount: z.number().min(0, '总金额不能为负数').optional(),

    // ✅ 预收款相关字段
    usePrepayment: z.boolean().optional().default(false), // 是否使用预收款冲抵
    prepaymentAmount: nullableNumber(
      z
        .number()
        .min(0, '预收款冲抵金额不能为负数')
        .max(999999999.99, '预收款冲抵金额不能超过999,999,999.99')
        .multipleOf(0.01, '预收款冲抵金额最多保留2位小数')
    ), // 手动指定冲抵金额(可选,默认自动计算)
  })
  .superRefine((data, ctx) => {
    const status = data.status ?? 'draft';

    if (status === 'draft' || !Array.isArray(data.items)) {
      return;
    }

    data.items.forEach((item, index) => {
      if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '非草稿订单的明细必须填写数量',
          path: ['items', index, 'quantity'],
        });
      }

      if (typeof item.unitPrice !== 'number' || Number.isNaN(item.unitPrice)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '非草稿订单的明细必须填写单价',
          path: ['items', index, 'unitPrice'],
        });
      }
    });
  });

/**
 * 验证订单明细组合唯一性的函数
 */
function validateItemCombinations(items: SalesOrderItemFormData[]): boolean {
  const combinations = new Set();
  for (const item of items) {
    const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;
    if (combinations.has(key)) {
      return false;
    }
    combinations.add(key);
  }
  return true;
}

/**
 * 销售订单创建验证规则
 */
export const salesOrderCreateSchema = baseSalesOrderSchema
  .refine(
    data => {
      // 草稿状态允许空订单项
      if (data.status === 'draft') {
        return true;
      }
      // 非草稿状态至少需要一个订单项
      return data.items && data.items.length > 0;
    },
    {
      message: '至少需要一个订单项',
      path: ['items'],
    }
  )
  .refine(
    data => {
      // 草稿状态使用宽松验证
      if (data.status === 'draft') {
        return true;
      }
      // 非草稿状态验证组合唯一性
      return validateItemCombinations(data.items);
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  )
  .refine(
    data => {
      // 草稿状态跳过验证
      if (data.status === 'draft') {
        return true;
      }
      // 调货销售必须填写供应商
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
  .refine(
    data => {
      // 草稿状态跳过验证
      if (data.status === 'draft') {
        return true;
      }
      // 调货销售必须填写成本金额
      if (data.orderType === 'TRANSFER') {
        return data.costAmount !== undefined && data.costAmount > 0;
      }
      return true;
    },
    {
      message: '调货销售必须填写成本金额',
      path: ['costAmount'],
    }
  )
  .refine(
    data => {
      // 草稿状态跳过验证
      if (data.status === 'draft') {
        return true;
      }
      // 验证手动输入商品的必填字段
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (item.isManualProduct) {
          // 手动输入商品必须有商品名称
          if (!item.manualProductName || item.manualProductName.trim() === '') {
            return false;
          }
          // 手动输入商品不需要productId
        } else {
          // 非手动输入商品必须有productId
          if (!item.productId || item.productId.trim() === '') {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: '手动输入商品必须填写商品名称，库存商品必须选择产品',
      path: ['items'],
    }
  );

/**
 * 销售订单更新验证规则
 */
export const salesOrderUpdateSchema = baseSalesOrderSchema
  .partial()
  .extend({
    id: z.string().min(1, 'ID不能为空'),
  })
  .refine(
    data => {
      // 只有当items存在时才验证组合唯一性
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
    .enum(['orderNumber', 'totalAmount', 'createdAt', 'updatedAt', 'status'])
    .nullable()
    .optional()
    .default('createdAt')
    .transform(val => val ?? 'createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .nullable()
    .optional()
    .default('desc')
    .transform(val => val ?? 'desc'),
  status: salesOrderStatusSchema
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
});

/**
 * 批量删除销售订单验证规则
 */
export const batchDeleteSalesOrdersSchema = z.object({
  salesOrderIds: z
    .array(z.string().min(1, '销售订单ID不能为空'))
    .min(1, '至少需要选择一个销售订单')
    .max(100, '一次最多只能删除100个销售订单'),
});

/**
 * 订单状态更新验证规则
 */
export const updateOrderStatusSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
  idempotencyKey: z
    .string()
    .uuid('幂等性键格式不正确')
    .describe('幂等性键,防止重复操作'),
  status: salesOrderStatusSchema,
  remarks: z.string().optional(),
});

// 导出类型
export type SalesOrderCreateFormData = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateFormData = z.infer<typeof salesOrderUpdateSchema>;
export type SalesOrderQueryFormData = z.infer<typeof salesOrderQuerySchema>;
export type SalesOrderItemFormData = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderFeeItemFormData = z.infer<typeof salesOrderFeeItemSchema>;
export type BatchDeleteSalesOrdersFormData = z.infer<
  typeof batchDeleteSalesOrdersSchema
>;
export type UpdateOrderStatusFormData = z.infer<typeof updateOrderStatusSchema>;
export type SalesOrderStatusType = z.infer<typeof salesOrderStatusSchema>;
export type SalesOrderTypeType = z.infer<typeof salesOrderTypeSchema>;

// 兼容性导出（用于测试文件）
export const CreateSalesOrderSchema = salesOrderCreateSchema;

// 销售订单类型选项（用于测试文件）
export const SALES_ORDER_TYPE_OPTIONS = [
  { value: 'NORMAL', label: '普通销售' },
  { value: 'TRANSFER', label: '调货销售' },
] as const;

// 兼容性导出：从 lib/schemas/sales-order.ts 迁移
export const salesOrderFormDefaults = {
  customerId: '',
  orderType: 'NORMAL' as const,
  status: 'draft' as const,
  items: [],
  remarks: '',
  totalAmount: 0,
};

// 兼容性类型导出
export type SalesOrderItemData = SalesOrderItemFormData;
export type CreateSalesOrderData = SalesOrderCreateFormData;
// SalesOrderUpdateFormData 已在上面定义，包含了 id 字段（通过 salesOrderUpdateSchema.extend({ id: ... })）
