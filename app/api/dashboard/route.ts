import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 请求参数验证
const dashboardQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  productCategory: z.string().optional(),
  customerType: z.string().optional(),
  salesChannel: z.string().optional(),
  region: z.string().optional(),
});

// 获取仪表盘主数据
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

    const validationResult = dashboardQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      timeRange,
      productCategory: _productCategory,
      customerType: _customerType,
      salesChannel: _salesChannel,
      region: _region,
    } = validationResult.data;

    // 计算时间范围
    const now = new Date();
    const startDate = new Date();

    switch (timeRange) {
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
    console.error('获取仪表盘数据失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取仪表盘数据失败',
      },
      { status: 500 }
    );
  }
}
