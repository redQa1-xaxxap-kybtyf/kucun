import { z } from 'zod';

import type { SalesOrderStatus } from '@/lib/types/sales-order';

export const ALLOWED_RETURN_SALES_ORDER_STATUSES: ReadonlyArray<SalesOrderStatus> = [
  'shipped',
  'completed',
];

export const returnOrderItemSchema = z.object({
  salesOrderItemId: z.string().min(1, '请选择销售订单明细'),
  productId: z.string().min(1, '产品ID不能为空'),
  returnQuantity: z
    .number()
    .min(0.01, '退货数量必须大于0')
    .max(999999, '退货数量不能超过999999'),
  originalQuantity: z.number().min(0, '原始数量不能为负数'),
  unitPrice: z
    .number()
    .min(0, '单价不能为负数')
    .max(999999, '单价不能超过999999'),
  subtotal: z.number().min(0, '小计不能为负数'),
  reason: z.string().optional(),
  condition: z.enum(['good', 'damaged', 'defective']),
});

export const createReturnOrderSchema = z.object({
  salesOrderId: z.string().min(1, '请选择关联的销售订单'),
  customerId: z.string().min(1, '客户ID不能为空'),
  type: z.enum([
    'quality_issue',
    'wrong_product',
    'customer_change',
    'damage_in_transit',
    'other',
  ]),
  processType: z.enum(['refund', 'exchange']),
  reason: z
    .string()
    .min(1, '退货原因不能为空')
    .max(500, '退货原因不能超过500字符'),
  remarks: z.string().max(1000, '备注不能超过1000字符').optional(),
  items: z
    .array(returnOrderItemSchema)
    .min(1, '至少需要一个退货明细')
    .max(100, '退货明细不能超过100项'),
});

export const updateReturnOrderStatusSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单ID不能为空'),
  status: z.enum([
    'draft',
    'submitted',
    'approved',
    'rejected',
    'processing',
    'completed',
    'cancelled',
  ]),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
  refundAmount: z
    .number()
    .min(0, '退款金额不能为负数')
    .max(999999, '退款金额不能超过999999')
    .optional(),
});

export const approveReturnOrderSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单ID不能为空'),
  approved: z.boolean(),
  refundAmount: z.number().min(0, '退款金额不能为负数').optional(),
  remarks: z.string().max(500, '审核备注不能超过500字符').optional(),
});

export type CreateReturnOrderData = z.infer<typeof createReturnOrderSchema>;
export type UpdateReturnOrderStatusData = z.infer<typeof updateReturnOrderStatusSchema>;
export type ApproveReturnOrderData = z.infer<typeof approveReturnOrderSchema>;

