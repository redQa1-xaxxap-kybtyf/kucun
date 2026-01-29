/**
 * 厂家发货订单基础Schema定义
 * 职责：定义基础的验证规则、枚举和常量
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
} from '@/lib/types/factory-shipment';

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
 * 厂家发货订单状态枚举
 */
export const factoryShipmentStatusSchema = z.enum([
  FACTORY_SHIPMENT_STATUS.DRAFT,
  FACTORY_SHIPMENT_STATUS.CONFIRMED,
  FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
  FACTORY_SHIPMENT_STATUS.SHIPPED,
  FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  FACTORY_SHIPMENT_STATUS.ARRIVED,
  FACTORY_SHIPMENT_STATUS.CANCELLED,
]);

/**
 * 厂家发货订单费用项验证
 * 支持 paidBy 字段区分客户/公司承担费用
 * 支持 supplierId 指定费用供应商（如物流公司）
 */
export const factoryShipmentFeeItemSchema = z.object({
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
  feeAmount: z
    .number()
    .nonnegative('费用金额不能为负数')
    .finite('费用金额必须是有效数字')
    .max(999999.99, '费用金额不能超过999,999.99')
    .multipleOf(0.01, '费用金额最多保留2位小数'),
  paidBy: z.enum(['customer', 'company']).default('customer'),
  // 费用对应的结算供应商（如物流公司），可选
  supplierId: z.string().uuid('费用供应商ID格式不正确').optional().nullable(),
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 厂家发货订单明细项基础验证
 * 只包含字段类型和长度限制，不包含复杂的业务逻辑
 */
export const factoryShipmentOrderItemSchema = z.object({
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
  quantity: z.number().positive('数量必须大于0'),
  unitPrice: z.number().min(0, '单价不能为负数'),
  unitCost: z.number().min(0, '进货价不能为负数').optional(),
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

  // 手动输入产品信息（临时产品）
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
  manualWeight: z.number().min(0, '重量不能为负数').optional(),
  manualUnit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .or(z.literal('')),

  // 通用显示字段
  displayName: z
    .string()
    .max(100, '产品名称不能超过100个字符')
    .optional()
    .or(z.literal('')),
  specification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal('')),
  // 保留原有的unit字段用于兼容性（从产品数据获取，允许任意字符串）
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),
  piecesPerUnit: z
    .number()
    .int('装箱数必须为整数')
    .min(1, '装箱数必须大于0')
    .max(100000, '装箱数不能超过100000')
    .optional(),
  weight: z.number().min(0, '重量不能为负数').optional(),

  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 厂家发货订单列表查询参数验证
 */
export const factoryShipmentOrderListParamsSchema = z
  .object({
    page: z.number().int().min(1, '页码必须大于0').optional(),
    limit: z
      .number()
      .int()
      .min(1, '每页数量必须大于0')
      .max(
        paginationConfig.maxPageSize,
        `每页数量不能超过${paginationConfig.maxPageSize}`
      )
      .optional(),
    mode: z.enum(['customer_direct', 'factory']).optional(),
    status: factoryShipmentStatusSchema.optional(),
    customerId: z.string().uuid('客户ID格式不正确').optional(),
    search: z.string().max(50, '搜索关键字不能超过50个字符').optional(), // ✅ 新增：通用搜索字段
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional(),
    orderNumber: z.string().max(50, '订单编号不能超过50个字符').optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  })
  .refine(
    data => {
      // 结束日期不能早于开始日期
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        return false;
      }
      return true;
    },
    {
      message: '结束日期不能早于开始日期',
      path: ['endDate'],
    }
  );

/**
 * 厂家发货订单状态更新验证
 */
export const updateFactoryShipmentOrderStatusSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid('幂等性键格式不正确')
    .describe('幂等性键,防止重复操作'),
  status: factoryShipmentStatusSchema,
  containerNumber: z
    .string()
    .max(50, '集装箱号码不能超过50个字符')
    .optional()
    .or(z.literal('')),
  shippingCompany: z
    .string()
    .max(100, '船运公司名称不能超过100个字符')
    .optional()
    .or(z.literal('')),
  estimatedArrival: z.string().datetime().optional().or(z.literal('')),
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
  // 根据状态更新相应的日期字段
  shipmentDate: z.string().datetime().optional().or(z.literal('')),
  arrivalDate: z.string().datetime().optional().or(z.literal('')),
  deliveryDate: z.string().datetime().optional().or(z.literal('')),
  completionDate: z.string().datetime().optional().or(z.literal('')),
});

// 导出类型
export type FactoryShipmentOrderItemFormData = z.infer<
  typeof factoryShipmentOrderItemSchema
>;
export type FactoryShipmentFeeItemFormData = z.infer<
  typeof factoryShipmentFeeItemSchema
>;
export type FactoryShipmentStatusType = z.infer<
  typeof factoryShipmentStatusSchema
>;
export type FactoryShipmentOrderListParams = z.infer<
  typeof factoryShipmentOrderListParamsSchema
>;
export type UpdateFactoryShipmentOrderStatusData = z.infer<
  typeof updateFactoryShipmentOrderStatusSchema
>;
