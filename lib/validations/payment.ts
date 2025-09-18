// 收款管理表单验证规则
// 使用Zod定义收款记录的创建、更新和查询验证规则

import { z } from 'zod';

// 收款方式枚举验证
export const paymentMethodSchema = z.enum(
  ['cash', 'bank_transfer', 'check', 'other'],
  {
    errorMap: () => ({ message: '请选择有效的收款方式' }),
  }
);

// 收款状态枚举验证
export const paymentStatusSchema = z.enum(
  ['pending', 'confirmed', 'cancelled'],
  {
    errorMap: () => ({ message: '请选择有效的收款状态' }),
  }
);

// 收款记录创建验证规则
export const createPaymentRecordSchema = z
  .object({
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

    paymentMethod: paymentMethodSchema,

    paymentAmount: z
      .number({
        required_error: '请输入收款金额',
        invalid_type_error: '收款金额必须是数字',
      })
      .positive('收款金额必须大于0')
      .max(999999999, '收款金额不能超过999,999,999'),

    paymentDate: z
      .string({
        required_error: '请选择收款日期',
        invalid_type_error: '收款日期必须是字符串',
      })
      .min(1, '请选择收款日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的日期格式'),

    remarks: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 银行转账时必须填写银行信息
      if (data.paymentMethod === 'bank_transfer' && !data.bankInfo?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: '银行转账时必须填写银行信息',
      path: ['bankInfo'],
    }
  );

// 收款记录更新验证规则
export const updatePaymentRecordSchema = z
  .object({
    paymentMethod: paymentMethodSchema.optional(),

    paymentAmount: z
      .number({
        invalid_type_error: '收款金额必须是数字',
      })
      .positive('收款金额必须大于0')
      .max(999999999, '收款金额不能超过999,999,999')
      .optional(),

    paymentDate: z
      .string({
        invalid_type_error: '收款日期必须是字符串',
      })
      .min(1, '请选择收款日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的日期格式')
      .optional(),

    status: paymentStatusSchema.optional(),

    remarks: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 银行转账时必须填写银行信息
      if (data.paymentMethod === 'bank_transfer' && !data.bankInfo?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: '银行转账时必须填写银行信息',
      path: ['bankInfo'],
    }
  );

// 收款记录查询验证规则
export const paymentRecordQuerySchema = z
  .object({
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().max(100).optional().default(10),
    search: z.string().optional(),
    customerId: z.string().optional(),
    userId: z.string().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: paymentStatusSchema.optional(),
    startDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的结束日期格式'),
    sortBy: z
      .enum(['paymentDate', 'paymentAmount', 'createdAt'])
      .optional()
      .default('paymentDate'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 应收账款查询验证规则
export const accountsReceivableQuerySchema = z
  .object({
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().max(100).optional().default(10),
    search: z.string().optional(),
    customerId: z.string().optional(),
    paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'overdue']).optional(),
    startDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的结束日期格式'),
    sortBy: z
      .enum(['orderDate', 'totalAmount', 'remainingAmount', 'overdueDays'])
      .optional()
      .default('orderDate'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 收款确认验证规则
export const paymentConfirmationSchema = z.object({
  paymentRecordId: z
    .string({
      required_error: '收款记录ID不能为空',
      invalid_type_error: '收款记录ID必须是字符串',
    })
    .min(1, '收款记录ID不能为空'),

  confirmationDate: z
    .string({
      required_error: '请选择确认日期',
      invalid_type_error: '确认日期必须是字符串',
    })
    .min(1, '请选择确认日期')
    .refine(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),

  confirmedBy: z
    .string({
      required_error: '确认人不能为空',
      invalid_type_error: '确认人必须是字符串',
    })
    .min(1, '确认人不能为空'),

  notes: z.string().optional().or(z.literal('')),
});

// 批量操作验证规则
export const batchPaymentOperationSchema = z.object({
  paymentRecordIds: z.array(z.string()).min(1, '请选择至少一条收款记录'),
  operation: z.enum(['confirm', 'cancel', 'delete'], {
    errorMap: () => ({ message: '请选择有效的操作类型' }),
  }),
  notes: z.string().optional().or(z.literal('')),
});

// 收款统计查询验证规则
export const paymentStatisticsQuerySchema = z
  .object({
    startDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的结束日期格式'),
    customerId: z.string().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    groupBy: z
      .enum(['day', 'week', 'month', 'year'])
      .optional()
      .default('month'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 导出验证规则类型
export type CreatePaymentRecordInput = z.infer<
  typeof createPaymentRecordSchema
>;
export type UpdatePaymentRecordInput = z.infer<
  typeof updatePaymentRecordSchema
>;
export type PaymentRecordQueryInput = z.infer<typeof paymentRecordQuerySchema>;
export type AccountsReceivableQueryInput = z.infer<
  typeof accountsReceivableQuerySchema
>;
export type PaymentConfirmationInput = z.infer<
  typeof paymentConfirmationSchema
>;
export type BatchPaymentOperationInput = z.infer<
  typeof batchPaymentOperationSchema
>;
export type PaymentStatisticsQueryInput = z.infer<
  typeof paymentStatisticsQuerySchema
>;

// 导入统一的验证函数
export { validatePaymentAmount } from '@/lib/utils/validation-helpers';

export const validatePaymentDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime()) && parsedDate <= new Date();
};

export const validateBankInfo = (
  paymentMethod: string,
  bankInfo?: string
): boolean => {
  if (paymentMethod === 'bank_transfer') {
    return !!bankInfo?.trim();
  }
  return true;
};

// 表单字段配置
export const PAYMENT_FORM_FIELDS = {
  salesOrderId: {
    name: 'salesOrderId',
    label: '销售订单',
    placeholder: '请选择销售订单',
    required: true,
  },
  customerId: {
    name: 'customerId',
    label: '客户',
    placeholder: '请选择客户',
    required: true,
  },
  paymentMethod: {
    name: 'paymentMethod',
    label: '收款方式',
    placeholder: '请选择收款方式',
    required: true,
  },
  paymentAmount: {
    name: 'paymentAmount',
    label: '收款金额',
    placeholder: '请输入收款金额',
    required: true,
    type: 'number',
  },
  paymentDate: {
    name: 'paymentDate',
    label: '收款日期',
    placeholder: '请选择收款日期',
    required: true,
    type: 'date',
  },
  remarks: {
    name: 'remarks',
    label: '备注',
    placeholder: '请输入备注信息',
    required: false,
  },
  receiptNumber: {
    name: 'receiptNumber',
    label: '收据号',
    placeholder: '请输入收据号',
    required: false,
  },
  bankInfo: {
    name: 'bankInfo',
    label: '银行信息',
    placeholder: '请输入银行信息（转账时必填）',
    required: false,
  },
} as const;
