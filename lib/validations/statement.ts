// 往来账单验证规则
// 使用Zod定义往来账单的查询和操作验证规则

import { z } from 'zod';

// 账单类型验证规则
export const statementTypeSchema = z.enum(['customer', 'supplier'], {
  error: '请选择账单类型',
});

// 账单状态验证规则
export const statementStatusSchema = z.enum(
  ['active', 'settled', 'overdue', 'suspended'],
  {
    error: '请选择账单状态',
  }
);

// 交易类型验证规则
export const transactionTypeSchema = z.enum(
  ['sale', 'payment', 'refund', 'purchase', 'payment_out', 'adjustment'],
  {
    error: '请选择交易类型',
  }
);

// 往来账单查询验证规则
export const statementQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  entityType: statementTypeSchema.optional(),
  status: statementStatusSchema.optional(),
  creditLimitMin: z.number().min(0).optional(),
  creditLimitMax: z.number().min(0).optional(),
  pendingAmountMin: z.number().min(0).optional(),
  pendingAmountMax: z.number().min(0).optional(),
  overdueOnly: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z
    .enum([
      'entityName',
      'totalAmount',
      'pendingAmount',
      'overdueAmount',
      'lastTransactionDate',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// 交易记录查询验证规则
export const transactionQuerySchema = z.object({
  statementId: z.string().optional(),
  entityId: z.string().optional(),
  transactionType: transactionTypeSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['pending', 'completed', 'overdue']).optional(),
  sortBy: z.enum(['transactionDate', 'amount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// 账单调整验证规则
export const statementAdjustmentSchema = z.object({
  statementId: z
    .string({
      error: '请选择账单',
    })
    .min(1, '请选择账单'),

  adjustmentType: z.enum(['increase', 'decrease'], {
    error: '请选择调整类型',
  }),

  amount: z
    .number({
      error: '请输入调整金额',
    })
    .positive('调整金额必须大于0')
    .max(999999999, '调整金额不能超过999,999,999'),

  reason: z
    .string({
      error: '请输入调整原因',
    })
    .min(1, '请输入调整原因')
    .max(500, '调整原因不能超过500个字符'),

  adjustmentDate: z
    .string({
      error: '请选择调整日期',
    })
    .min(1, '请选择调整日期')
    .refine(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),

  remarks: z.string().optional().or(z.literal('')),
});

// 信用额度调整验证规则
export const creditLimitAdjustmentSchema = z.object({
  statementId: z
    .string({
      error: '请选择账单',
    })
    .min(1, '请选择账单'),

  newCreditLimit: z
    .number({
      error: '请输入新的信用额度',
    })
    .min(0, '信用额度不能小于0')
    .max(999999999, '信用额度不能超过999,999,999'),

  reason: z
    .string({
      error: '请输入调整原因',
    })
    .min(1, '请输入调整原因')
    .max(500, '调整原因不能超过500个字符'),

  effectiveDate: z
    .string({
      error: '请选择生效日期',
    })
    .min(1, '请选择生效日期')
    .refine(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),

  remarks: z.string().optional().or(z.literal('')),
});

// 对账单生成验证规则
export const reconciliationSchema = z
  .object({
    statementId: z
      .string({
        error: '请选择账单',
      })
      .min(1, '请选择账单'),

    periodStart: z
      .string({
        error: '请选择开始日期',
      })
      .min(1, '请选择开始日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的开始日期格式'),

    periodEnd: z
      .string({
        error: '请选择结束日期',
      })
      .min(1, '请选择结束日期')
      .refine(date => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, '请输入有效的结束日期格式'),

    includeSettled: z.boolean().optional().default(false),

    format: z.enum(['pdf', 'excel', 'csv']).optional().default('pdf'),
  })
  .refine(
    data => {
      const startDate = new Date(data.periodStart);
      const endDate = new Date(data.periodEnd);
      return startDate <= endDate;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['periodEnd'],
    }
  );

// 账龄分析查询验证规则
export const agingAnalysisSchema = z.object({
  entityType: statementTypeSchema.optional(),
  entityIds: z.array(z.string()).optional(),
  asOfDate: z
    .string()
    .optional()
    .refine(date => {
      if (!date) {
        return true;
      }
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, '请输入有效的日期格式'),
  includeZeroBalance: z.boolean().optional().default(false),
});

// 批量操作验证规则
export const batchStatementOperationSchema = z.object({
  statementIds: z
    .array(z.string(), {
      error: '请选择要操作的账单',
    })
    .min(1, '请至少选择一个账单')
    .max(50, '一次最多操作50个账单'),

  operation: z.enum(['suspend', 'activate', 'settle', 'adjust_credit'], {
    error: '请选择批量操作类型',
  }),

  operationData: z.record(z.string(), z.unknown()).optional(),

  remarks: z.string().optional().or(z.literal('')),
});

// TypeScript类型推导
export type StatementQueryInput = z.infer<typeof statementQuerySchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type StatementAdjustmentInput = z.infer<
  typeof statementAdjustmentSchema
>;
export type CreditLimitAdjustmentInput = z.infer<
  typeof creditLimitAdjustmentSchema
>;
export type ReconciliationInput = z.infer<typeof reconciliationSchema>;
export type AgingAnalysisInput = z.infer<typeof agingAnalysisSchema>;
export type BatchStatementOperationInput = z.infer<
  typeof batchStatementOperationSchema
>;

// 表单字段配置
export const STATEMENT_FORM_FIELDS = {
  entityType: {
    label: '账单类型',
    placeholder: '请选择账单类型',
    required: true,
  },
  status: {
    label: '账单状态',
    placeholder: '请选择账单状态',
    required: false,
  },
  creditLimit: {
    label: '信用额度',
    placeholder: '请输入信用额度',
    required: false,
  },
  paymentTerms: {
    label: '付款条件',
    placeholder: '请输入付款条件',
    required: false,
  },
  adjustmentType: {
    label: '调整类型',
    placeholder: '请选择调整类型',
    required: true,
  },
  amount: {
    label: '调整金额',
    placeholder: '请输入调整金额',
    required: true,
  },
  reason: {
    label: '调整原因',
    placeholder: '请输入调整原因',
    required: true,
  },
  adjustmentDate: {
    label: '调整日期',
    placeholder: '请选择调整日期',
    required: true,
  },
  periodStart: {
    label: '开始日期',
    placeholder: '请选择开始日期',
    required: true,
  },
  periodEnd: {
    label: '结束日期',
    placeholder: '请选择结束日期',
    required: true,
  },
  remarks: {
    label: '备注',
    placeholder: '请输入备注信息（可选）',
    required: false,
  },
} as const;
