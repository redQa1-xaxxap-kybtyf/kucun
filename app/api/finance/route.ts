import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache';
import { FINANCE_CACHE_TTL_SECONDS } from '@/lib/constants/cache';
import {
  getFinanceOverview,
  getFinanceStatistics,
} from '@/lib/services/finance-statistics';
import { logger } from '@/lib/utils/console-logger';
import { financeStatisticsQuerySchema } from '@/lib/validations/finance';

/**
 * 财务管理概览API
 * GET /api/finance - 获取财务管理概览数据
 */
export const GET = withAuth(async () => {
  try {
    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:overview', {});
    const financeOverview = await getOrSetJSON(
      cacheKey,
      async () => getFinanceOverview(), // 获取财务概览数据(使用服务层函数)
      FINANCE_CACHE_TTL_SECONDS, // 缩短TTL，确保概览数据靠近实时
      {
        enableRandomTTL: true,
        enableNullCache: true,
      }
    );

    return NextResponse.json({
      success: true,
      data: financeOverview,
    });
  } catch (error) {
    logger.error('finance-api', '获取财务概览失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务概览失败',
      },
      { status: 500 }
    );
  }
});

/**
 * 财务数据统计API
 * POST /api/finance - 获取指定条件的财务统计数据
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    // 解析并验证请求参数
    const body = await request.json();
    const validationResult = financeStatisticsQuerySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '参数验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;

    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:statistics', params);
    const statisticsData = await getOrSetJSON(
      cacheKey,
      async () => getFinanceStatistics(params), // 获取财务统计数据(使用服务层函数)
      FINANCE_CACHE_TTL_SECONDS, // 缩短TTL，保持统计数据新鲜
      {
        enableRandomTTL: true,
        enableNullCache: true,
      }
    );

    return NextResponse.json({
      success: true,
      data: statisticsData,
    });
  } catch (error) {
    logger.error('finance-api', '获取财务统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务统计失败',
      },
      { status: 500 }
    );
  }
});
