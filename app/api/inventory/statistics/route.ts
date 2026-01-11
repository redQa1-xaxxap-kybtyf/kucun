import { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { can } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/utils/number';

/**
 * 构建库存查询条件
 */
function buildInventoryWhere(categoryId?: string) {
  return categoryId
    ? {
        product: {
          categoryId,
          status: 'active' as const,
        },
      }
    : {
        product: {
          status: 'active' as const,
        },
      };
}

/**
 * 查询库存统计数据
 */
async function fetchInventoryStats(categoryId?: string) {
  const inventoryWhere = buildInventoryWhere(categoryId);

  const [inventoryStats, openingBalanceStats, lowStockProducts] =
    await Promise.all([
      // 1. 当前库存统计（数量和金额）
      prisma.inventory.aggregate({
        where: inventoryWhere,
        _count: {
          id: true,
        },
        _sum: {
          quantity: true,
        },
      }),

      // 2. 期初入库统计（期初库存金额）
      prisma.inboundRecord.aggregate({
        where: {
          reason: 'opening_balance',
          ...(categoryId && {
            product: {
              categoryId,
            },
          }),
        },
        _sum: {
          totalCost: true,
          quantity: true,
        },
        _count: {
          id: true,
        },
      }),

      // 3. 低库存产品数量
      prisma.inventory
        .groupBy({
          by: ['productId'],
          where: inventoryWhere,
          _sum: {
            quantity: true,
            reservedQuantity: true,
          },
          having: {
            quantity: {
              _sum: {
                lte: 10, // 这里可以改为动态阈值
              },
            },
          },
        })
        .then(items => items.length),
    ]);

  return {
    inventoryStats,
    openingBalanceStats,
    lowStockProducts,
  };
}

/**
 * 计算库存总金额
 */
async function calculateTotalInventoryValue(categoryId?: string) {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'active'`];

  if (categoryId) {
    conditions.push(Prisma.sql`p.category_id = ${categoryId}`);
  }

  const row =
    (
      await prisma.$queryRaw<Array<{ totalValue: unknown }>>(
        Prisma.sql`
          SELECT
            COALESCE(SUM(i.quantity * COALESCE(i.unit_cost, 0)), 0) AS totalValue
          FROM inventory i
          INNER JOIN products p ON p.id = i.product_id
          WHERE ${Prisma.join(conditions, ' AND ')}
        `
      )
    )[0] ?? null;

  const totalValue = toNumber(row?.totalValue, 0);

  return Math.round(totalValue * 100) / 100; // 保留2位小数
}

/**
 * GET /api/inventory/statistics - 获取库存统计数据
 *
 * 功能：
 * - 库存总金额（所有库存的总价值）- 需要 finance:view 权限
 * - 期初库存金额（opening_balance 入库的总金额）- 需要 finance:view 权限
 * - 当前库存数量统计
 * - 低库存产品数量
 *
 * 权限：
 * - 基础权限：inventory:view（查看库存统计）
 * - 财务权限：finance:view（查看成本相关数据）
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      const categoryId = searchParams.get('categoryId') || undefined;

      // 查询统计数据
      const { inventoryStats, openingBalanceStats, lowStockProducts } =
        await fetchInventoryStats(categoryId);

      // 检查用户是否有财务查看权限
      const hasFinancePermission = can(user, 'finance:view');

      // 基础统计数据（所有用户可见）
      const statistics: {
        totalProducts: number;
        totalQuantity: number;
        totalValue?: number;
        openingBalance?: {
          totalCost: number;
          totalQuantity: number;
          recordCount: number;
        };
        lowStockCount: number;
        stockHealthPercentage: number;
      } = {
        // 库存总览
        totalProducts: inventoryStats._count.id || 0,
        totalQuantity: inventoryStats._sum.quantity || 0,

        // 库存健康度
        lowStockCount: lowStockProducts,
        stockHealthPercentage:
          inventoryStats._count.id > 0
            ? Math.round(
                ((inventoryStats._count.id - lowStockProducts) /
                  inventoryStats._count.id) *
                  100
              )
            : 100,
      };

      // 仅当用户拥有 finance:view 权限时，才计算并返回财务相关数据
      if (hasFinancePermission) {
        const totalInventoryValue =
          await calculateTotalInventoryValue(categoryId);

        statistics.totalValue = totalInventoryValue;
        statistics.openingBalance = {
          totalCost: toNumber(openingBalanceStats._sum.totalCost, 0),
          totalQuantity: openingBalanceStats._sum.quantity || 0,
          recordCount: openingBalanceStats._count.id || 0,
        };
      }

      return NextResponse.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('获取库存统计失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: '获取库存统计失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['inventory:view'] }
);
