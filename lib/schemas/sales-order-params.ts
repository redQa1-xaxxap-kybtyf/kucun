/**
 * 销售订单页面URL参数Schema
 *
 * 用于 useUrlSearchParams Hook 的类型安全参数管理
 */

import { z } from 'zod';

/**
 * 销售订单查询参数Schema
 */
export const salesOrderParamsSchema = z.object({
  // 搜索关键词
  search: z.string().default(''),

  // 订单状态筛选
  status: z
    .enum(['draft', 'confirmed', 'shipped', 'completed', 'cancelled'])
    .optional(),

  // 客户ID筛选
  customerId: z.string().default(''),

  // 销售员筛选
  userId: z.string().default(''),

  // 排序字段
  sortBy: z
    .enum([
      'orderNumber',
      'createdAt',
      'updatedAt',
      'totalAmount',
      'status',
      'shippedAt',
    ])
    .default('createdAt'),

  // 排序顺序
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // 分页
  page: z.number().int().positive().default(1),

  // 每页数量
  limit: z.number().int().positive().max(100).optional(),

  // 日期范围筛选
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  // 订单类型筛选
  orderType: z.enum(['NORMAL', 'TRANSFER']).optional(),

  // 是否包含退货订单
  hasReturns: z.boolean().optional(),
});

/**
 * 推导TypeScript类型
 */
export type SalesOrderParams = z.infer<typeof salesOrderParamsSchema>;
