/**
 * 年度报表 API
 * GET /api/finance/reports/annual - 获取年度财务报表
 */

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache';
import { FINANCE_CACHE_TTL_SECONDS } from '@/lib/constants/cache';
import { getAnnualReport } from '@/lib/services/annual-report-service';
import { logger } from '@/lib/utils/console-logger';
import {
  parseAnnualReportParams,
  safeValidateAnnualReportParams,
} from '@/lib/validations/report-params';

/**
 * 获取年度报表
 * GET /api/finance/reports/annual?year=2024&includeYearOverYear=true
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 解析 URL 查询参数
    const searchParams = request.nextUrl.searchParams;
    const params = parseAnnualReportParams(searchParams);

    // 验证参数
    const validationResult = safeValidateAnnualReportParams(params);

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

    const { year, includeYearOverYear } = validationResult.data;

    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:reports:annual', {
      year,
      includeYearOverYear,
    });

    const report = await getOrSetJSON(
      cacheKey,
      async () => getAnnualReport(year, includeYearOverYear),
      FINANCE_CACHE_TTL_SECONDS * 2, // 年度报表缓存时间更长
      {
        enableRandomTTL: true,
        enableNullCache: false,
      }
    );

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('annual-report-api', '获取年度报表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取年度报表失败',
      },
      { status: 500 }
    );
  }
});
