import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/auth/api-helpers';
import {
  buildCacheKey,
  getOrSetWithLock,
  CacheTags,
  CACHE_STRATEGY,
} from '@/lib/cache';
import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';

// 获取库存预警数据
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 使用缓存键构建
    const cacheKey = buildCacheKey('dashboard:alerts', {});

    // 使用分布式锁防止缓存击穿
    const alerts = await getOrSetWithLock(
      cacheKey,
      async () => {
        // 获取库存数据，包含产品信息
        const inventoryData = await prisma.inventory.findMany({
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
              },
            },
          },
          where: {
            product: {
              status: 'active',
            },
          },
          orderBy: {
            quantity: 'asc',
          },
        });

        // 生成库存预警
        return inventoryData
          .map(inventory => {
            const safetyStock = inventoryConfig.defaultMinQuantity; // 使用环境配置的安全库存
            const currentStock = inventory.quantity;

            let alertLevel: 'warning' | 'danger' | 'critical';
            let alertType:
              | 'low_stock'
              | 'out_of_stock'
              | 'overstock'
              | 'expired';
            let suggestedAction: string;

            if (currentStock === 0) {
              alertLevel = 'critical';
              alertType = 'out_of_stock';
              suggestedAction = '立即补货';
            } else if (currentStock <= inventoryConfig.criticalMinQuantity) {
              alertLevel = 'danger';
              alertType = 'low_stock';
              suggestedAction = '紧急补货';
            } else if (currentStock <= safetyStock) {
              alertLevel = 'warning';
              alertType = 'low_stock';
              suggestedAction = '计划补货';
            } else {
              return null; // 库存正常，不需要预警
            }

            // 计算预计缺货天数（使用环境配置的平均日销量）
            const averageDailySales = inventoryConfig.averageDailySales;
            const daysUntilStockout =
              currentStock > 0
                ? Math.floor(currentStock / averageDailySales)
                : 0;

            return {
              id: `alert-${inventory.id}`,
              productId: inventory.productId,
              productName: inventory.product.name,
              productCode: inventory.product.code,

              currentStock,
              safetyStock,
              alertLevel,
              alertType,
              lastUpdated: inventory.updatedAt.toISOString(),
              daysUntilStockout:
                daysUntilStockout > 0 ? daysUntilStockout : undefined,
              suggestedAction,
            };
          })
          .filter(Boolean) // 过滤掉null值
          .slice(0, inventoryConfig.alertLimit); // 使用环境配置的限制数量
      },
      CACHE_STRATEGY.aggregateData.redisTTL, // 统计数据缓存 10 分钟（与overview一致）
      {
        lockTTL: 10, // 锁 10 秒
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: false, // 预警数据不缓存 null
      }
    );

    return NextResponse.json({
      success: true,
      data: alerts,
      _cached: true, // 标识数据来自缓存
      _cacheKey: cacheKey,
    });
  } catch (error) {
    logger.error('dashboard', '获取库存预警失败', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存预警失败',
      },
      { status: 500 }
    );
  }
});
