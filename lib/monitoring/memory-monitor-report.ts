/**
 * 内存监控报告（包含 Redis 监控指标）
 * 仅服务端可用。
 */

import 'server-only';

import { redis } from '@/lib/redis/redis-client';

import { getMemoryStats } from './memory-monitor';

/**
 * 生成内存快照报告（包含 Redis 监控指标）
 */
export function generateMemoryReport(): {
  stats: ReturnType<typeof getMemoryStats>;
  cacheStats: ReturnType<typeof redis.getMemoryCacheStats>;
  redisPoolHealth: ReturnType<typeof redis.getPoolHealth>;
  redisConfig: ReturnType<typeof redis.getConfig>;
  recommendations: string[];
} {
  const stats = getMemoryStats();
  const cacheStats = redis.getMemoryCacheStats();
  const redisPoolHealth = redis.getPoolHealth();
  const redisConfig = redis.getConfig();
  const recommendations: string[] = [];

  // 生成建议 - Node.js 内存
  if (stats.heapUsagePercent > 80) {
    recommendations.push('堆内存使用率较高，考虑优化缓存策略或增加内存限制');
  }

  if (cacheStats.size > cacheStats.maxSize * 0.9) {
    recommendations.push('Redis内存缓存接近上限，考虑增加MAX_MEMORY_CACHE_SIZE');
  }

  if (stats.rssMB > 2000) {
    recommendations.push('RSS内存占用较高，检查是否存在内存泄漏');
  }

  // 生成建议 - Redis 连接池
  if (!redisPoolHealth.isRedisAvailable) {
    recommendations.push('⚠️ Redis 不可用，已降级到内存缓存');
  }

  const healthPercentage =
    redisPoolHealth.total > 0
      ? (redisPoolHealth.ready / redisPoolHealth.total) * 100
      : 0;

  if (healthPercentage < 50) {
    recommendations.push(
      `⚠️ Redis 连接池健康度较低 (${healthPercentage.toFixed(1)}%)，检查网络连接`
    );
  }

  if (redisPoolHealth.reconnecting > 0) {
    recommendations.push(`⚠️ 有 ${redisPoolHealth.reconnecting} 个 Redis 连接正在重连`);
  }

  if (redisPoolHealth.disconnected > 0) {
    recommendations.push(`⚠️ 有 ${redisPoolHealth.disconnected} 个 Redis 连接已断开`);
  }

  return {
    stats,
    cacheStats,
    redisPoolHealth,
    redisConfig,
    recommendations,
  };
}

