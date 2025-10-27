/**
 * 库存管理页面URL参数Schema
 *
 * 用于 useUrlSearchParams Hook 的类型安全参数管理
 */

import { z } from 'zod';

/**
 * 库存查询参数Schema
 * ✅ 修复：筛选字段使用optional()而非空字符串默认值，确保undefined能正确清除筛选
 */
export const inventoryParamsSchema = z.object({
  // 搜索关键词
  search: z.string().default(''),

  // 产品分类筛选 - ✅ 修复：使用optional()而非空字符串
  categoryId: z.string().optional(),

  // 低库存筛选
  lowStock: z.boolean().default(false),

  // 有库存筛选
  hasStock: z.boolean().default(false),

  // 排序字段
  sortBy: z
    .enum([
      'updatedAt',
      'createdAt',
      'quantity',
      'reservedQuantity',
      'batchNumber',
      'productId',
    ])
    .default('updatedAt'),

  // 排序顺序
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // 分页
  page: z.number().int().positive().default(1),

  // 每页数量
  limit: z.number().int().positive().max(100).default(50),

  // 日期范围筛选
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // 可选的其他筛选
  productId: z.string().optional(),
  batchNumber: z.string().optional(),
  location: z.string().optional(),
});

/**
 * 推导TypeScript类型
 */
export type InventoryParams = z.infer<typeof inventoryParamsSchema>;
