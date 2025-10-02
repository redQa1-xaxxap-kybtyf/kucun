import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig, env, inventoryConfig } from '@/lib/env';

/**
 * 库存预警API
 * GET /api/inventory/alerts
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限 (开发环境下临时绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') || 'all'; // all, critical, warning, info
    const limit = parseInt(searchParams.get('limit') || '50');

    // 构建缓存键
    const cacheKey = buildCacheKey('inventory:alerts', {
      severity,
      limit,
    });

    // 从缓存获取或生成数据
    const alerts = await getOrSetJSON(
      cacheKey,
      async () => {
        // 获取低库存产品
        const lowStockProducts = await prisma.product.findMany({
          where: {
            status: 'active',
            inventory: {
              some: {
                quantity: {
                  lte: inventoryConfig.lowStockThreshold,
                },
              },
            },
          },
          include: {
            inventory: {
              select: {
                id: true,
                quantity: true,
                reservedQuantity: true,
                batchNumber: true,
                variantId: true, // 修复：使用正确的字段名
                location: true,
              },
            },
            category: {
              select: {
                name: true,
              },
            },
          },
          take: limit,
          orderBy: {
            updatedAt: 'desc',
          },
        });

        // 获取零库存产品
        const zeroStockProducts = await prisma.product.findMany({
          where: {
            status: 'active',
            inventory: {
              none: {},
            },
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
          take: Math.floor(limit / 2),
          orderBy: {
            updatedAt: 'desc',
          },
        });

        // 暂时移除过期库存查询，因为当前数据库schema中没有productionDate字段
        // 获取过期库存（如果有生产日期）
        // const expiredInventory = await prisma.inventory.findMany({
        //   where: {
        //     productionDate: {
        //       lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90天前
        //     },
        //     quantity: {
        //       gt: 0,
        //     },
        //   },
        //   include: {
        //     product: {
        //       select: {
        //         id: true,
        //         name: true,
        //         code: true,
        //       },
        //     },
        //   },
        //   take: Math.floor(limit / 4),
        //   orderBy: {
        //     productionDate: 'asc',
        //   },
        // });
        const expiredInventory: any[] = []; // 临时空数组

        const alertList = [];

        // 处理低库存警告
        for (const product of lowStockProducts) {
          const totalStock = product.inventory.reduce(
            (sum, inv) => sum + inv.quantity,
            0
          );
          const reservedStock = product.inventory.reduce(
            (sum, inv) => sum + inv.reservedQuantity,
            0
          );
          const availableStock = totalStock - reservedStock;

          let severity: 'critical' | 'warning' | 'info' = 'warning';
          if (availableStock <= inventoryConfig.criticalStockThreshold) {
            severity = 'critical';
          } else if (availableStock <= inventoryConfig.lowStockThreshold) {
            severity = 'warning';
          }

          alertList.push({
            id: `low-stock-${product.id}`,
            type: 'low_stock',
            severity,
            title: '库存不足',
            message: `产品 ${product.name} (${product.code}) 库存不足`,
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            categoryName: product.category?.name || '未分类',
            currentStock: totalStock,
            availableStock,
            reservedStock,
            threshold: inventoryConfig.lowStockThreshold,
            createdAt: new Date(),
            metadata: {
              inventoryDetails: product.inventory.map(inv => ({
                id: inv.id,
                quantity: inv.quantity,
                reservedQuantity: inv.reservedQuantity,
                batchNumber: inv.batchNumber,
                variantId: inv.variantId, // 修复：使用正确的字段名
                location: inv.location,
              })),
            },
          });
        }

        // 处理零库存警告
        for (const product of zeroStockProducts) {
          alertList.push({
            id: `zero-stock-${product.id}`,
            type: 'zero_stock',
            severity: 'critical' as const,
            title: '零库存',
            message: `产品 ${product.name} (${product.code}) 已无库存`,
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            categoryName: product.category?.name || '未分类',
            currentStock: 0,
            availableStock: 0,
            reservedStock: 0,
            threshold: 0,
            createdAt: new Date(),
            metadata: {},
          });
        }

        // 处理过期库存警告
        for (const inventory of expiredInventory) {
          alertList.push({
            id: `expired-${inventory.id}`,
            type: 'expired_stock',
            severity: 'warning' as const,
            title: '库存过期',
            message: `产品 ${inventory.product.name} 的库存已过期`,
            productId: inventory.productId,
            productName: inventory.product.name,
            productCode: inventory.product.code,
            categoryName: '',
            currentStock: inventory.quantity,
            availableStock: inventory.quantity - inventory.reservedQuantity,
            reservedStock: inventory.reservedQuantity,
            threshold: 0,
            createdAt: new Date(),
            metadata: {
              inventoryId: inventory.id,
              batchNumber: inventory.batchNumber,
              variantId: inventory.variantId, // 修复：使用正确的字段名
              location: inventory.location,
            },
          });
        }

        // 按严重程度和时间排序
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        alertList.sort((a, b) => {
          const severityDiff =
            severityOrder[a.severity] - severityOrder[b.severity];
          if (severityDiff !== 0) {return severityDiff;}
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        // 根据严重程度过滤
        if (severity !== 'all') {
          return alertList.filter(alert => alert.severity === severity);
        }

        return alertList;
      },
      cacheConfig.inventoryTtl // 使用库存缓存TTL
    );

    const alertsData = alerts || [];

    return NextResponse.json({
      success: true,
      data: alertsData,
      total: alertsData.length,
      summary: {
        critical: alertsData.filter(a => a.severity === 'critical').length,
        warning: alertsData.filter(a => a.severity === 'warning').length,
        info: alertsData.filter(
          a => a.severity === 'warning' || a.severity === 'critical'
        ).length,
      },
    });
  } catch (error) {
    console.error('获取库存预警失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存预警失败',
      },
      { status: 500 }
    );
  }
}
