/**
 * Prometheus 指标导出 API
 * 提供 /api/metrics endpoint 用于 Prometheus 抓取
 */

import { NextResponse } from 'next/server';

import { exportPrometheusMetrics } from '@/lib/logger/metrics';

/**
 * GET /api/metrics
 * 返回 Prometheus 格式的指标数据
 */
export async function GET() {
  try {
    const metricsText = exportPrometheusMetrics();

    return new NextResponse(metricsText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Failed to export metrics:', error);

    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
