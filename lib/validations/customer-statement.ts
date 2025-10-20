// 客户对账单验证规则
// 使用Zod定义客户对账单的查询和操作验证规则

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

/**
 * 交易类型验证规则
 */
export const customerStatementTransactionTypeSchema = z.enum([
  'sales_order',
  'sales_return',
  'purchase_order',
  'purchase_return',
  'payment_in',
  'payment_out',
  'refund_out',
  'refund_in',
]);

/**
 * 余额类型验证规则
 */
export const balanceTypeSchema = z.enum(['receivable', 'payable', 'all']);

/**
 * 客户对账单查询验证规则
 */
export const customerStatementQuerySchema = z.object({
  // 分页参数
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .or(z.string().transform(val => parseInt(val, 10))),

  pageSize: z
    .number()
    .int()
    .positive()
    .max(paginationConfig.maxPageSize)
    .optional()
    .default(20)
    .or(z.string().transform(val => parseInt(val, 10))),

  // 筛选条件
  customerId: z.string().min(1, '客户ID不能为空').optional().or(z.literal('')),

  customerName: z
    .string()
    .max(100, '客户名称不能超过100个字符')
    .optional()
    .or(z.literal('')),

  startDate: z
    .string()
    .optional()
    .refine(
      date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      },
      { message: '请输入有效的开始日期格式' }
    ),

  endDate: z
    .string()
    .optional()
    .refine(
      date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      },
      { message: '请输入有效的结束日期格式' }
    ),

  // 余额筛选
  minBalance: z
    .number()
    .optional()
    .or(z.string().transform(val => parseFloat(val))),

  maxBalance: z
    .number()
    .optional()
    .or(z.string().transform(val => parseFloat(val))),

  balanceType: balanceTypeSchema.optional().default('all'),

  // 排序
  sortBy: z
    .enum([
      'customerName',
      'netBalance',
      'receivableBalance',
      'payableBalance',
      'lastTransactionDate',
    ])
    .optional()
    .default('customerName'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * 客户对账单详情查询验证规则
 */
export const customerStatementDetailQuerySchema = z
  .object({
    customerId: z.string().min(1, '客户ID不能为空'),

    startDate: z
      .string()
      .min(1, '开始日期不能为空')
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { message: '请输入有效的开始日期格式' }
      ),

    endDate: z
      .string()
      .min(1, '结束日期不能为空')
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { message: '请输入有效的结束日期格式' }
      ),
  })
  .refine(
    data => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      return startDate <= endDate;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

/**
 * 对账单导出验证规则
 */
export const customerStatementExportSchema = z
  .object({
    customerId: z.string().min(1, '客户ID不能为空'),

    startDate: z
      .string()
      .min(1, '开始日期不能为空')
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { message: '请输入有效的开始日期格式' }
      ),

    endDate: z
      .string()
      .min(1, '结束日期不能为空')
      .refine(
        date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        },
        { message: '请输入有效的结束日期格式' }
      ),

    format: z.enum(['excel', 'pdf']).optional().default('excel'),

    includeDetails: z.boolean().optional().default(true),
  })
  .refine(
    data => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      return startDate <= endDate;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

/**
 * TypeScript类型推导
 */
export type CustomerStatementQueryInput = z.infer<
  typeof customerStatementQuerySchema
>;
export type CustomerStatementDetailQueryInput = z.infer<
  typeof customerStatementDetailQuerySchema
>;
export type CustomerStatementExportInput = z.infer<
  typeof customerStatementExportSchema
>;

/**
 * 表单字段配置
 */
export const CUSTOMER_STATEMENT_FORM_FIELDS = {
  customerId: {
    label: '客户',
    placeholder: '请选择客户',
    required: true,
  },
  customerName: {
    label: '客户名称',
    placeholder: '搜索客户名称',
    required: false,
  },
  startDate: {
    label: '开始日期',
    placeholder: '请选择开始日期',
    required: true,
  },
  endDate: {
    label: '结束日期',
    placeholder: '请选择结束日期',
    required: true,
  },
  balanceType: {
    label: '余额类型',
    placeholder: '请选择余额类型',
    required: false,
  },
  minBalance: {
    label: '最小余额',
    placeholder: '请输入最小余额',
    required: false,
  },
  maxBalance: {
    label: '最大余额',
    placeholder: '请输入最大余额',
    required: false,
  },
  format: {
    label: '导出格式',
    placeholder: '请选择导出格式',
    required: false,
  },
  includeDetails: {
    label: '包含明细',
    placeholder: '是否包含交易明细',
    required: false,
  },
} as const;
