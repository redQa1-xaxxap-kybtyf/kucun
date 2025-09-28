// 退款管理验证规则
// 使用Zod定义退款记录的创建、更新和查询验证规则

import { z } from 'zod';

import { paginationConfig, returnRefundConfig } from '@/lib/env';

// 退款方式验证规则
export const refundMethodSchema = z.enum(
  ['cash', 'bank_transfer', 'original_payment', 'other'],
  {
    required_error: '请选择退款方式',
    invalid_type_error: '退款方式格式不正确',
  }
);

// 退款状态验证规则
export const refundStatusSchema = z.enum(
  ['pending', 'processing', 'completed', 'rejected', 'cancelled'],
  {
    required_error: '请选择退款状态',
    invalid_type_error: '退款状态格式不正确',
  }
);

// 退款类型验证规则
export const refundTypeSchema = z.enum(
  ['full_refund', 'partial_refund', 'exchange_refund'],
  {
    required_error: '请选择退款类型',
    invalid_type_error: '退款类型格式不正确',
  }
);

// 退款记录创建验证规则
export const createRefundRecordSchema = z
  .object({
    returnOrderId: z
      .string({
        invalid_type_error: '退货订单ID必须是字符串',
      })
      .min(1, '退货订单ID不能为空')
      .optional(),

    returnOrderNumber: z
      .string({
        invalid_type_error: '退货订单号必须是字符串',
      })
      .min(1, '退货订单号不能为空')
      .optional(),

    salesOrderId: z
      .string({
        required_error: '请选择销售订单',
        invalid_type_error: '销售订单ID必须是字符串',
      })
      .min(1, '请选择销售订单'),

    customerId: z
      .string({
        required_error: '请选择客户',
        invalid_type_error: '客户ID必须是字符串',
      })
      .min(1, '请选择客户'),

    refundType: refundTypeSchema,

    refundMethod: refundMethodSchema,

    refundAmount: z
      .number({
        required_error: '请输入退款金额',
        invalid_type_error: '退款金额必须是数字',
      })
      .positive('退款金额必须大于0')
      .max(999999999, '退款金额不能超过999,999,999'),

    refundDate: z
      .string({
        required_error: '请选择退款日期',
        invalid_type_error: '退款日期必须是字符串',
      })
      .min(1, '请选择退款日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的日期格式'),

    reason: z
      .string({
        required_error: '请输入退款原因',
        invalid_type_error: '退款原因必须是字符串',
      })
      .min(1, '请输入退款原因')
      .max(500, '退款原因不能超过500个字符'),

    remarks: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 银行转账时必须提供银行信息
      if (data.refundMethod === 'bank_transfer' && !data.bankInfo?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: '银行转账时必须提供银行信息',
      path: ['bankInfo'],
    }
  )
  .refine(
    data => {
      // 如果提供了退货订单ID，必须同时提供退货订单号
      if (data.returnOrderId && !data.returnOrderNumber?.trim()) {
        return false;
      }
      // 如果提供了退货订单号，必须同时提供退货订单ID
      if (data.returnOrderNumber && !data.returnOrderId?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: '退货订单ID和退货订单号必须同时提供或同时为空',
      path: ['returnOrderId'],
    }
  );

// 退款记录更新验证规则
export const updateRefundRecordSchema = z
  .object({
    refundMethod: refundMethodSchema.optional(),

    refundAmount: z
      .number({
        invalid_type_error: '退款金额必须是数字',
      })
      .positive('退款金额必须大于0')
      .max(999999999, '退款金额不能超过999,999,999')
      .optional(),

    processedAmount: z
      .number({
        invalid_type_error: '已处理金额必须是数字',
      })
      .min(0, '已处理金额不能小于0')
      .max(999999999, '已处理金额不能超过999,999,999')
      .optional(),

    refundDate: z
      .string({
        invalid_type_error: '退款日期必须是字符串',
      })
      .min(1, '请选择退款日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的日期格式')
      .optional(),

    processedDate: z
      .string({
        invalid_type_error: '处理日期必须是字符串',
      })
      .min(1, '请选择处理日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的日期格式')
      .optional(),

    status: refundStatusSchema.optional(),

    reason: z
      .string({
        invalid_type_error: '退款原因必须是字符串',
      })
      .min(1, '请输入退款原因')
      .max(500, '退款原因不能超过500个字符')
      .optional(),

    remarks: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 银行转账时必须提供银行信息
      if (data.refundMethod === 'bank_transfer' && !data.bankInfo?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: '银行转账时必须提供银行信息',
      path: ['bankInfo'],
    }
  )
  .refine(
    data => {
      // 已处理金额不能超过退款金额
      if (
        data.refundAmount &&
        data.processedAmount &&
        data.processedAmount > data.refundAmount
      ) {
        return false;
      }
      return true;
    },
    {
      message: '已处理金额不能超过退款金额',
      path: ['processedAmount'],
    }
  );

// 退款查询参数验证规则
export const refundQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(paginationConfig.maxPageSize)
    .optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  returnOrderId: z.string().optional(),
  salesOrderId: z.string().optional(),
  status: refundStatusSchema.optional(),
  refundType: refundTypeSchema.optional(),
  refundMethod: refundMethodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z
    .enum(['refundDate', 'refundAmount', 'createdAt', 'updatedAt'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// 退款处理验证规则
export const processRefundSchema = z.object({
  processedAmount: z
    .number({
      required_error: '请输入处理金额',
      invalid_type_error: '处理金额必须是数字',
    })
    .positive('处理金额必须大于0')
    .max(999999999, '处理金额不能超过999,999,999'),

  processedDate: z
    .string({
      required_error: '请选择处理日期',
      invalid_type_error: '处理日期必须是字符串',
    })
    .min(1, '请选择处理日期')
    .refine(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),

  status: z.enum(['completed', 'rejected'], {
    required_error: '请选择处理结果',
    invalid_type_error: '处理结果格式不正确',
  }),

  remarks: z.string().optional().or(z.literal('')),
});

// 批量退款验证规则
export const batchRefundSchema = z.object({
  refundIds: z
    .array(z.string(), {
      required_error: '请选择要处理的退款记录',
      invalid_type_error: '退款记录ID列表格式不正确',
    })
    .min(1, '请至少选择一个退款记录')
    .max(
      returnRefundConfig.refundBatchLimit,
      `一次最多处理${returnRefundConfig.refundBatchLimit}个退款记录`
    ),

  action: z.enum(['approve', 'reject', 'cancel'], {
    required_error: '请选择批量操作类型',
    invalid_type_error: '批量操作类型格式不正确',
  }),

  remarks: z.string().optional().or(z.literal('')),
});

// TypeScript类型推导
export type CreateRefundRecordInput = z.infer<typeof createRefundRecordSchema>;
export type UpdateRefundRecordInput = z.infer<typeof updateRefundRecordSchema>;
export type RefundQueryInput = z.infer<typeof refundQuerySchema>;
export type ProcessRefundInput = z.infer<typeof processRefundSchema>;
export type BatchRefundInput = z.infer<typeof batchRefundSchema>;

// 表单字段配置
export const REFUND_FORM_FIELDS = {
  returnOrderId: {
    label: '退货订单',
    placeholder: '请选择退货订单',
    required: true,
  },
  salesOrderId: {
    label: '销售订单',
    placeholder: '请选择销售订单',
    required: true,
  },
  customerId: {
    label: '客户',
    placeholder: '请选择客户',
    required: true,
  },
  refundType: {
    label: '退款类型',
    placeholder: '请选择退款类型',
    required: true,
  },
  refundMethod: {
    label: '退款方式',
    placeholder: '请选择退款方式',
    required: true,
  },
  refundAmount: {
    label: '退款金额',
    placeholder: '请输入退款金额',
    required: true,
  },
  refundDate: {
    label: '退款日期',
    placeholder: '请选择退款日期',
    required: true,
  },
  reason: {
    label: '退款原因',
    placeholder: '请输入退款原因',
    required: true,
  },
  remarks: {
    label: '备注',
    placeholder: '请输入备注信息（可选）',
    required: false,
  },
  bankInfo: {
    label: '银行信息',
    placeholder: '请输入银行账户信息',
    required: false,
  },
  receiptNumber: {
    label: '凭证号',
    placeholder: '请输入凭证号（可选）',
    required: false,
  },
} as const;
