// 销售趋势数据API
// 提供销售趋势分析数据

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  salesTrendQuerySchema,
  apiResponseSchema,
} from '@/lib/validations/dashboard';

// 获取销售趋势数据
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

    const validationResult = salesTrendQuerySchema.safeParse(queryParams);
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

    const { timeRange, productCategory, customerType } = validationResult.data;

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

    // 构建查询条件
    const whereConditions: any = {
      createdAt: {
        gte: startDate,
        lte: now,
      },
      status: {
        in: ['confirmed', 'shipped', 'delivered'],
      },
    };

    // 添加产品分类过滤
    if (productCategory) {
      whereConditions.items = {
        some: {
          product: {
            category: {
              name: productCategory,
            },
          },
        },
      };
    }

    // 添加客户类型过滤（简化处理）
    if (customerType) {
      // 这里可以根据实际业务逻辑添加客户类型过滤
      // 例如：根据客户名称、地址等字段进行分类
    }

    // 获取销售订单数据
    const salesOrders = await prisma.salesOrder.findMany({
      where: whereConditions,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        customer: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 根据时间范围生成趋势数据
    const generateTrendData = (orders: typeof salesOrders, interval: 'hour' | 'day' | 'week' | 'month') => {
      const dataMap = new Map<string, { sales: number; orders: number; quantity: number }>();

      orders.forEach(order => {
        let dateKey: string;
        const orderDate = new Date(order.createdAt);

        switch (interval) {
          case 'hour':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')} ${String(orderDate.getHours()).padStart(2, '0')}:00`;
            break;
          case 'day':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
            break;
          case 'week':
            const weekStart = new Date(orderDate);
            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
            dateKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
            break;
          case 'month':
            dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            break;
        }

        const existing = dataMap.get(dateKey) || { sales: 0, orders: 0, quantity: 0 };
        existing.sales += order.totalAmount || 0;
        existing.orders += 1;
        existing.quantity += order.items.reduce((sum, item) => sum + item.quantity, 0);
        dataMap.set(dateKey, existing);
      });

      return Array.from(dataMap.entries())
        .map(([date, data]) => ({
          date,
          value: data.sales,
          label: `¥${data.sales.toFixed(2)}`,
          category: 'sales',
          orders: data.orders,
          quantity: data.quantity,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    };

    // 根据时间范围选择合适的间隔
    let interval: 'hour' | 'day' | 'week' | 'month';
    switch (timeRange) {
      case '1d':
        interval = 'hour';
        break;
      case '7d':
        interval = 'day';
        break;
      case '30d':
        interval = 'day';
        break;
      case '90d':
        interval = 'week';
        break;
      case '1y':
        interval = 'month';
        break;
      default:
        interval = 'day';
    }

    // 生成趋势数据
    const trendData = generateTrendData(salesOrders, interval);

    // 计算汇总统计
    const totalSales = salesOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = salesOrders.length;
    const totalQuantity = salesOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // 计算增长率（与上一个周期比较）
    const previousStartDate = new Date(startDate);
    const periodDuration = now.getTime() - startDate.getTime();
    previousStartDate.setTime(startDate.getTime() - periodDuration);

    const previousOrders = await prisma.salesOrder.findMany({
      where: {
        ...whereConditions,
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    const previousSales = previousOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const salesGrowth = previousSales > 0 ? ((totalSales - previousSales) / previousSales) * 100 : 0;
    const ordersGrowth = previousOrders.length > 0 ? ((totalOrders - previousOrders.length) / previousOrders.length) * 100 : 0;

    // 构建响应数据
    const responseData = {
      timeRange,
      interval,
      data: trendData,
      summary: {
        totalSales,
        totalOrders,
        totalQuantity,
        averageOrderValue,
        salesGrowth,
        ordersGrowth,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },
      filters: {
        productCategory,
        customerType,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取销售趋势数据失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取销售趋势数据失败',
      },
      { status: 500 }
    );
  }
}
