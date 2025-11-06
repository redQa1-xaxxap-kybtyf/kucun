// 收款管理表单验证规则
// 使用Zod定义收款记录的创建、更新和查询验证规则

import { z } from 'zod';

// 收款方式枚举验证
export const paymentMethodSchema = z.enum(
  ['cash', 'wechat_transfer', 'abc_qr', 'icbc_qr', 'ccb_qr', 'cib_qr'],
  {
    message: '请选择有效的收款方式',
  }
);

// 收款状态枚举验证
export const paymentStatusSchema = z.enum(
  ['pending', 'confirmed', 'cancelled', 'applied'],
  {
    message: '请选择有效的收款状态',
  }
);

// 收款类型枚举验证
export const paymentTypeSchema = z.enum(['order_payment', 'prepayment'], {
  message: '请选择有效的收款类型',
});

// 收款记录创建验证规则
export const createPaymentRecordSchema = z
  .object({
    paymentType: paymentTypeSchema.default('order_payment'),

    salesOrderId: z.string({ message: '销售订单ID必须是字符串' }).optional(),
    factoryShipmentOrderId: z
      .string({ message: '厂家发货订单ID必须是字符串' })
      .optional(),

    customerId: z
      .string({ message: '客户ID必须是字符串' })
      .min(1, { error: '请选择客户' }),

    paymentMethod: paymentMethodSchema,

    paymentAmount: z
      .number({ message: '收款金额必须是数字' })
      .positive({ error: '收款金额必须大于0' })
      .max(999999999, { error: '收款金额不能超过999,999,999' }),

    actualPaymentAmount: z
      .number({ message: '实际收款金额必须是数字' })
      .min(0, { error: '实际收款金额不能为负' })
      .max(999999999, { error: '实际收款金额不能超过999,999,999' }),

    roundingAmount: z
      .number({ message: '抹零金额必须是数字' })
      .min(-9999999, { error: '抹零金额不能低于-9,999,999' })
      .max(9999999, { error: '抹零金额不能超过9,999,999' }),

    paymentDate: z
      .string({ message: '收款日期必须是字符串' })
      .min(1, { error: '请选择收款日期' })
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { error: '请输入有效的日期格式' }
      ),

    remarks: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),
  })
  .refine(
    data => {
      // 订单收款时必须提供订单ID
      if (
        data.paymentType === 'order_payment' &&
        !data.salesOrderId &&
        !data.factoryShipmentOrderId
      ) {
        return false;
      }
      return true;
    },
    {
      message: '订单收款时必须关联销售订单或厂家发货单',
      path: ['salesOrderId'],
    }
  )
  .refine(
    data => {
      // 预收款时不应提供订单ID
      if (data.paymentType === 'prepayment' && data.salesOrderId) {
        return false;
      }
      return true;
    },
    {
      message: '预收款不应关联销售订单',
      path: ['salesOrderId'],
    }
  )
  .refine(
    data => {
      if (data.paymentType === 'prepayment' && data.factoryShipmentOrderId) {
        return false;
      }
      return true;
    },
    {
      message: '预收款不应关联厂家发货订单',
      path: ['factoryShipmentOrderId'],
    }
  )
  .refine(
    data => {
      const expected = Number(
        (data.actualPaymentAmount + data.roundingAmount).toFixed(2)
      );
      const actual = Number(data.paymentAmount.toFixed(2));
      return Math.abs(expected - actual) < 0.01;
    },
    {
      message: '收款金额应等于实际收款金额与抹零金额之和',
      path: ['actualPaymentAmount'],
    }
  );

// 收款记录更新验证规则
export const updatePaymentRecordSchema = z
  .object({
    paymentMethod: paymentMethodSchema.optional(),
    factoryShipmentOrderId: z
      .string({ message: '厂家发货订单ID必须是字符串' })
      .optional(),

    paymentAmount: z
      .number({
        error: '收款金额必须是数字',
      })
      .positive({ error: '收款金额必须大于0' })
      .max(999999999, { error: '收款金额不能超过999,999,999' })
      .optional(),

    actualPaymentAmount: z
      .number({ message: '实际收款金额必须是数字' })
      .min(0, { error: '实际收款金额不能为负' })
      .max(999999999, { error: '实际收款金额不能超过999,999,999' })
      .optional(),

    roundingAmount: z
      .number({ message: '抹零金额必须是数字' })
      .min(-9999999, { error: '抹零金额不能低于-9,999,999' })
      .max(9999999, { error: '抹零金额不能超过9,999,999' })
      .optional(),

    paymentDate: z
      .string({ message: '收款日期必须是字符串' })
      .min(1, { error: '请选择收款日期' })
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { error: '请输入有效的日期格式' }
      )
      .optional(),

    status: paymentStatusSchema.optional(),

    remarks: z.string().optional().or(z.literal('')),

    receiptNumber: z.string().optional().or(z.literal('')),

    bankInfo: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    const hasActual = data.actualPaymentAmount !== undefined;
    const hasRounding = data.roundingAmount !== undefined;

    if (hasActual || hasRounding) {
      if (data.paymentAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '更新实际收款金额或抹零金额时必须同时提供收款金额',
          path: ['paymentAmount'],
        });
        return;
      }

      const actual = data.actualPaymentAmount ?? 0;
      const rounding = data.roundingAmount ?? 0;
      const expected = Number((actual + rounding).toFixed(2));
      const recorded = Number(data.paymentAmount.toFixed(2));

      if (Math.abs(expected - recorded) >= 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '收款金额应等于实际收款金额与抹零金额之和',
          path: ['actualPaymentAmount'],
        });
      }
    }
  });

// 收款记录查询验证规则
export const paymentRecordQuerySchema = z
  .object({
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().max(100).optional().default(10),
    search: z.string().optional(),
    customerId: z.string().optional(),
    factoryShipmentOrderId: z.string().optional(),
    userId: z.string().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: paymentStatusSchema.optional(),
    startDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) {
          return true;
        }
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
    limit: z.number().int().positive().max(100).optional().default(10),
    search: z.string().optional(),
    customerId: z.string().optional(),
    paymentStatus: z.enum(['unpaid', 'partial', 'pending', 'paid']).optional(),
    startDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的结束日期格式'),
    sortBy: z
      .enum([
        'createdAt',
        'updatedAt',
        'dueDate',
        'orderNumber',
        'customerName',
        'totalAmount',
        'paidAmount',
        'remainingAmount',
      ])
      .optional()
      .default('createdAt'),
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
      error: '收款记录ID不能为空',
    })
    .min(1, '收款记录ID不能为空'),

  confirmationDate: z
    .string({
      error: '请选择确认日期',
    })
    .min(1, '请选择确认日期')
    .refine(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),

  confirmedBy: z
    .string({
      error: '确认人不能为空',
    })
    .min(1, '确认人不能为空'),

  notes: z.string().optional().or(z.literal('')),
});

// 批量操作验证规则
export const batchPaymentOperationSchema = z.object({
  paymentRecordIds: z.array(z.string()).min(1, '请选择至少一条收款记录'),
  operation: z.enum(['confirm', 'cancel', 'delete'], {
    error: '请选择有效的操作类型',
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
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),
    endDate: z
      .string()
      .optional()
      .refine(date => {
        if (!date) {
          return true;
        }
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
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentType = z.infer<typeof paymentTypeSchema>;

// 验证工具函数
export const validatePaymentAmount = (
  amount: number,
  maxAmount: number
): boolean => amount > 0 && amount <= maxAmount;

export const validatePaymentDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime()) && parsedDate <= new Date();
};

export const validateBankInfo = (
  _paymentMethod: string,
  _bankInfo?: string
): boolean =>
  // 新的收款方式不需要强制验证银行信息
  true;

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
  actualPaymentAmount: {
    name: 'actualPaymentAmount',
    label: '实际收款金额',
    placeholder: '请输入实际到账金额',
    required: true,
    type: 'number',
  },
  roundingAmount: {
    name: 'roundingAmount',
    label: '抹零金额',
    placeholder: '请输入抹零金额',
    required: false,
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
