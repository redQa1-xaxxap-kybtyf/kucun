/**
 * 厂家发货订单验证规则 - 统一导出
 * 职责：组合各个验证规则模块，提供完整的订单验证Schema
 */

import { z } from 'zod';

import { FACTORY_SHIPMENT_ITEM_OWNERSHIP } from '@/lib/types/factory-shipment';

import {
  factoryShipmentFeeItemSchema,
  factoryShipmentOrderItemSchema,
  factoryShipmentOrderListParamsSchema,
  factoryShipmentStatusSchema,
  updateFactoryShipmentOrderStatusSchema,
} from './schemas';
import {
  validateFactoryShipmentItems,
  validateStatusFieldRequirements,
} from './validators';

/**
 * 创建厂家发货订单验证（创建时集装箱号码为可选）
 */
export const createFactoryShipmentOrderSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .optional()
      .describe('幂等性键,防止重复操作'),
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional()
      .or(z.literal('')),
    customerId: z.string().min(1, '请选择客户'),
    status: factoryShipmentStatusSchema.optional(),
    totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
    receivableAmount: z.number().min(0, '应收金额不能为负数').optional(),
    depositAmount: z.number().min(0, '定金金额不能为负数').optional(),
    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),
    items: z
      .array(factoryShipmentOrderItemSchema)
      .min(1, '至少需要添加一个产品'),
    feeItems: z.array(factoryShipmentFeeItemSchema).optional().default([]),
  })
  .refine(
    data => {
      // 定金不能超过应收金额
      if (
        data.depositAmount &&
        data.receivableAmount &&
        data.depositAmount > data.receivableAmount
      ) {
        return false;
      }
      return true;
    },
    {
      message: '定金金额不能超过应收金额',
      path: ['depositAmount'],
    }
  )
  .superRefine((data, ctx) => {
    // 验证订单明细的所有业务规则
    validateFactoryShipmentItems(data.items, data.status, ctx);

    // 验证状态相关的必填字段
    validateStatusFieldRequirements(
      data.status,
      { containerNumber: data.containerNumber },
      ctx
    );
  });

/**
 * 更新厂家发货订单验证
 */
export const updateFactoryShipmentOrderSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .describe('幂等性键,防止重复操作'),
    containerNumber: z
      .string()
      .min(1, '集装箱号码不能为空')
      .max(50, '集装箱号码不能超过50个字符')
      .optional(),
    shippingCompany: z
      .string()
      .max(100, '船运公司名称不能超过100个字符')
      .optional()
      .or(z.literal('')),
    estimatedArrival: z.date().optional(),
    customerId: z.string().uuid('客户ID格式不正确').optional(),
    status: factoryShipmentStatusSchema.optional(),
    totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
    receivableAmount: z.number().min(0, '应收金额不能为负数').optional(),
    depositAmount: z.number().min(0, '定金金额不能为负数').optional(),
    paidAmount: z.number().min(0, '已付金额不能为负数').optional(),
    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),
    shipmentDate: z.date().optional(),
    arrivalDate: z.date().optional(),
    deliveryDate: z.date().optional(),
    completionDate: z.date().optional(),
    items: z
      .array(factoryShipmentOrderItemSchema)
      .min(1, '至少需要添加一个产品')
      .optional(),
    feeItems: z.array(factoryShipmentFeeItemSchema).optional().default([]),
  })
  .refine(
    data => {
      // 定金不能超过应收金额
      if (
        data.depositAmount &&
        data.receivableAmount &&
        data.depositAmount > data.receivableAmount
      ) {
        return false;
      }
      // 已付金额不能超过应收金额
      if (
        data.paidAmount &&
        data.receivableAmount &&
        data.paidAmount > data.receivableAmount
      ) {
        return false;
      }
      return true;
    },
    {
      message: '金额设置不合理',
      path: ['depositAmount'],
    }
  )
  .superRefine((data, ctx) => {
    // 验证订单明细（如果提供了）
    if (Array.isArray(data.items) && data.items.length > 0) {
      validateFactoryShipmentItems(data.items, data.status, ctx);
    }

    // 验证状态相关的必填字段
    validateStatusFieldRequirements(
      data.status,
      {
        containerNumber: data.containerNumber,
        shippingCompany: data.shippingCompany,
      },
      ctx
    );
  });

/**
 * ✅ 厂家发货订单表单验证 - 表单专用Schema,移除.default()和.transform()
 * 用于 React Hook Form,避免类型推断问题
 */

// 表单专用的订单明细项Schema - 移除.transform()和.default()
// 使用 preprocess 处理字符串输入，避免输入过程中的验证错误
const coerceNumber = (val: unknown) => {
  if (val === '' || val === undefined || val === null) return 0;
  if (typeof val === 'string') {
    // 处理输入中间状态（如 "12."）
    if (val.endsWith('.')) return Number.parseFloat(`${val}0`);
    const parsed = Number.parseFloat(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return typeof val === 'number' ? val : 0;
};

const factoryShipmentOrderItemFormSchema = z.object({
  // ✅ 允许初始状态为 undefined，避免 Zod 报 "expected string, received undefined"
  productId: z.string().uuid('产品ID格式不正确').optional().nullable(),
  supplierId: z.string().min(1, '请选择供应商').optional().or(z.literal('')),
  productCode: z
    .string()
    .max(50, '产品编码不能超过50个字符')
    .optional()
    .or(z.literal('')),
  batchNumber: z
    .string()
    .max(100, '批次号不能超过100个字符')
    .optional()
    .or(z.literal('')),
  quantity: z.preprocess(coerceNumber, z.number().positive('数量必须大于0')),
  unitPrice: z.preprocess(coerceNumber, z.number().min(0, '单价不能为负数')),
  unitCost: z
    .preprocess(coerceNumber, z.number().min(0, '进货价不能为负数'))
    .optional(),
  // 客户直发场景下，货物归属默认为客户，UI 不再显示此字段
  ownership: z
    .nativeEnum(FACTORY_SHIPMENT_ITEM_OWNERSHIP)
    .default(FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER),
  customerDeliveryStatus: z.enum(['pending', 'delivered']).optional(),
  selfInboundStatus: z.enum(['pending', 'received']).optional(),
  ownershipRemarks: z
    .string()
    .max(200, '归属备注不能超过200个字符')
    .optional()
    .or(z.literal('')),
  // 手动输入产品信息（临时产品）—— 与后端Schema保持一致，避免被误判为库存产品
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
  manualWeight: z
    .preprocess(coerceNumber, z.number().min(0, '重量不能为负数'))
    .optional(),
  manualUnit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .or(z.literal('')),
  displayName: z
    .string()
    .max(200, '产品名称不能超过200个字符')
    .optional()
    .or(z.literal('')),
  specification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal('')),
  // 与 factoryShipmentOrderItemSchema 保持一致：单位来自产品数据，允许任意字符串
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),
  piecesPerUnit: z.number().positive('每件片数必须大于0').optional(),
  weight: z.number().positive('重量必须大于0').optional(),
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
});

// 表单专用的费用项Schema - 移除.default()
const factoryShipmentFeeItemFormSchema = z.object({
  id: z.string().optional(),
  feeType: z.enum([
    'freight',
    'processing',
    'packaging',
    'loading_unloading',
    'storage',
    'customs',
    'other',
  ]),
  feeName: z
    .string()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符'),
  feeAmount: z.preprocess(
    coerceNumber,
    z
      .number()
      .nonnegative('费用金额不能为负数')
      .finite('费用金额必须是有效数字')
      .max(999999.99, '费用金额不能超过999,999.99')
  ),
  paidBy: z.enum(['customer', 'company']), // 移除.default()
  // 费用对应的结算供应商（如物流公司），可选
  supplierId: z.string().uuid('费用供应商ID格式不正确').optional().nullable(),
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
});

export const factoryShipmentOrderFormSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .optional()
      .describe('幂等性键,防止重复操作'),
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional()
      .or(z.literal('')),
    customerId: z.string().min(1, '请选择客户'),
    status: factoryShipmentStatusSchema.optional(),
    totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
    receivableAmount: z.number().min(0, '应收金额不能为负数').optional(),
    depositAmount: z.number().min(0, '定金金额不能为负数').optional(),
    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),
    items: z
      .array(factoryShipmentOrderItemFormSchema)
      .min(1, '至少需要添加一个产品'),
    feeItems: z.array(factoryShipmentFeeItemFormSchema).optional(), // 移除.default()
  })
  .refine(
    data => {
      // 定金不能超过应收金额
      if (
        data.depositAmount &&
        data.receivableAmount &&
        data.depositAmount > data.receivableAmount
      ) {
        return false;
      }
      return true;
    },
    {
      message: '定金金额不能超过应收金额',
      path: ['depositAmount'],
    }
  )
  .superRefine((data, ctx) => {
    // 验证订单明细的所有业务规则
    validateFactoryShipmentItems(data.items, data.status, ctx);

    // 验证状态相关的必填字段
    validateStatusFieldRequirements(
      data.status,
      { containerNumber: data.containerNumber },
      ctx
    );
  });

// 重新导出基础schema和类型
export * from './schemas';

// 导出验证函数（供测试使用）
export {
  validateFactoryShipmentItems,
  validateManualProductFields,
  validateRequiredFieldsByStatus,
  validateStatusFieldRequirements,
} from './validators';

// 导出类型
export type CreateFactoryShipmentOrderData = z.infer<
  typeof createFactoryShipmentOrderSchema
>;
export type UpdateFactoryShipmentOrderData = z.infer<
  typeof updateFactoryShipmentOrderSchema
>;
// 表单层使用 Zod 输入类型，以避免 .default()/.optional() 带来的 Resolver 类型差异
export type FactoryShipmentOrderFormData = z.input<
  typeof factoryShipmentOrderFormSchema
>;

// 兼容性导出（用于现有代码）
export {
  factoryShipmentOrderListParamsSchema,
  updateFactoryShipmentOrderStatusSchema,
};
export type FactoryShipmentOrderListParams = z.infer<
  typeof factoryShipmentOrderListParamsSchema
>;
export type UpdateFactoryShipmentOrderStatusData = z.infer<
  typeof updateFactoryShipmentOrderStatusSchema
>;
export type FactoryShipmentOrderItemData = z.infer<
  typeof factoryShipmentOrderItemSchema
>;
