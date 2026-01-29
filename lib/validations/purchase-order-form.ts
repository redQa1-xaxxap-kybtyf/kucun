import { z } from 'zod';

import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { updatePurchaseOrderStatusSchema as baseUpdatePurchaseOrderStatusSchema } from '@/lib/validations/purchase-order';

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
      .int('装箱数必须为整数')
      .min(1, '装箱数必须大于 0')
      .max(10000, '装箱数不能超过 10000')
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
  // 费用对应的结算供应商（如物流公司），可选；不填时后端可回落到订单主供应商
  supplierId: z.string().uuid('费用供应商ID格式不正确').optional(),
  remarks: z.string().optional(),
});

// ✅ 统一的表单Schema - 包含idempotencyKey字段
// 注意: 不使用.default(),让表单组件处理默认值,避免类型推断问题
const baseFormSchema = z.object({
  idempotencyKey: z.string().optional(), // 创建时可选,编辑时必填
  containerNumber: z.string().optional().or(z.literal('')),
  // 船运公司(可选) - 用于仓库进货场景记录船公司信息
  shippingCompany: z
    .string()
    .max(100, '船运公司名称不能超过100个字符')
    .optional()
    .or(z.literal('')),
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

// ✅ 采购订单状态更新（表单专用 Schema）
// 说明：
// - API 路由使用 lib/validations/purchase-order.ts 里的 Schema（包含幂等性 idempotencyKey）
// - Server Action 这边只做简单状态流转，不走幂等性组件，因此不强制要求 idempotencyKey
// - 复用原有的字段/校验规则（集装箱号、船运公司必填条件等），只额外加上 orderId
const baseStatusFormSchema = baseUpdatePurchaseOrderStatusSchema.omit({
  idempotencyKey: true,
});

export const updatePurchaseOrderStatusSchema = baseStatusFormSchema.extend({
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
export type UpdatePurchaseOrderStatusFormData = z.infer<
  typeof updatePurchaseOrderStatusSchema
>;
