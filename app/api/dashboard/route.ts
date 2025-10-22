import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { dashboardQuerySchema } from '@/lib/validations/dashboard';

// 获取仪表盘主数据
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = dashboardQuerySchema.safeParse(queryParams);
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

    switch (timeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // 构建过滤条件
    const whereConditions: Prisma.SalesOrderWhereInput = {
      createdAt: {
        gte: startDate,
        lte: now,
      },
    };

    // 获取销售订单统计
    const salesOrders = await prisma.salesOrder.findMany({
      where: whereConditions,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 获取库存统计
    const inventoryStats = await prisma.inventory.aggregate({
      _count: {
        id: true,
      },
      _sum: {
        quantity: true,
      },
    });

    // 获取产品统计
    const productStats = await prisma.product.aggregate({
      _count: {
        id: true,
      },
    });

    // 获取客户统计
    const customerStats = await prisma.customer.aggregate({
      _count: {
        id: true,
      },
    });

    // 计算业务指标
    const totalRevenue = salesOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );
    const totalOrders = salesOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 构建响应数据
    const dashboardData = {
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalProducts: productStats._count.id || 0,
        totalStock: inventoryStats._sum.quantity || 0,
        totalCustomers: customerStats._count.id || 0,
      },
      timeRange,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    logger.error('dashboard', '获取仪表盘数据失败', error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取仪表盘数据失败',
      },
      { status: 500 }
    );
  }
});
