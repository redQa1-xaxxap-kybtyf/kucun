/**
 * 库存查询构建器
 * 提供优化的库存查询方法，解决N+1查询问题
 * 遵循全栈项目统一约定规范
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { InventoryQueryParams } from '@/lib/types/inventory';

/**
 * 库存查询结果类型
 */
export interface InventoryQueryResult {
  id: string;
  productId: string;
  batchNumber: string | null;
  quantity: number;
  reservedQuantity: number;
  location: string | null;
  unitCost: number | null;
  updatedAt: Date;
  product_id: string;
  product_code: string;
  product_name: string;
  specification_size: string | null;
  product_unit: string;
  product_piecesPerUnit: number;
  product_status: string;
  category_id: string | null;
  category_name: string | null;
  category_code: string | null;
}

/**
 * 构建WHERE子句
 */
function buildWhereClause(params: InventoryQueryParams): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  // 搜索条件 - 优化为使用索引的查询
  // code 使用前缀匹配可以利用索引
  // name 使用全文搜索但保留备选方案
  if (params.search) {
    conditions.push(Prisma.sql`(
      p.code LIKE ${`${params.search}%`} OR
      p.name LIKE ${`%${params.search}%`} OR
      i.batch_number = ${params.search} OR
      i.location LIKE ${`${params.search}%`}
    )`);
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
  if (params.lowStock && params.hasStock) {
    // 同时筛选低库存和有库存：0 < 数量 <= 10
    conditions.push(Prisma.sql`i.quantity > 0 AND i.quantity <= 10`);
  } else if (params.lowStock) {
    // 仅筛选低库存：数量 <= 10
    conditions.push(Prisma.sql`i.quantity <= 10`);
  } else if (params.hasStock) {
    // 仅筛选有库存：数量 > 0
    conditions.push(Prisma.sql`i.quantity > 0`);
  }

  // 组合所有条件
  if (conditions.length === 0) {
    return Prisma.sql`1=1`;
  }

  return Prisma.join(conditions, ' AND ');
}

/**
 * 构建ORDER BY子句
 */
function buildOrderByClause(
  sortBy: string = 'updatedAt',
  sortOrder: string = 'desc'
): Prisma.Sql {
  // 验证排序字段
  const validSortFields: Record<string, string> = {
    updatedAt: 'i.updated_at',
    quantity: 'i.quantity',
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

  // 使用Prisma的原生SQL查询，保持类型安全
  const inventoryRecords = await prisma.$queryRaw<InventoryQueryResult[]>`
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
      p.status as product_status,
      c.id as category_id,
      c.name as category_name,
      c.code as category_code
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ${limit} OFFSET ${offset}
  `;

  return inventoryRecords;
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
    availableQuantity: record.quantity - record.reservedQuantity,
    location: record.location,
    unitCost: record.unitCost,
    updatedAt: record.updatedAt,
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
