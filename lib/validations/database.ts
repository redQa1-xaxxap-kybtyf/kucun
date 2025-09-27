import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

// 基础验证规则已迁移到 lib/validations/base.ts
// 遵循唯一真理源原则，请使用 lib/validations/base.ts 中的验证规则

// 用户相关验证已迁移到 lib/validations/base.ts
// 遵循唯一真理源原则，请使用 lib/validations/base.ts 中的验证规则

// 客户相关验证已迁移到 lib/validations/customer.ts
// 遵循唯一真理源原则，请使用 lib/validations/customer.ts 中的验证规则

// 产品相关验证已迁移到 lib/validations/product.ts
// 遵循唯一真理源原则，请使用 lib/validations/product.ts 中的验证规则

// 销售订单相关验证已迁移到 lib/validations/sales-order.ts
// 遵循唯一真理源原则，请使用 lib/validations/sales-order.ts 中的验证规则

// 库存相关验证 - 已迁移到 lib/validations/inventory-operations.ts
// 遵循唯一真理源原则，请使用 lib/validations/inventory-operations.ts 中的验证规则

// 入库记录相关验证 - 已迁移到 lib/validations/inbound.ts
// 遵循唯一真理源原则，请使用 lib/validations/inbound.ts 中的验证规则

// 分页查询验证
export const paginationValidations = {
  query: z.object({
    page: z.number().int().min(1, '页码必须大于0').default(1),
    limit: z
      .number()
      .int()
      .min(1, '每页数量必须大于0')
      .max(
        paginationConfig.maxPageSize,
        `每页数量不能超过${paginationConfig.maxPageSize}`
      )
      .default(paginationConfig.defaultPageSize),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    // 新增库存查询参数
    productId: z.string().optional(),
    variantId: z.string().optional(),
    colorCode: z.string().optional(),
    batchNumber: z.string().optional(),
    location: z.string().optional(),
    productionDateStart: z.string().optional(),
    productionDateEnd: z.string().optional(),
    lowStock: z.boolean().optional(),
    hasStock: z.boolean().optional(),
    groupByVariant: z.boolean().optional(),
    includeVariants: z.boolean().optional(),
  }),
};

// API 响应验证
export const apiResponseValidations = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
  }),

  error: z.object({
    success: z.literal(false),
    error: z.string(),
    details: z.any().optional(),
  }),

  paginated: z.object({
    success: z.literal(true),
    data: z.array(z.any()),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  }),
};

// 类型定义已迁移到各自的验证文件中
// 用户相关类型 - 请从 lib/validations/base.ts 导入
// 客户相关类型 - 请从 lib/validations/customer.ts 导入
// 产品相关类型 - 请从 lib/validations/product.ts 导入
// 销售订单相关类型 - 请从 lib/validations/sales-order.ts 导入
// 库存相关类型 - 请从 lib/types/inventory.ts 导入
// 入库记录相关类型 - 请从 lib/validations/inbound.ts 导入

export type PaginationQuery = z.infer<typeof paginationValidations.query>;
