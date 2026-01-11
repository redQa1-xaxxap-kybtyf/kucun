/**
 * Redis 监控 API
 * 提供 Redis 连接池健康状态、配置信息和内存缓存统计
 * 需要使用 MONITORING_TOKEN 进行身份验证
 */

import { NextResponse, type NextRequest } from 'next/server';

import { timingSafeEqual } from 'crypto';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis/redis-client';

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

/**
 * GET /api/monitoring/redis
 * 获取 Redis 监控信息
 *
 * 需要在请求头中提供 Authorization: Bearer <MONITORING_TOKEN>
 */
async function handleRedisMonitoring(request: NextRequest) {
  try {
    // 1. 身份验证（生产环境必须显式配置强 token；避免弱口令/默认值导致未授权访问）
    const isProduction = env.NODE_ENV === 'production';
    let expectedToken = process.env.MONITORING_TOKEN;

    if (isProduction) {
      if (!expectedToken || isWeakProdToken(expectedToken)) {
        logger.error('monitoring-redis', 'MONITORING_TOKEN 未配置或过弱，已禁用监控端点');
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
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing monitoring token',
        },
        { status: 401 }
      );
    }

    // 2. 收集监控数据
    const monitoringData = await collectRedisMonitoringData();

    // 3. 返回监控数据
    return NextResponse.json(
      {
        success: true,
        data: monitoringData,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    logger.error('monitoring-redis', '获取 Redis 监控数据失败', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(RateLimitType.GLOBAL)(handleRedisMonitoring);

/**
 * 收集 Redis 监控数据
 */
async function collectRedisMonitoringData() {
  // 1. 连接池健康状态
  const poolHealth = redis.getPoolHealth();

  // 2. Redis 配置信息
  const config = redis.getConfig();

  // 3. 内存缓存统计
  const cacheStats = redis.getMemoryCacheStats();

  // 4. Redis 服务器信息（可选）
  let serverInfo: Record<string, unknown> | null = null;
  try {
    if (poolHealth.isRedisAvailable && poolHealth.ready > 0) {
      const client = redis.getClient();
      const info = await client.info('server');
      const memory = await client.info('memory');
      const stats = await client.info('stats');

      serverInfo = {
        server: parseRedisInfo(info),
        memory: parseRedisInfo(memory),
        stats: parseRedisInfo(stats),
      };
    }
  } catch (error) {
    logger.error('monitoring-redis', '获取 Redis 服务器信息失败', error);
    serverInfo = null;
  }

  // 5. 连接测试
  let pingLatency: number | null = null;
  try {
    if (poolHealth.isRedisAvailable && poolHealth.ready > 0) {
      const start = Date.now();
      await redis.ping();
      pingLatency = Date.now() - start;
    }
  } catch (error) {
    logger.error('monitoring-redis', 'Redis ping 失败', error);
    pingLatency = null;
  }

  return {
    // 连接池健康状态
    pool: {
      ...poolHealth,
      healthPercentage:
        poolHealth.total > 0 ? (poolHealth.ready / poolHealth.total) * 100 : 0,
    },

    // Redis 配置
    config: {
      ...config,
      // 隐藏敏感信息
      url: maskUrl(config.url),
    },

    // 内存缓存统计
    memoryCache: {
      ...cacheStats,
      usagePercentage: (cacheStats.size / cacheStats.maxSize) * 100,
    },

    // Redis 服务器信息
    server: serverInfo,

    // 性能指标
    performance: {
      pingLatency,
      isHealthy: poolHealth.isRedisAvailable && poolHealth.ready > 0,
    },

    // 环境信息
    environment: {
      nodeEnv: env.NODE_ENV,
      tlsEnabled: config.tlsEnabled,
    },
  };
}

/**
 * 解析 Redis INFO 命令输出
 */
function parseRedisInfo(info: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  const lines = info.split('\r\n');
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    const [key, value] = line.split(':');
    if (key && value) {
      // 尝试转换为数字
      const numValue = parseFloat(value);
      result[key] = isNaN(numValue) ? value : numValue;
    }
  }

  return result;
}

/**
 * 隐藏 URL 中的敏感信息（密码）
 */
function maskUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // 隐藏密码
    if (urlObj.password) {
      urlObj.password = '***';
    }

    return urlObj.toString();
  } catch {
    // 如果不是有效的 URL，直接返回
    return url;
  }
}

/**
 * 使用示例：
 *
 * ```bash
 * # 获取 Redis 监控信息
 * curl -H "Authorization: Bearer your-monitoring-token" \
 *   http://localhost:3000/api/monitoring/redis
 * ```
 *
 * 响应示例：
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "pool": {
 *       "total": 3,
 *       "ready": 3,
 *       "connecting": 0,
 *       "reconnecting": 0,
 *       "disconnected": 0,
 *       "isRedisAvailable": true,
 *       "healthPercentage": 100
 *     },
 *     "config": {
 *       "url": "redis://***@127.0.0.1:6379",
 *       "poolSize": 3,
 *       "namespace": "kucun",
 *       "db": 0,
 *       "tlsEnabled": false,
 *       "connectTimeout": 10000,
 *       "commandTimeout": 5000,
 *       "keepAlive": 60000,
 *       "maxRetries": 5
 *     },
 *     "memoryCache": {
 *       "size": 150,
 *       "maxSize": 1000,
 *       "hitRate": 0,
 *       "usagePercentage": 15
 *     },
 *     "server": {
 *       "server": {
 *         "redis_version": "8.0.3",
 *         "redis_mode": "standalone",
 *         "os": "Linux 5.15.0-1",
 *         "uptime_in_seconds": 86400
 *       },
 *       "memory": {
 *         "used_memory": 1048576,
 *         "used_memory_human": "1.00M",
 *         "used_memory_peak": 2097152,
 *         "maxmemory": 2147483648
 *       },
 *       "stats": {
 *         "total_connections_received": 1000,
 *         "total_commands_processed": 50000,
 *         "instantaneous_ops_per_sec": 100
 *       }
 *     },
 *     "performance": {
 *       "pingLatency": 2,
 *       "isHealthy": true
 *     },
 *     "environment": {
 *       "nodeEnv": "production",
 *       "tlsEnabled": false
 *     }
 *   },
 *   "timestamp": "2025-10-06T12:00:00.000Z"
 * }
 * ```
 */
