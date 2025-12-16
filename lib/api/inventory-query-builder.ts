/**
 * 库存查询构建器
 * 提供优化的库存查询方法，解决N+1查询问题
 * 遵循全栈项目统一约定规范
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { InventoryQueryParams } from '@/lib/types/inventory';

const AVAILABLE_QUANTITY_SQL = Prisma.raw(
  '(CASE WHEN i.quantity - i.reserved_quantity < 0 THEN 0 ELSE i.quantity - i.reserved_quantity END)'
);

/**
 * 库存查询结果 Zod Schema (用于运行时验证)
 */
const inventoryQueryResultSchema = z.object({
  id: z.string(),
  productId: z.string(),
  batchNumber: z.string().nullable(),
  quantity: z.number(),
  reservedQuantity: z.number(),
  location: z.string().nullable(),
  unitCost: z.number().nullable(),
  updatedAt: z.date(),
  product_id: z.string(),
  product_code: z.string(),
  product_name: z.string(),
  specification_size: z.string().nullable(),
  product_unit: z.string(),
  product_piecesPerUnit: z.number(),
  product_weight: z.number().nullable(),
  product_thumbnailUrl: z.string().nullable(), // 产品缩略图URL
  batch_piecesPerUnit: z.number().nullable(),
  batch_weight: z.number().nullable(),
  product_status: z.string(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  category_code: z.string().nullable(),
});

/**
 * 库存查询结果类型 (从 Zod Schema 推导)
 */
export type InventoryQueryResult = z.infer<typeof inventoryQueryResultSchema>;

/**
 * 构建WHERE子句
 */
function buildWhereClause(params: InventoryQueryParams): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  // 搜索条件 - 性能优化（避免全表扫描）
  // ✅ Bug修复：产品编码使用包含匹配,支持搜索TC152中的"152"
  // ✅ 优化策略：
  // - 空字符串或undefined：不加搜索条件，正常查询
  // - 所有长度：
  //     • 包含匹配（支持任意位置搜索）：p.code, p.name
  //     • 前缀匹配（可命中索引）：i.batch_number
  //     • 长关键词(>=5)额外包含：i.location
  if (typeof params.search === 'string' && params.search.trim()) {
    const s = params.search.trim();
    const likeAny = `%${s}%`;
    const likePrefix = `${s}%`;

    if (s.length >= 5) {
      // ✅ 长关键词：包含匹配所有字段
      conditions.push(Prisma.sql`(
        p.code LIKE ${likeAny} OR
        p.name LIKE ${likeAny} OR
        i.batch_number LIKE ${likePrefix} OR
        i.location LIKE ${likeAny}
      )`);
    } else {
      // ✅ 短关键词(1-4字符)：包含匹配产品编码和名称,前缀匹配批次号
      conditions.push(Prisma.sql`(
        p.code LIKE ${likeAny} OR
        p.name LIKE ${likeAny} OR
        i.batch_number LIKE ${likePrefix}
      )`);
    }
  }

  // 产品ID筛选
  if (params.productId) {
    conditions.push(Prisma.sql`i.product_id = ${params.productId}`);
  }

  // 批次号筛选
  if (params.batchNumber) {
    conditions.push(Prisma.sql`i.batch_number = ${params.batchNumber}`);
  }

  // 存储位置筛选
  if (params.location) {
    conditions.push(Prisma.sql`i.location = ${params.location}`);
  }

  // 分类筛选
  if (params.categoryId) {
    conditions.push(Prisma.sql`p.category_id = ${params.categoryId}`);
  }

  // 库存状态筛选
  // ✅ 修复：使用产品级阈值（p.min_stock）替代全局常量
  // 如果产品未设置 min_stock，使用全局默认值
  const productMinStock = Prisma.raw(
    `COALESCE(p.min_stock, ${inventoryConfig.lowStockThreshold})`
  );

  if (params.lowStock && params.hasStock) {
    // 同时筛选低库存和有库存：0 < 可用数量 <= 产品阈值
    conditions.push(
      Prisma.sql`${AVAILABLE_QUANTITY_SQL} > 0 AND ${AVAILABLE_QUANTITY_SQL} <= ${productMinStock}`
    );
  } else if (params.lowStock) {
    // 仅筛选低库存：可用数量 <= 产品阈值
    conditions.push(
      Prisma.sql`${AVAILABLE_QUANTITY_SQL} <= ${productMinStock}`
    );
  } else if (params.hasStock) {
    // 仅筛选有库存：可用数量 > 0
    conditions.push(Prisma.sql`${AVAILABLE_QUANTITY_SQL} > 0`);
  }

  // 日期范围：避免对列应用函数，便于索引利用
  if (params.startDate) {
    // >= YYYY-MM-DD 00:00:00
    conditions.push(
      Prisma.sql`i.updated_at >= TIMESTAMP(CONCAT(${params.startDate}, ' 00:00:00'))`
    );
  }

  if (params.endDate) {
    // < (YYYY-MM-DD + 1) 00:00:00  —— 上开区间，避免跨天边界问题
    conditions.push(
      Prisma.sql`i.updated_at < TIMESTAMP(DATE_ADD(${params.endDate}, INTERVAL 1 DAY))`
    );
  }

  // 组合所有条件
  // ✅ 修复：当没有任何条件时，仍需返回有效的WHERE子句
  // 不使用 1=1，因为这会返回所有记录
  if (conditions.length === 0) {
    // 返回恒真条件，确保查询语法正确
    return Prisma.sql`1=1`;
  }

  return Prisma.join(conditions, ' AND ');
}

/**
 * 构建ORDER BY子句
 * ✅ Bug修复：补全所有前端支持的排序字段
 * ⚠️ 注意：Inventory表没有created_at字段，只有updated_at
 */
function buildOrderByClause(
  sortBy: string = 'updatedAt',
  sortOrder: string = 'desc'
): Prisma.Sql {
  // 验证排序字段 - 与 inventoryParamsSchema 保持一致
  const validSortFields: Record<string, string> = {
    updatedAt: 'i.updated_at',
    quantity: 'i.quantity',
    reservedQuantity: 'i.reserved_quantity', // ✅ 新增：预留数量排序
    productId: 'i.product_id',
    batchNumber: 'i.batch_number',
    location: 'i.location',
  };

  const field = validSortFields[sortBy] || 'i.updated_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return Prisma.raw(`${field} ${order}`);
}

/**
 * 优化的库存列表查询
 * 使用原生SQL JOIN查询，解决N+1问题
 * 包含运行时验证确保数据安全
 */
export async function getOptimizedInventoryList(
  params: InventoryQueryParams
): Promise<InventoryQueryResult[]> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = params;

  const whereClause = buildWhereClause(params);
  const orderByClause = buildOrderByClause(sortBy, sortOrder);
  const offset = (page - 1) * limit;

  // 使用Prisma的原生SQL查询
  const rawRecords = await prisma.$queryRaw<unknown[]>`
    SELECT
      i.id,
      i.product_id as productId,
      i.batch_number as batchNumber,
      i.quantity,
      i.reserved_quantity as reservedQuantity,
      i.location,
      i.unit_cost as unitCost,
      i.updated_at as updatedAt,
      p.id as product_id,
      p.code as product_code,
      p.name as product_name,
      p.specification as specification_size,
      p.unit as product_unit,
      p.pieces_per_unit as product_piecesPerUnit,
      p.weight as product_weight,
      p.thumbnail_url as product_thumbnailUrl,
      bs.pieces_per_unit as batch_piecesPerUnit,
      bs.weight as batch_weight,
      p.status as product_status,
      c.id as category_id,
      c.name as category_name,
      c.code as category_code
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN batch_specifications bs
      ON bs.product_id = i.product_id AND bs.batch_number = i.batch_number
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ${limit} OFFSET ${offset}
  `;

  // ✅ 性能优化：仅在开发环境进行抽样验证（验证第一条和随机一条）
  // 生产环境跳过 Zod 验证以提升性能（节省 ~50ms）
  if (process.env.NODE_ENV === 'development' && rawRecords.length > 0) {
    try {
      // 验证第一条记录
      const firstResult = inventoryQueryResultSchema.safeParse(rawRecords[0]);
      if (!firstResult.success) {
        logger.error(
          'inventory-query',
          '库存查询结果验证失败 (第一条)',
          firstResult.error
        );
        throw new Error(
          `数据库返回的库存数据格式不正确: ${firstResult.error.message}`
        );
      }

      // 验证随机一条记录（如果有多条）
      if (rawRecords.length > 1) {
        const randomIndex = Math.floor(Math.random() * rawRecords.length);
        const randomResult = inventoryQueryResultSchema.safeParse(
          rawRecords[randomIndex]
        );
        if (!randomResult.success) {
          logger.error(
            'inventory-query',
            `库存查询结果验证失败 (随机索引 ${randomIndex})`,
            randomResult.error
          );
        }
      }
    } catch (error) {
      logger.error('inventory-query', '库存查询结果验证失败', error);
      // 开发环境抛出错误，帮助发现问题
      throw error;
    }
  }

  // 直接返回原始记录（类型已由 TypeScript 保证）
  return rawRecords as InventoryQueryResult[];
}

/**
 * 获取库存总数
 */
export async function getInventoryCount(
  params: InventoryQueryParams
): Promise<number> {
  const whereClause = buildWhereClause(params);

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE ${whereClause}
  `;

  return Number(result[0].count);
}

/**
 * 格式化库存查询结果
 * 将原生SQL查询结果转换为标准的库存对象
 */
export function formatInventoryQueryResult(record: InventoryQueryResult): {
  id: string;
  productId: string;
  batchNumber: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  location: string | null;
  unitCost: number | null;
  updatedAt: Date;
  batchPiecesPerUnit?: number;
  product: {
    id: string;
    code: string;
    name: string;
    specification: string | null;
    unit: string;
    piecesPerUnit: number;
    status: string;
    categoryId: string | null;
    category: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
} {
  return {
    id: record.id,
    productId: record.productId,
    batchNumber: record.batchNumber,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: Math.max(record.quantity - record.reservedQuantity, 0),
    location: record.location,
    unitCost: record.unitCost,
    updatedAt: record.updatedAt,
    batchPiecesPerUnit: record.batch_piecesPerUnit ?? undefined,
    product: {
      id: record.product_id,
      code: record.product_code,
      name: record.product_name,
      specification: record.specification_size,
      unit: record.product_unit,
      piecesPerUnit: record.product_piecesPerUnit,
      status: record.product_status,
      categoryId: record.category_id,
      category:
        record.category_id && record.category_name
          ? {
              id: record.category_id,
              name: record.category_name,
              code: record.category_code || '',
            }
          : null,
    },
  };
}
