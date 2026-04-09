/**
 * 应收账款查询参数Schema
 *
 * 用于 useUrlSearchParams Hook 的类型安全参数管理
 */

import { z } from 'zod';

/**
 * 应收账款查询参数Schema
 */
export const receivablesParamsSchema = z.object({
  // 搜索关键词
  search: z.string().default(''),

  // 支付状态筛选
  paymentStatus: z.enum(['unpaid', 'partial', 'pending', 'paid']).optional(),

  // 排序字段
  sortBy: z
    .enum([
      'orderDate',
      'createdAt',
      'updatedAt',
      'dueDate',
      'orderNumber',
      'customerName',
      'totalAmount',
      'paidAmount',
      'remainingAmount',
    ])
    .default('orderDate'),

  // 排序顺序
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // 分页
  page: z.number().int().positive().default(1),

  // 每页数量
  limit: z.number().int().positive().max(100).default(50),

  // 日期范围筛选
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * 推导TypeScript类型
 */
export type ReceivablesParams = z.infer<typeof receivablesParamsSchema>;
