import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON, CACHE_STRATEGY } from '@/lib/cache';
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
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:overview', {});
    const financeOverview = await getOrSetJSON(
      cacheKey,
      async () => {
        // 获取财务概览数据(使用服务层函数)
        return await getFinanceOverview();
      },
      CACHE_STRATEGY.aggregateData.redisTTL, // 10分钟缓存
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
      async () => {
        // 获取财务统计数据(使用服务层函数)
        return await getFinanceStatistics(params);
      },
      CACHE_STRATEGY.aggregateData.redisTTL, // 10分钟缓存
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
