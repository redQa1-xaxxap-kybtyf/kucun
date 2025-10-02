import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';

// 请求参数验证
const overviewQuerySchema = z.object({
  timeRange: z.enum(['1d', '7d', '30d', '90d', '1y']).default('30d'),
});

// 获取业务概览数据
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

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

    // 获取当前期间销售数据
    const currentSalesOrders = await prisma.salesOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: now,
        },
      },
      include: {
        items: true,
      },
    });

    // 获取上一期间销售数据（用于计算增长率）
    const previousSalesOrders = await prisma.salesOrder.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
      include: {
        items: true,
      },
    });

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

    // 获取库存数据
    const inventoryStats = await prisma.inventory.aggregate({
      _count: { id: true },
      _sum: { quantity: true },
    });

    const productCount = await prisma.product.count();

    // 计算库存预警
    const lowStockProducts = await prisma.inventory.count({
      where: {
        quantity: {
          lte: inventoryConfig.defaultMinQuantity,
        },
      },
    });

    const outOfStockProducts = await prisma.inventory.count({
      where: {
        quantity: 0,
      },
    });

    // 获取客户数据
    const totalCustomers = await prisma.customer.count();
    const activeCustomers = await prisma.customer.count({
      where: {
        salesOrders: {
          some: {
            createdAt: {
              gte: startDate,
            },
          },
        },
      },
    });

    const newCustomers = await prisma.customer.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // 计算当前时间段内新增的客户数
    const currentNewCustomers = await prisma.customer.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // 计算上一时间段内新增的客户数
    const previousNewCustomers = await prisma.customer.count({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    // 计算客户增长率（基于新增客户数）
    const customerGrowth =
      previousNewCustomers > 0
        ? ((currentNewCustomers - previousNewCustomers) /
            previousNewCustomers) *
          100
        : currentNewCustomers > 0
          ? 100
          : 0;

    // 计算当前时间段内新增的产品数
    const currentNewProducts = await prisma.product.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // 计算上一时间段内新增的产品数
    const previousNewProducts = await prisma.product.count({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    // 计算产品增长率（基于新增产品数）
    const productGrowth =
      previousNewProducts > 0
        ? ((currentNewProducts - previousNewProducts) / previousNewProducts) *
          100
        : currentNewProducts > 0
          ? 100
          : 0;

    // 构建业务概览数据
    const businessOverview = {
      sales: {
        totalRevenue: currentRevenue,
        monthlyRevenue: currentRevenue, // 简化处理
        totalOrders: currentOrders,
        monthlyOrders: currentOrders, // 简化处理
        averageOrderValue,
        revenueGrowth,
        ordersGrowth,
      },
      inventory: {
        totalProducts: productCount,
        totalStock: inventoryStats._sum.quantity || 0,
        lowStockCount: lowStockProducts,
        outOfStockCount: outOfStockProducts,
        inventoryValue: 0, // 需要产品价格数据
        turnoverRate: 0, // 需要更复杂的计算
        stockHealth: Math.max(
          0,
          100 - (lowStockProducts + outOfStockProducts * 2) * 10
        ),
        productGrowth, // 添加产品增长率
      },

      returns: {
        totalReturns: await prisma.returnOrder.count(),
        monthlyReturns: await prisma.returnOrder.count({
          where: {
            createdAt: {
              gte: startDate,
            },
          },
        }),
        returnRate: 0, // 需要更复杂的计算
        returnValue: 0, // 需要退货金额数据
        pendingReturns: await prisma.returnOrder.count({
          where: {
            status: 'PENDING',
          },
        }),
      },
      customers: {
        totalCustomers,
        activeCustomers,
        newCustomers,
        customerGrowth, // 使用计算的增长率
      },
    };

    return NextResponse.json({
      success: true,
      data: businessOverview,
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
}
