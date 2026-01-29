import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  ChartDataPoint,
  SalesTrendData,
  TimeRange,
} from '@/lib/types/dashboard';

function resolveTimeRange(timeRange: TimeRange | string | null): {
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

    // ✅ 按“天”在数据库侧聚合，避免把整段时间范围内的订单拉回应用层
    const rows = await prisma.$queryRaw<
      Array<{ date: Date | string; totalAmount: unknown }>
    >`
      SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as totalAmount
      FROM sales_orders
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const daily: ChartDataPoint[] = rows.map(row => {
      const date =
        row.date instanceof Date
          ? toDateKey(row.date)
          : String(row.date).slice(0, 10);

      return { date, value: Number(row.totalAmount ?? 0) };
    });

    const data: SalesTrendData = {
      daily,
      // 当前版本前端只使用 weekly/monthly/yearly 三个维度展示折线图，
      // 这里先复用按日聚合的数据，避免图表为空。
      // 后续如需更精细的按周/月/年聚合，可在此基础上继续扩展。
      weekly: daily,
      monthly: daily,
      yearly: daily,
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
        error: error instanceof Error ? error.message : '获取销售趋势数据失败',
      },
      { status: 500 }
    );
  }
});
