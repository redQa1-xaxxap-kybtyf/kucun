import { NextResponse, type NextRequest } from 'next/server';

import { getProductRanking } from '@/lib/api/handlers/dashboard';
import { withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import type { TimeRange } from '@/lib/types/dashboard';

/**
 * 获取产品销售排名
 * GET /api/dashboard/product-ranking?timeRange=7d&limit=10
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '7d';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 验证参数
    const validTimeRanges: TimeRange[] = [
      '1d',
      '7d',
      '30d',
      '90d',
      '1y',
      'all',
    ];
    if (!validTimeRanges.includes(timeRange)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的时间范围参数',
        },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: '限制数量必须在1-100之间',
        },
        { status: 400 }
      );
    }

    // 获取产品排名数据
    const rankingData = await getProductRanking(timeRange, limit);

    return NextResponse.json({
      success: true,
      data: rankingData,
      meta: {
        timeRange,
        limit,
        warehouseCount: rankingData.warehouse.length,
        factoryCount: rankingData.factory.length,
      },
    });
  } catch (error) {
    logger.error('dashboard', '获取产品排名失败', error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品排名失败',
      },
      { status: 500 }
    );
  }
});
