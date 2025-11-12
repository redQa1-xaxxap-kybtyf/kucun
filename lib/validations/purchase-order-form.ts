import { z } from 'zod';

import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import {
  updatePurchaseOrderStatusSchema as baseUpdatePurchaseOrderStatusSchema,
  type UpdatePurchaseOrderStatusData,
} from '@/lib/validations/purchase-order';

const PURCHASE_ORDER_STATUS_VALUES = Object.values(
  PURCHASE_ORDER_STATUS
) as PurchaseOrderStatus[];

export const purchaseOrderStatusEnum = z.enum(
  PURCHASE_ORDER_STATUS_VALUES as [
    PurchaseOrderStatus,
    ...PurchaseOrderStatus[],
  ]
);

export const purchaseOrderItemSchema = z
  .object({
    productId: z.string().optional(),
    supplierId: z.string().min(1, '供应商 ID 不能为空'),
    productCode: z.string().min(1, '产品编码不能为空'),
    batchNumber: z
      .string()
      .max(100, '批次号不能超过100个字符')
      .optional()
      .or(z.literal('')),
    isManualProduct: z.boolean().optional(),
    manualProductName: z.string().optional(),
    manualSpecification: z.string().optional(),
    manualWeight: z.number().nonnegative('重量不能为负数').optional(),
    manualUnit: z.string().optional(),
    displayName: z.string().min(1, '产品名称不能为空'),
    specification: z.string().optional(),
    unit: z.string().optional(),
    weight: z.number().nonnegative('重量不能为负数').optional(),
    piecesPerUnit: z
      .number()
      .int('每件片数必须为整数')
      .min(1, '每件片数必须大于 0')
      .max(10000, '每件片数不能超过 10000')
      .optional(),
    quantity: z.number().positive('数量必须大于 0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
    totalPrice: z.number().nonnegative('总价不能为负'),
    remarks: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    const trimmedManualName = item.manualProductName?.trim();
    const hasProduct = Boolean(item.productId && item.productId.trim());
    const isManual = Boolean(item.isManualProduct);

    if (!isManual && !hasProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择产品或启用手动产品',
      });
    }

    if (isManual && !trimmedManualName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '手动产品必须填写名称',
        path: ['manualProductName'],
      });
    }
  });

// ✅ 采购订单费用项Schema - 与厂家发货费用类型一致
export const purchaseOrderFeeItemSchema = z.object({
  feeType: z.enum([
    'freight', // 运费 (与厂家发货一致)
    'processing', // 加工费
    'packaging', // 包装费
    'loading_unloading', // 装卸费
    'storage', // 仓储费
    'customs', // 报关费
    'other', // 其他费用
  ]),
  feeName: z.string().min(1, '费用名称不能为空'),
  feeAmount: z.number().nonnegative('费用金额不能为负'),
  remarks: z.string().optional(),
});

// ✅ 统一的表单Schema - 包含idempotencyKey字段
// 注意: 不使用.default(),让表单组件处理默认值,避免类型推断问题
const baseFormSchema = z.object({
  idempotencyKey: z.string().optional(), // 创建时可选,编辑时必填
  containerNumber: z.string().optional().or(z.literal('')),
  status: purchaseOrderStatusEnum, // 移除.default(),在表单中设置默认值
  orderDate: z.string().optional().or(z.literal('')),
  shipmentDate: z.string().optional().or(z.literal('')),
  items: z.array(purchaseOrderItemSchema).min(1, '至少需要一个产品项'),
  remarks: z.string().optional().or(z.literal('')),
  feeItems: z.array(purchaseOrderFeeItemSchema).optional(), // 移除.default()
});

// 创建采购订单Schema
export const createPurchaseOrderSchema = baseFormSchema;

// 更新采购订单Schema - idempotencyKey必填
export const updatePurchaseOrderSchema = baseFormSchema.extend({
  idempotencyKey: z.string().min(1, '幂等性键不能为空'),
});

export const updatePurchaseOrderStatusSchema =
  baseUpdatePurchaseOrderStatusSchema.safeExtend({
    orderId: z.string().min(1, '订单 ID 不能为空'),
  });

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema> & {
  batchNumber?: string | null;
  piecesPerUnit?: number;
};

// ✅ 统一的表单类型 - 从baseFormSchema推断
export type PurchaseOrderFormData = z.infer<typeof baseFormSchema>;
export type UpdatePurchaseOrderFormData = z.infer<
  typeof updatePurchaseOrderSchema
>;
export type UpdatePurchaseOrderStatusFormData =
  UpdatePurchaseOrderStatusData & {
    orderId: string;
  };
