/**
 * 月度报表 API
 * GET /api/finance/reports/monthly - 获取月度财务报表
 */

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache';
import { FINANCE_CACHE_TTL_SECONDS } from '@/lib/constants/cache';
import { getMonthlyReport } from '@/lib/services/monthly-report-service';
import { logger } from '@/lib/utils/console-logger';
import {
  parseMonthlyReportParams,
  safeValidateMonthlyReportParams,
} from '@/lib/validations/report-params';

/**
 * 获取月度报表
 * GET /api/finance/reports/monthly?year=2024&month=1&includeComparison=true
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 解析 URL 查询参数
    const searchParams = request.nextUrl.searchParams;
    const params = parseMonthlyReportParams(searchParams);

    // 验证参数
    const validationResult = safeValidateMonthlyReportParams(params);

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

    const { year, month, includeComparison } = validationResult.data;

    // 使用缓存包装查询
    const cacheKey = buildCacheKey('finance:reports:monthly', {
      year,
      month,
      includeComparison,
    });

    const report = await getOrSetJSON(
      cacheKey,
      async () => getMonthlyReport(year, month, includeComparison),
      FINANCE_CACHE_TTL_SECONDS,
      {
        enableRandomTTL: true,
        enableNullCache: false, // 报表数据不缓存空值
      }
    );

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('monthly-report-api', '获取月度报表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取月度报表失败',
      },
      { status: 500 }
    );
  }
});
