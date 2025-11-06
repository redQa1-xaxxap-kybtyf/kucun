/**
 * 销售订单基础Schema定义
 * 职责：定义基础的验证规则、枚举和常量
 */

import { z } from 'zod';

/**
 * 辅助函数：处理可空的数字类型
 */
export const nullableNumber = (schema: z.ZodNumber) =>
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
 * 调货履约模式枚举
 */
export const transferFulfillmentModeSchema = z.enum(['SUPPLIER_ONLY', 'MIXED']);

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
  productId: z.string().min(1, '产品ID不能为空').optional().or(z.literal('')),

  variantId: z
    .string()
    .uuid('产品变体ID格式不正确')
    .optional()
    .or(z.literal('')),

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

  costSubtotal: nullableNumber(
    z
      .number()
      .min(0, '成本小计不能为负数')
      .max(999999.99, '成本小计不能超过999,999.99')
      .multipleOf(0.01, '成本小计最多保留2位小数')
  ),

  profitAmount: nullableNumber(
    z
      .number()
      .min(0, '毛利金额不能为负数')
      .max(999999.99, '毛利金额不能超过999,999.99')
      .multipleOf(0.01, '毛利金额最多保留2位小数')
  ),

  localQuantity: nullableNumber(
    z
      .number()
      .min(0, '本地发货数量不能为负数')
      .max(999999.99, '本地发货数量不能超过999,999.99')
      .multipleOf(0.01, '本地发货数量最多保留2位小数')
  ),

  transferQuantity: nullableNumber(
    z
      .number()
      .min(0, '调货数量不能为负数')
      .max(999999.99, '调货数量不能超过999,999.99')
      .multipleOf(0.01, '调货数量最多保留2位小数')
  ),

  // 手动输入产品信息（调货销售时使用）
  isManualProduct: z.boolean().optional(),

  manualProductName: z
    .string()
    .max(100, '产品名称不能超过100个字符')
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

  weightPerPieceKg: nullableNumber(
    z
      .number()
      .min(0, '重量不能为负数')
      .max(99999.9999, '重量不能超过99,999.9999')
      .multipleOf(0.0001, '重量最多保留4位小数')
  ),
});

// 导出类型
export type SalesOrderItemFormData = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderFeeItemFormData = z.infer<typeof salesOrderFeeItemSchema>;
export type SalesOrderStatusType = z.infer<typeof salesOrderStatusSchema>;
export type SalesOrderTypeType = z.infer<typeof salesOrderTypeSchema>;
