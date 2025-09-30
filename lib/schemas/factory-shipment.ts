// 厂家发货相关验证规则
// 使用 Zod 进行数据验证和类型推断

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

// 厂家发货订单状态验证
export const factoryShipmentStatusSchema = z.enum([
  FACTORY_SHIPMENT_STATUS.DRAFT,
  FACTORY_SHIPMENT_STATUS.PLANNING,
  FACTORY_SHIPMENT_STATUS.WAITING_DEPOSIT,
  FACTORY_SHIPMENT_STATUS.DEPOSIT_PAID,
  FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED,
  FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  FACTORY_SHIPMENT_STATUS.ARRIVED,
  FACTORY_SHIPMENT_STATUS.DELIVERED,
  FACTORY_SHIPMENT_STATUS.COMPLETED,
]);

// 厂家发货订单明细项验证
export const factoryShipmentOrderItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    supplierId: z.string().uuid('供应商ID格式不正确'),
    quantity: z.number().positive('数量必须大于0'),
    unitPrice: z.number().min(0, '单价不能为负数'),

    // 手动输入商品信息（临时商品）
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
    manualWeight: z.number().min(0, '重量不能为负数').optional(),
    manualUnit: z
      .string()
      .max(20, '单位不能超过20个字符')
      .optional()
      .or(z.literal('')),

    // 通用显示字段
    displayName: z
      .string()
      .min(1, '商品名称不能为空')
      .max(100, '商品名称不能超过100个字符'),
    specification: z
      .string()
      .max(200, '规格不能超过200个字符')
      .optional()
      .or(z.literal('')),
    unit: z.string().min(1, '单位不能为空').max(20, '单位不能超过20个字符'),
    weight: z.number().min(0, '重量不能为负数').optional(),

    remarks: z
      .string()
      .max(500, '备注不能超过500个字符')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    data => {
      // 如果是手动输入商品，必须填写商品名称
      if (data.isManualProduct && !data.manualProductName) {
        return false;
      }
      // 如果不是手动输入商品，必须有productId
      if (!data.isManualProduct && !data.productId) {
        return false;
      }
      return true;
    },
    {
      message: '手动输入商品必须填写商品名称，库存商品必须选择商品',
      path: ['manualProductName'],
    }
  );

// 创建厂家发货订单验证（创建时集装箱号码为可选）
export const createFactoryShipmentOrderSchema = z
  .object({
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional()
      .or(z.literal('')),
    customerId: z.string().uuid('客户ID格式不正确'),
    status: factoryShipmentStatusSchema.optional(),
    totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
    receivableAmount: z.number().min(0, '应收金额不能为负数').optional(),
    depositAmount: z.number().min(0, '定金金额不能为负数').optional(),
    remarks: z
      .string()
      .max(1000, '备注不能超过1000个字符')
      .optional()
      .or(z.literal('')),
    planDate: z.date().optional(),
    items: z
      .array(factoryShipmentOrderItemSchema)
      .min(1, '至少需要添加一个商品'),
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
  );

// 更新厂家发货订单验证
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
    planDate: z.date().optional(),
    shipmentDate: z.date().optional(),
    arrivalDate: z.date().optional(),
    deliveryDate: z.date().optional(),
    completionDate: z.date().optional(),
    items: z
      .array(factoryShipmentOrderItemSchema)
      .min(1, '至少需要添加一个商品')
      .optional(),
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
  );

// 厂家发货订单列表查询参数验证
export const factoryShipmentOrderListParamsSchema = z
  .object({
    page: z.number().int().min(1, '页码必须大于0').optional(),
    pageSize: z
      .number()
      .int()
      .min(1, '每页数量必须大于0')
      .max(
        paginationConfig.maxPageSize,
        `每页数量不能超过${paginationConfig.maxPageSize}`
      )
      .optional(),
    status: factoryShipmentStatusSchema.optional(),
    customerId: z.string().uuid('客户ID格式不正确').optional(),
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

// 厂家发货订单状态更新验证
export const updateFactoryShipmentOrderStatusSchema = z
  .object({
    status: factoryShipmentStatusSchema,
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional()
      .or(z.literal('')),
    remarks: z
      .string()
      .max(500, '备注不能超过500个字符')
      .optional()
      .or(z.literal('')),
    // 根据状态更新相应的日期字段
    planDate: z.date().optional(),
    shipmentDate: z.date().optional(),
    arrivalDate: z.date().optional(),
    deliveryDate: z.date().optional(),
    completionDate: z.date().optional(),
  })
  .refine(
    data => {
      // 如果状态为已发货或之后的状态，集装箱号码必填
      const shippedStatuses = [
        FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED,
        FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
        FACTORY_SHIPMENT_STATUS.ARRIVED,
        FACTORY_SHIPMENT_STATUS.DELIVERED,
        FACTORY_SHIPMENT_STATUS.COMPLETED,
      ];
      if (
        shippedStatuses.includes(data.status) &&
        (!data.containerNumber || data.containerNumber.trim() === '')
      ) {
        return false;
      }
      return true;
    },
    {
      message: '确认发货时必须填写集装箱号码',
      path: ['containerNumber'],
    }
  );

// 类型推断
export type CreateFactoryShipmentOrderData = z.infer<
  typeof createFactoryShipmentOrderSchema
>;
export type UpdateFactoryShipmentOrderData = z.infer<
  typeof updateFactoryShipmentOrderSchema
>;
export type FactoryShipmentOrderListParams = z.infer<
  typeof factoryShipmentOrderListParamsSchema
>;
export type UpdateFactoryShipmentOrderStatusData = z.infer<
  typeof updateFactoryShipmentOrderStatusSchema
>;
export type FactoryShipmentOrderItemData = z.infer<
  typeof factoryShipmentOrderItemSchema
>;
