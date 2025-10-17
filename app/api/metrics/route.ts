/**
 * Prometheus 指标导出 API
 * 提供 /api/metrics endpoint 用于 Prometheus 抓取
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { exportPrometheusMetrics } from '@/lib/logger/metrics';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/metrics
 * 返回 Prometheus 格式的指标数据
 */
async function handleMetricsRequest(_request: NextRequest) {
  try {
    const metricsText = exportPrometheusMetrics();

    return new NextResponse(metricsText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('metrics', '导出 Prometheus 指标失败', error);

    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

export const GET = withRateLimit(RateLimitType.READ)(handleMetricsRequest);
