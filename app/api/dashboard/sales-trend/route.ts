import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  ChartDataPoint,
  SalesTrendData,
  TimeRange,
} from '@/lib/types/dashboard';

function resolveTimeRange(
  timeRange: TimeRange | string | null
): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const startDate = new Date(now);

  switch (timeRange) {
    case '1d':
    case 'today':
      startDate.setDate(now.getDate() - 1);
      break;
    case '7d':
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
    case 'month':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
    case 'quarter':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      // “全部”就不限制开始时间，只限制结束时间
      startDate.setFullYear(now.getFullYear() - 10);
      break;
    default:
      // 默认最近7天
      startDate.setDate(now.getDate() - 7);
      break;
  }

  return { startDate, endDate: now };
}

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const rawTimeRange = searchParams.get('timeRange') as TimeRange | null;

    const { startDate, endDate } = resolveTimeRange(rawTimeRange);

    // 直接按 createdAt 取出订单，再在应用层按“天”聚合
    const orders = await prisma.salesOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const dailyMap = new Map<string, number>();

    for (const order of orders) {
      const key = toDateKey(order.createdAt);
      const current = dailyMap.get(key) ?? 0;
      dailyMap.set(key, current + Number(order.totalAmount ?? 0));
    }

    const daily: ChartDataPoint[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, value]) => ({ date, value }));

    const emptySeries: ChartDataPoint[] = [];

    const data: SalesTrendData = {
      daily,
      weekly: emptySeries,
      monthly: emptySeries,
      yearly: emptySeries,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('dashboard', '获取销售趋势数据失败', error, {
      module: 'sales-trend',
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '获取销售趋势数据失败',
      },
      { status: 500 }
    );
  }
});
