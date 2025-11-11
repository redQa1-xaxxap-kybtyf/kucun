/**
 * 厂家发货订单验证规则 - 统一导出
 * 职责：组合各个验证规则模块，提供完整的订单验证Schema
 */

import { z } from 'zod';

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

// 重新导出基础schema和类型
export * from './schemas';

// 导出验证函数（供测试使用）
export {
  validateFactoryShipmentItems,
  validateManualProductFields,
  validateOwnershipFields,
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

// 兼容性导出（用于现有代码）
export { factoryShipmentOrderListParamsSchema };
export { updateFactoryShipmentOrderStatusSchema };
export type FactoryShipmentOrderListParams = z.infer<
  typeof factoryShipmentOrderListParamsSchema
>;
export type UpdateFactoryShipmentOrderStatusData = z.infer<
  typeof updateFactoryShipmentOrderStatusSchema
>;
export type FactoryShipmentOrderItemData = z.infer<
  typeof factoryShipmentOrderItemSchema
>;
