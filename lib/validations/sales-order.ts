/**
 * 销售订单验证规则 - 唯一真理源
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

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
 * 销售订单明细验证规则
 */
export const salesOrderItemSchema = z.object({
  productId: z.string().min(1, '产品ID不能为空').optional(),

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
    .min(0.01, '数量必须大于0')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数'),

  // 系统内部存储的数量（始终以片为单位）
  quantity: z
    .number()
    .min(0.01, '数量必须大于0')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数'),

  // 保留原有的unit字段用于兼容性（从产品数据获取）
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),

  unitPrice: z
    .number()
    .min(0.01, '单价必须大于0')
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
  unitCost: z
    .number()
    .min(0.01, '成本价必须大于0')
    .max(999999.99, '成本价不能超过999,999.99')
    .multipleOf(0.01, '成本价最多保留2位小数')
    .optional(),

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

  manualWeight: z
    .number()
    .min(0, '重量不能为负数')
    .max(99999.99, '重量不能超过99,999.99')
    .multipleOf(0.01, '重量最多保留2位小数')
    .optional(),

  manualUnit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 基础销售订单验证规则
 */
const baseSalesOrderSchema = z.object({
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

  costAmount: z
    .number()
    .min(0, '成本金额不能为负数')
    .max(999999999.99, '成本金额不能超过999,999,999.99')
    .multipleOf(0.01, '成本金额最多保留2位小数')
    .optional(),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .or(z.literal('')),

  items: z
    .array(salesOrderItemSchema)
    .min(1, '至少需要一个订单项')
    .max(100, '订单明细不能超过100条'),

  totalAmount: z.number().min(0, '总金额不能为负数').optional(),
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
  .refine(data => validateItemCombinations(data.items), {
    message: '订单明细中存在重复的产品规格组合',
    path: ['items'],
  })
  .refine(
    data => {
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
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z
    .enum(['orderNumber', 'totalAmount', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: salesOrderStatusSchema.optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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
  status: salesOrderStatusSchema,
  notes: z.string().optional(),
});

// 导出类型
export type SalesOrderCreateFormData = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateFormData = z.infer<typeof salesOrderUpdateSchema>;
export type SalesOrderQueryFormData = z.infer<typeof salesOrderQuerySchema>;
export type SalesOrderItemFormData = z.infer<typeof salesOrderItemSchema>;
export type BatchDeleteSalesOrdersFormData = z.infer<
  typeof batchDeleteSalesOrdersSchema
>;
export type UpdateOrderStatusFormData = z.infer<typeof updateOrderStatusSchema>;
export type SalesOrderStatusType = z.infer<typeof salesOrderStatusSchema>;
export type SalesOrderTypeType = z.infer<typeof salesOrderTypeSchema>;
