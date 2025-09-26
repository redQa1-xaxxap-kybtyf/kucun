// 退货管理表单验证规则
// 使用 Zod 进行严格的类型验证和业务规则检查

import { z } from 'zod';

import { returnRefundConfig } from '@/lib/env';

import type {
  ReturnOrderStatus,
  ReturnOrderType,
} from '@/lib/types/return-order';

// 退货订单明细验证规则
export const returnOrderItemSchema = z
  .object({
    id: z.string().optional(),
    salesOrderItemId: z.string().min(1, '请选择销售订单明细'),
    productId: z.string().min(1, '产品ID不能为空'),
    colorCode: z.string().optional(),
    productionDate: z.string().optional(),
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
    condition: z.enum(['good', 'damaged', 'defective'], {
      errorMap: () => ({ message: '请选择商品状态' }),
    }),
  })
  .refine(
    data =>
      // 退货数量不能超过原始数量
      data.returnQuantity <= data.originalQuantity,
    {
      message: '退货数量不能超过原始数量',
      path: ['returnQuantity'],
    }
  )
  .refine(
    data => {
      // 小计应该等于数量乘以单价
      const expectedSubtotal = data.returnQuantity * data.unitPrice;
      return Math.abs(data.subtotal - expectedSubtotal) < 0.01;
    },
    {
      message: '小计计算错误',
      path: ['subtotal'],
    }
  );

// 退货订单创建验证规则
export const createReturnOrderSchema = z
  .object({
    salesOrderId: z.string().min(1, '请选择关联的销售订单'),
    customerId: z.string().min(1, '客户ID不能为空'),
    type: z.enum(
      [
        'quality_issue',
        'wrong_product',
        'customer_change',
        'damage_in_transit',
        'other',
      ] as const,
      {
        errorMap: () => ({ message: '请选择退货类型' }),
      }
    ),
    processType: z.enum(['refund', 'exchange', 'repair', 'credit'] as const, {
      errorMap: () => ({ message: '请选择处理方式' }),
    }),
    reason: z
      .string()
      .min(1, '退货原因不能为空')
      .max(500, '退货原因不能超过500字符'),
    remarks: z.string().max(1000, '备注不能超过1000字符').optional(),
    items: z
      .array(returnOrderItemSchema)
      .min(1, '至少需要一个退货明细')
      .max(
        returnRefundConfig.returnOrderItemsLimit,
        `退货明细不能超过${returnRefundConfig.returnOrderItemsLimit}项`
      ),
  })
  .refine(
    data => {
      // 检查明细项目的唯一性（同一个销售订单明细项不能重复退货）
      const itemIds = data.items.map(item => item.salesOrderItemId);
      const uniqueItemIds = new Set(itemIds);
      return itemIds.length === uniqueItemIds.size;
    },
    {
      message: '不能对同一个销售明细项重复申请退货',
      path: ['items'],
    }
  );

// 退货订单更新验证规则
export const updateReturnOrderSchema = z.object({
  id: z.string().min(1, '退货订单ID不能为空'),
  salesOrderId: z.string().optional(),
  customerId: z.string().optional(),
  type: z
    .enum([
      'quality_issue',
      'wrong_product',
      'customer_change',
      'damage_in_transit',
      'other',
    ])
    .optional(),
  processType: z.enum(['refund', 'exchange', 'repair']).optional(),
  reason: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(returnOrderItemSchema).optional(),
});

// 退货状态更新验证规则
export const updateReturnStatusSchema = z.object({
  status: z.enum(
    [
      'draft',
      'submitted',
      'approved',
      'rejected',
      'processing',
      'completed',
      'cancelled',
    ] as const,
    {
      errorMap: () => ({ message: '无效的状态值' }),
    }
  ),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
  refundAmount: z
    .number()
    .min(0, '退款金额不能为负数')
    .max(999999, '退款金额不能超过999999')
    .optional(),
  processedAt: z.string().optional(),
});

// 退货搜索表单验证规则
export const returnOrderSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100字符').optional(),
    status: z
      .enum([
        '',
        'draft',
        'submitted',
        'approved',
        'rejected',
        'processing',
        'completed',
        'cancelled',
      ] as const)
      .optional(),
    type: z
      .enum([
        '',
        'quality_issue',
        'wrong_product',
        'customer_change',
        'damage_in_transit',
        'other',
      ] as const)
      .optional(),
    processType: z
      .enum(['', 'refund', 'exchange', 'repair', 'credit'] as const)
      .optional(),
    customerId: z.string().optional(),
    salesOrderId: z.string().optional(),
    userId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z
      .enum([
        'createdAt',
        'returnNumber',
        'totalAmount',
        'status',
        'submittedAt',
        'completedAt',
      ])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 如果设置了开始日期和结束日期，确保开始日期不晚于结束日期
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 退货审核表单验证规则
export const returnOrderApprovalSchema = z
  .object({
    approved: z.boolean(),
    remarks: z.string().max(500, '审核备注不能超过500字符').optional(),
    refundAmount: z
      .number()
      .min(0, '退款金额不能为负数')
      .max(999999, '退款金额不能超过999999')
      .optional(),
  })
  .refine(
    data => {
      // 如果审核通过，必须设置退款金额
      if (
        data.approved &&
        (data.refundAmount === undefined || data.refundAmount === null)
      ) {
        return false;
      }
      return true;
    },
    {
      message: '审核通过时必须设置退款金额',
      path: ['refundAmount'],
    }
  );

// 批量操作验证规则
export const batchReturnOrderSchema = z.object({
  ids: z
    .array(z.string().min(1, '退货订单ID不能为空'))
    .min(1, '请选择至少一个退货订单')
    .max(50, '批量操作不能超过50个订单'),
  action: z.enum(['approve', 'reject', 'cancel', 'export'], {
    errorMap: () => ({ message: '无效的操作类型' }),
  }),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
});

// 类型推断
export type ReturnOrderItemFormData = z.infer<typeof returnOrderItemSchema>;
export type CreateReturnOrderFormData = z.infer<typeof createReturnOrderSchema>;
export type UpdateReturnOrderFormData = z.infer<typeof updateReturnOrderSchema>;
export type UpdateReturnStatusFormData = z.infer<
  typeof updateReturnStatusSchema
>;
export type ReturnOrderSearchFormData = z.infer<typeof returnOrderSearchSchema>;
export type ReturnOrderApprovalFormData = z.infer<
  typeof returnOrderApprovalSchema
>;
export type BatchReturnOrderFormData = z.infer<typeof batchReturnOrderSchema>;

// 表单默认值
export const returnOrderItemDefaults: Partial<ReturnOrderItemFormData> = {
  returnQuantity: 1,
  condition: 'good',
};

export const createReturnOrderDefaults: Partial<CreateReturnOrderFormData> = {
  type: 'quality_issue',
  processType: 'refund',
  items: [],
};

export const returnOrderSearchDefaults: ReturnOrderSearchFormData = {
  search: '',
  status: '',
  type: '',
  processType: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const returnOrderApprovalDefaults: Partial<ReturnOrderApprovalFormData> =
  {
    approved: true,
  };

// 辅助验证函数

/**
 * 验证退货数量是否合理
 */
export function validateReturnQuantity(
  returnQuantity: number,
  originalQuantity: number,
  alreadyReturnedQuantity: number = 0
): boolean {
  return (
    returnQuantity > 0 &&
    returnQuantity <= originalQuantity - alreadyReturnedQuantity
  );
}

/**
 * 验证退款金额是否合理
 */
export function validateRefundAmount(
  refundAmount: number,
  totalAmount: number
): boolean {
  return refundAmount >= 0 && refundAmount <= totalAmount;
}

/**
 * 验证退货状态流转
 */
export function validateStatusTransition(
  fromStatus: ReturnOrderStatus,
  toStatus: ReturnOrderStatus
): boolean {
  const validTransitions: Record<ReturnOrderStatus, ReturnOrderStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected', 'cancelled'],
    approved: ['processing', 'cancelled'],
    rejected: ['cancelled'],
    processing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  return validTransitions[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * 计算退货明细小计
 */
export function calculateReturnItemSubtotal(
  quantity: number,
  unitPrice: number
): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * 计算退货订单总金额
 */
export function calculateReturnOrderTotal(
  items: ReturnOrderItemFormData[]
): number {
  return items.reduce((total, item) => total + item.subtotal, 0);
}

/**
 * 生成退货单号
 */
export function generateReturnNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);

  return `${returnRefundConfig.returnOrderPrefix}${year}${month}${day}${timestamp}`;
}

/**
 * 验证退货原因
 */
export function validateReturnReason(
  reason: string,
  type: ReturnOrderType
): boolean {
  if (!reason || reason.trim().length === 0) {
    return false;
  }

  // 根据退货类型验证原因的合理性
  const minLength = type === 'other' ? 10 : 5;
  return reason.trim().length >= minLength;
}
