/**
 * 内存监控API端点
 * GET /api/monitoring/memory - 获取内存使用情况
 */

import { NextResponse, type NextRequest } from 'next/server';

import { timingSafeEqual } from 'crypto';

import { logger } from '@/lib/logger';
import { getMemoryStats } from '@/lib/monitoring/memory-monitor';
import { generateMemoryReport } from '@/lib/monitoring/memory-monitor-report';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_DEV_TOKEN = 'dev-token';
const DEV_PLACEHOLDER_TOKEN = 'dev-token-change-in-production';
const MIN_PROD_TOKEN_LENGTH = 32;

function extractMonitoringToken(request: NextRequest): string | null {
  const headerToken = request.headers.get('x-monitoring-token')?.trim();
  if (headerToken) {
    return headerToken;
  }

  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function isWeakProdToken(token: string): boolean {
  return (
    token === DEFAULT_DEV_TOKEN ||
    token === DEV_PLACEHOLDER_TOKEN ||
    token.length < MIN_PROD_TOKEN_LENGTH
  );
}

async function handleMemoryMonitoring(request: NextRequest) {
  try {
    // 身份验证（生产环境必须显式配置强 token；避免弱口令/默认值导致未授权访问）
    const isProduction = process.env.NODE_ENV === 'production';
    let expectedToken = process.env.MONITORING_TOKEN;

    if (isProduction) {
      if (!expectedToken || isWeakProdToken(expectedToken)) {
        logger.error('monitoring-memory', 'MONITORING_TOKEN 未配置或过弱，已禁用监控端点');
        return NextResponse.json(
          { success: false, error: 'Not Found' },
          { status: 404 }
        );
      }
    } else {
      expectedToken = expectedToken || DEFAULT_DEV_TOKEN;
    }

    const token = extractMonitoringToken(request);
    if (!token || !tokensMatch(token, expectedToken)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查查询参数
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      // 返回详细报告
      const report = generateMemoryReport();
      return NextResponse.json({
        success: true,
        data: report,
      });
    } else {
      // 返回简单统计
      const stats = getMemoryStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }
  } catch (error) {
    logger.error('monitoring-memory', '获取内存监控数据失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(RateLimitType.GLOBAL)(handleMemoryMonitoring);
