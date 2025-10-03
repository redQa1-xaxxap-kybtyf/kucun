import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

/**
 * 健康检查接口
 * GET /api/health
 *
 * 用于监控系统健康状态，包括：
 * - 数据库连接状态
 * - Redis 连接状态
 * - 应用运行状态
 *
 * 返回格式：
 * {
 *   status: 'healthy' | 'unhealthy',
 *   timestamp: string,
 *   checks: {
 *     database: { status: 'up' | 'down', latency?: number, error?: string },
 *     redis: { status: 'up' | 'down', latency?: number, error?: string },
 *     application: { status: 'up', uptime: number }
 *   }
 * }
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    application: {
      status: 'up';
      uptime: number;
      version: string;
    };
  } = {
    database: { status: 'down' },
    redis: { status: 'down' },
    application: {
      status: 'up',
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    },
  };

  // 检查数据库连接
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    checks.database = {
      status: 'up',
      latency: dbLatency,
    };
  } catch (error) {
    checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : '数据库连接失败',
    };
  }

  // 检查 Redis 连接
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;

    checks.redis = {
      status: 'up',
      latency: redisLatency,
    };
  } catch (error) {
    checks.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Redis 连接失败',
    };
  }

  // 判断整体健康状态
  const isHealthy =
    checks.database.status === 'up' && checks.redis.status === 'up';

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    checks,
  };

  // 如果不健康，返回 503 状态码
  if (!isHealthy) {
    return NextResponse.json(response, { status: 503 });
  }

  return NextResponse.json(response, { status: 200 });
}
