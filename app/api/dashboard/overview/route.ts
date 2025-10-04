import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import {
  buildCacheKey,
  getOrSetWithLock,
  CacheTags,
  CACHE_STRATEGY,
} from '@/lib/cache';
import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';

// 请求参数验证
const overviewQuerySchema = z.object({
  timeRange: z.enum(['1d', '7d', '30d', '90d', '1y']).default('30d'),
});

// 获取业务概览数据
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = overviewQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { timeRange } = validationResult.data;

    // 使用缓存键构建
    const cacheKey = buildCacheKey('dashboard:overview', { timeRange });

    // 使用分布式锁防止缓存击穿（这是热点数据）
    const businessOverview = await getOrSetWithLock(
      cacheKey,
      async () => {
        // 计算时间范围
        const now = new Date();
        const startDate = new Date();
        const previousStartDate = new Date();

        switch (timeRange) {
          case '1d':
            startDate.setDate(now.getDate() - 1);
            previousStartDate.setDate(now.getDate() - 2);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            previousStartDate.setDate(now.getDate() - 14);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            previousStartDate.setDate(now.getDate() - 60);
            break;
          case '90d':
            startDate.setDate(now.getDate() - 90);
            previousStartDate.setDate(now.getDate() - 180);
            break;
          case '1y':
            startDate.setFullYear(now.getFullYear() - 1);
            previousStartDate.setFullYear(now.getFullYear() - 2);
            break;
        }

        // 并行查询所有数据，优化性能
        const [
          currentSalesOrders,
          previousSalesOrders,
          inventoryStats,
          productCount,
          lowStockProducts,
          outOfStockProducts,
          totalCustomers,
          activeCustomers,
          currentNewCustomers,
          previousNewCustomers,
          currentNewProducts,
          previousNewProducts,
          totalReturns,
          monthlyReturns,
          pendingReturns,
        ] = await Promise.all([
          // 当前期间销售数据
          prisma.salesOrder.findMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: now,
              },
            },
            include: {
              items: true,
            },
          }),
          // 上一期间销售数据
          prisma.salesOrder.findMany({
            where: {
              createdAt: {
                gte: previousStartDate,
                lt: startDate,
              },
            },
            include: {
              items: true,
            },
          }),
          // 库存统计
          prisma.inventory.aggregate({
            _count: { id: true },
            _sum: { quantity: true },
          }),
          // 产品总数
          prisma.product.count(),
          // 低库存产品
          prisma.inventory.count({
            where: {
              quantity: {
                lte: inventoryConfig.defaultMinQuantity,
              },
            },
          }),
          // 缺货产品
          prisma.inventory.count({
            where: {
              quantity: 0,
            },
          }),
          // 客户总数
          prisma.customer.count(),
          // 活跃客户
          prisma.customer.count({
            where: {
              salesOrders: {
                some: {
                  createdAt: {
                    gte: startDate,
                  },
                },
              },
            },
          }),
          // 当前期间新增客户
          prisma.customer.count({
            where: {
              createdAt: {
                gte: startDate,
              },
            },
          }),
          // 上一期间新增客户
          prisma.customer.count({
            where: {
              createdAt: {
                gte: previousStartDate,
                lt: startDate,
              },
            },
          }),
          // 当前期间新增产品
          prisma.product.count({
            where: {
              createdAt: {
                gte: startDate,
              },
            },
          }),
          // 上一期间新增产品
          prisma.product.count({
            where: {
              createdAt: {
                gte: previousStartDate,
                lt: startDate,
              },
            },
          }),
          // 退货总数
          prisma.returnOrder.count(),
          // 本月退货
          prisma.returnOrder.count({
            where: {
              createdAt: {
                gte: startDate,
              },
            },
          }),
          // 待处理退货
          prisma.returnOrder.count({
            where: {
              status: 'PENDING',
            },
          }),
        ]);

        // 计算销售指标
        const currentRevenue = currentSalesOrders.reduce(
          (sum, order) => sum + (order.totalAmount || 0),
          0
        );
        const previousRevenue = previousSalesOrders.reduce(
          (sum, order) => sum + (order.totalAmount || 0),
          0
        );
        const revenueGrowth =
          previousRevenue > 0
            ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
            : 0;

        const currentOrders = currentSalesOrders.length;
        const previousOrders = previousSalesOrders.length;
        const ordersGrowth =
          previousOrders > 0
            ? ((currentOrders - previousOrders) / previousOrders) * 100
            : 0;

        const averageOrderValue =
          currentOrders > 0 ? currentRevenue / currentOrders : 0;

        // 计算客户增长率
        const customerGrowth =
          previousNewCustomers > 0
            ? ((currentNewCustomers - previousNewCustomers) /
                previousNewCustomers) *
              100
            : currentNewCustomers > 0
              ? 100
              : 0;

        // 计算产品增长率
        const productGrowth =
          previousNewProducts > 0
            ? ((currentNewProducts - previousNewProducts) /
                previousNewProducts) *
              100
            : currentNewProducts > 0
              ? 100
              : 0;

        // 构建业务概览数据
        return {
          sales: {
            totalRevenue: currentRevenue,
            monthlyRevenue: currentRevenue,
            totalOrders: currentOrders,
            monthlyOrders: currentOrders,
            averageOrderValue,
            revenueGrowth,
            ordersGrowth,
          },
          inventory: {
            totalProducts: productCount,
            totalStock: inventoryStats._sum.quantity || 0,
            lowStockCount: lowStockProducts,
            outOfStockCount: outOfStockProducts,
            inventoryValue: 0,
            turnoverRate: 0,
            stockHealth: Math.max(
              0,
              100 - (lowStockProducts + outOfStockProducts * 2) * 10
            ),
            productGrowth,
          },
          returns: {
            totalReturns,
            monthlyReturns,
            returnRate: 0,
            returnValue: 0,
            pendingReturns,
          },
          customers: {
            totalCustomers,
            activeCustomers,
            newCustomers: currentNewCustomers,
            customerGrowth,
          },
        };
      },
      CACHE_STRATEGY.aggregateData.redisTTL, // 统计数据缓存 10 分钟
      {
        lockTTL: 15, // 锁 15 秒（查询可能较慢）
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: false, // 统计数据不缓存 null
      }
    );

    return NextResponse.json({
      success: true,
      data: businessOverview,
      _cached: true, // 标识数据来自缓存
      _cacheKey: cacheKey,
    });
  } catch (error) {
    console.error('获取业务概览失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取业务概览失败',
      },
      { status: 500 }
    );
  }
});
