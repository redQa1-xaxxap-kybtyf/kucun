/**
 * 盈亏分析 API
 * GET /api/finance/reports/profit-loss - 获取盈亏分析报表
 */

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache';
import { FINANCE_CACHE_TTL_SECONDS } from '@/lib/constants/cache';
import { getProfitLossAnalysis } from '@/lib/services/profit-loss-service';
import { logger } from '@/lib/utils/console-logger';
import {
  parseProfitLossParams,
  safeValidateProfitLossParams,
} from '@/lib/validations/report-params';

/**
 * 获取盈亏分析
 * GET /api/finance/reports/profit-loss?startDate=2024-01-01&endDate=2024-01-31&groupBy=day&includeComparison=false
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 解析 URL 查询参数
    const searchParams = request.nextUrl.searchParams;
    const params = parseProfitLossParams(searchParams);

    // 验证参数
    const validationResult = safeValidateProfitLossParams(params);

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

    const { startDate, endDate, groupBy, includeComparison } =
      validationResult.data;

    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:reports:profit-loss', {
      startDate,
      endDate,
      groupBy,
      includeComparison,
    });

    const analysis = await getOrSetJSON(
      cacheKey,
      async () =>
        getProfitLossAnalysis(startDate, endDate, groupBy, includeComparison),
      FINANCE_CACHE_TTL_SECONDS,
      {
        enableRandomTTL: true,
        enableNullCache: false,
      }
    );

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('profit-loss-api', '获取盈亏分析失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取盈亏分析失败',
      },
      { status: 500 }
    );
  }
});
