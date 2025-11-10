// 采购订单相关验证规则
// 使用 Zod 进行数据验证和类型推断

import { z } from 'zod';

import { PRODUCT_UNIT_VALUES } from '@/lib/config/product';
import { paginationConfig } from '@/lib/env';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

// 采购订单费用项验证（复用厂家发货的费用项验证）
export const purchaseOrderFeeItemSchema = z.object({
  feeType: z.enum(['shipping', 'storage', 'customs', 'other']),
  feeName: z
    .string()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符'),
  feeAmount: z.number().min(0, '费用金额不能为负数'),
  remarks: z
    .string()
    .max(500, '备注不能超过500个字符')
    .optional()
    .or(z.literal('')),
});

// 采购订单状态验证
export const purchaseOrderStatusSchema = z.enum([
  PURCHASE_ORDER_STATUS.DRAFT,
  PURCHASE_ORDER_STATUS.ORDERED,
  PURCHASE_ORDER_STATUS.SHIPPED,
  PURCHASE_ORDER_STATUS.IN_TRANSIT,
  PURCHASE_ORDER_STATUS.ARRIVED,
  PURCHASE_ORDER_STATUS.COMPLETED,
  PURCHASE_ORDER_STATUS.CANCELLED,
]);

// 采购订单明细项验证
export const purchaseOrderItemSchema = z
  .object({
    productId: z
      .union([z.string().uuid('产品ID格式不正确'), z.literal('')])
      .optional()
      .transform(value =>
        value && value.trim().length > 0 ? value : undefined
      ),
    supplierId: z
      .string()
      .trim()
      .min(1, '请选择供应商')
      .uuid('供应商ID格式不正确'),
    productCode: z
      .string()
      .trim()
      .min(1, '产品编码不能为空')
      .max(50, '产品编码不能超过50个字符'),
    quantity: z.number().positive('数量必须大于0'),
    unitPrice: z.number().min(0, '单价不能为负数'),
    totalPrice: z.number().min(0, '总价不能为负数').default(0),
    inboundStatus: z.enum(['pending', 'received']).optional(),

    // 批次管理
    batchNumber: z
      .string()
      .max(100, '批次号不能超过100个字符')
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
    displayName: z.string().max(100, '产品名称不能超过100个字符').default(''),
    specification: z
      .string()
      .max(200, '规格不能超过200个字符')
      .optional()
      .or(z.literal('')),
    unit: z.enum(PRODUCT_UNIT_VALUES as [string, ...string[]], {
      message: '请选择有效的计量单位',
    }),
    weight: z.number().min(0, '重量不能为负数').optional(),
    piecesPerUnit: z
      .number()
      .int('每件片数必须为整数')
      .min(1, '每件片数必须大于0')
      .max(10000, '每件片数不能超过10000')
      .optional(),

    remarks: z
      .string()
      .max(500, '备注不能超过500个字符')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    data => {
      // 如果是手动输入产品，必须填写产品名称
      if (data.isManualProduct && !data.manualProductName) {
        return false;
      }
      // 如果不是手动输入产品，必须有productId
      if (!data.isManualProduct && !data.productId) {
        return false;
      }
      return true;
    },
    {
      message: '手动输入产品必须填写产品名称，库存产品必须选择产品',
      path: ['manualProductName'],
    }
  );

// 创建采购订单验证
export const createPurchaseOrderSchema = z.object({
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
  supplierId: z
    .string()
    .uuid('供应商ID格式不正确')
    .optional()
    .or(z.literal(''))
    .describe('订单级别供应商ID(可选,支持多供应商采购)'),
  orderDate: z.date().optional().describe('订单日期'),
  status: purchaseOrderStatusSchema.optional(),
  totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .or(z.literal('')),
  items: z.array(purchaseOrderItemSchema).min(1, '至少需要添加一个产品'),
  feeItems: z.array(purchaseOrderFeeItemSchema).optional().default([]),
});

// 更新采购订单验证
export const updatePurchaseOrderSchema = z.object({
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
  supplierId: z.string().uuid('供应商ID格式不正确').optional(),
  status: purchaseOrderStatusSchema.optional(),
  totalAmount: z.number().min(0, '订单总金额不能为负数').optional(),
  expenseAmount: z.number().min(0, '费用金额不能为负数').optional(),
  costAmount: z.number().min(0, '成本金额不能为负数').optional(),
  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .or(z.literal('')),
  orderDate: z.date().optional(),
  shipmentDate: z.date().optional(),
  arrivalDate: z.date().optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, '至少需要添加一个产品')
    .optional(),
});

// 采购订单列表查询参数验证
export const purchaseOrderListParamsSchema = z
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
    status: purchaseOrderStatusSchema.optional(),
    supplierId: z.string().uuid('供应商ID格式不正确').optional(),
    containerNumber: z
      .string()
      .max(50, '集装箱号码不能超过50个字符')
      .optional(),
    orderNumber: z.string().max(50, '订单编号不能超过50个字符').optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    fulfillment: z.enum(['none', 'partial', 'complete']).optional(),
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

// 采购订单状态更新验证
export const updatePurchaseOrderStatusSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .describe('幂等性键,防止重复操作'),
    status: purchaseOrderStatusSchema,
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
    orderDate: z.string().datetime().optional().or(z.literal('')),
    shipmentDate: z.string().datetime().optional().or(z.literal('')),
    arrivalDate: z.string().datetime().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 如果状态为已发货或之后的状态，集装箱号码必填
      const shippedStatuses = [
        PURCHASE_ORDER_STATUS.SHIPPED,
        PURCHASE_ORDER_STATUS.IN_TRANSIT,
        PURCHASE_ORDER_STATUS.ARRIVED,
        PURCHASE_ORDER_STATUS.COMPLETED,
      ] as const;
      if (
        (shippedStatuses as readonly string[]).includes(data.status) &&
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
  )
  .refine(
    data => {
      const requireShippingCompanyStatuses: PurchaseOrderStatus[] = [
        PURCHASE_ORDER_STATUS.IN_TRANSIT,
        PURCHASE_ORDER_STATUS.ARRIVED,
        PURCHASE_ORDER_STATUS.COMPLETED,
      ];
      if (
        requireShippingCompanyStatuses.includes(data.status) &&
        (!data.shippingCompany || data.shippingCompany.trim() === '')
      ) {
        return false;
      }
      return true;
    },
    {
      message: '运输中及之后的状态必须填写船运公司信息(用于自动查询运输状态)',
      path: ['shippingCompany'],
    }
  );

// 类型推断
export type CreatePurchaseOrderData = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderData = z.infer<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderListParams = z.infer<
  typeof purchaseOrderListParamsSchema
>;
export type UpdatePurchaseOrderStatusData = z.infer<
  typeof updatePurchaseOrderStatusSchema
>;
export type PurchaseOrderItemData = z.infer<typeof purchaseOrderItemSchema>;
