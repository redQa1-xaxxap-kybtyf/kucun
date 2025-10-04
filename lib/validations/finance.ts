// 财务统计查询参数验证规则
// 遵循全栈项目统一约定规范，使用 Zod 作为唯一真理源

import { z } from 'zod';

// ==================== 查询参数验证 ====================

// 财务统计查询参数验证规则
export const financeStatisticsQuerySchema = z
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

    customerId: z.string().min(1).trim().optional().or(z.literal('')),

    supplierId: z.string().min(1).trim().optional().or(z.literal('')),

    includeRefunds: z.boolean().optional().default(true),

    includeStatements: z.boolean().optional().default(true),

    includePayables: z.boolean().optional().default(true),

    includeReceivables: z.boolean().optional().default(true),
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

// 财务概览查询参数验证规则
export const financeOverviewQuerySchema = z.object({
  period: z
    .enum(['today', 'week', 'month', 'quarter', 'year', 'custom'])
    .optional()
    .default('month'),

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

  includeCharts: z.boolean().optional().default(true),
});

// 财务报表查询参数验证规则
export const financeReportQuerySchema = z
  .object({
    reportType: z.enum([
      'income_statement',
      'balance_sheet',
      'cash_flow',
      'receivables_aging',
      'payables_aging',
      'customer_statement',
      'supplier_statement',
    ]),

    startDate: z
      .string({
        error: issue =>
          issue.input === undefined
            ? '开始日期不能为空'
            : '开始日期必须是字符串',
      })
      .min(1, { error: '开始日期不能为空' })
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { error: '请输入有效的开始日期格式' }
      ),

    endDate: z
      .string({
        error: issue =>
          issue.input === undefined
            ? '结束日期不能为空'
            : '结束日期必须是字符串',
      })
      .min(1, { error: '结束日期不能为空' })
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { error: '请输入有效的结束日期格式' }
      ),

    customerId: z.string().optional(),
    supplierId: z.string().optional(),

    format: z.enum(['json', 'pdf', 'excel', 'csv']).optional().default('json'),

    includeDetails: z.boolean().optional().default(false),

    groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  })
  .refine(
    data => {
      // 验证日期范围
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  )
  .refine(
    data => {
      // 客户报表必须指定客户ID
      if (data.reportType === 'customer_statement' && !data.customerId) {
        return false;
      }
      // 供应商报表必须指定供应商ID
      if (data.reportType === 'supplier_statement' && !data.supplierId) {
        return false;
      }
      return true;
    },
    {
      message: '该报表类型需要指定相应的客户或供应商',
      path: ['customerId'],
    }
  );

// ==================== 导出类型 ====================

export type FinanceStatisticsQueryInput = z.infer<
  typeof financeStatisticsQuerySchema
>;
export type FinanceOverviewQueryInput = z.infer<
  typeof financeOverviewQuerySchema
>;
export type FinanceReportQueryInput = z.infer<typeof financeReportQuerySchema>;

// ==================== 验证工具函数 ====================

/**
 * 获取默认日期范围
 */
export const getDefaultDateRange = (period: string) => {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
};

/**
 * 验证金额是否在合理范围内
 */
export const validateAmountRange = (
  amount: number,
  minAmount = -999999999,
  maxAmount = 999999999
): boolean => {
  return amount >= minAmount && amount <= maxAmount;
};
