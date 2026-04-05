import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { formatInventoryRecord } from '@/lib/api/inventory-formatter';
import type { InventoryQueryResult } from '@/lib/api/inventory-query-builder';
import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

/**
 * 获取单条库存记录详情
 * 路由：GET /api/inventory/:id
 * 返回格式与库存列表中的单条记录一致（FormattedInventory）
 */
const getInventoryDetailHandler = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);

    // 复用列表查询的字段映射，按 ID 精确查询一条记录
    const records = await prisma.$queryRaw<InventoryQueryResult[]>`
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
        COALESCE(bs_variant.pieces_per_unit, bs_default.pieces_per_unit) as batch_piecesPerUnit,
        COALESCE(bs_variant.weight, bs_default.weight) as batch_weight,
        p.status as product_status,
        c.id as category_id,
        c.name as category_name,
        c.code as category_code
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN batch_specifications bs_variant
        ON bs_variant.product_id = i.product_id
        AND bs_variant.variant_key = COALESCE(i.variant_id, '')
        AND bs_variant.batch_number = i.batch_number
      LEFT JOIN batch_specifications bs_default
        ON bs_default.product_id = i.product_id
        AND bs_default.variant_key = ''
        AND bs_default.batch_number = i.batch_number
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE i.id = ${id}
      LIMIT 1
    `;

    if (!records || records.length === 0) {
      throw ApiError.notFound('库存记录');
    }

    const formatted = formatInventoryRecord(records[0]);

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  },
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getInventoryDetailHandler);
