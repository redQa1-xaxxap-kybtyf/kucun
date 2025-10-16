/**
 * 内存监控模块
 * 用于监控Node.js应用的内存使用情况
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';

interface MemoryStats {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  heapUsedMB: number;
  heapTotalMB: number;
  heapUsagePercent: number;
  rss: number;
  rssMB: number;
  external: number;
  externalMB: number;
  arrayBuffers: number;
  arrayBuffersMB: number;
}

interface MemoryAlertConfig {
  heapUsagePercent: number; // 堆内存使用率阈值
  rssThresholdMB: number; // RSS内存阈值（MB）
  enabled: boolean;
}

const DEFAULT_ALERT_CONFIG: MemoryAlertConfig = {
  heapUsagePercent: 85, // 堆内存使用率 > 85% 时告警
  rssThresholdMB: 3500, // RSS > 3.5GB 时告警
  enabled: true,
};

let monitorInterval: NodeJS.Timeout | null = null;
let alertConfig = { ...DEFAULT_ALERT_CONFIG };

// 全局标志，防止重复注册监听器（HMR时模块会重新加载）
const GLOBAL_LISTENERS_KEY = Symbol.for('memory-monitor-listeners-registered');

/**
 * 获取当前内存统计信息
 */
export function getMemoryStats(): MemoryStats {
  const usage = process.memoryUsage();

  return {
    timestamp: Date.now(),
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    heapUsedMB: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
    heapTotalMB: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
    heapUsagePercent:
      Math.round((usage.heapUsed / usage.heapTotal) * 10000) / 100,
    rss: usage.rss,
    rssMB: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
    external: usage.external,
    externalMB: Math.round((usage.external / 1024 / 1024) * 100) / 100,
    arrayBuffers: usage.arrayBuffers,
    arrayBuffersMB: Math.round((usage.arrayBuffers / 1024 / 1024) * 100) / 100,
  };
}

/**
 * 检查是否需要告警
 */
function checkAlerts(stats: MemoryStats): void {
  if (!alertConfig.enabled) {
    return;
  }

  const alerts: string[] = [];

  // 堆内存使用率告警
  if (stats.heapUsagePercent > alertConfig.heapUsagePercent) {
    alerts.push(
      `⚠️ Heap usage is ${stats.heapUsagePercent}% (threshold: ${alertConfig.heapUsagePercent}%)`
    );
  }

  // RSS内存告警
  if (stats.rssMB > alertConfig.rssThresholdMB) {
    alerts.push(
      `⚠️ RSS memory is ${stats.rssMB}MB (threshold: ${alertConfig.rssThresholdMB}MB)`
    );
  }

  // 输出告警
  if (alerts.length > 0) {
    logger.warn('memory-monitor', 'Memory usage alerts triggered', undefined, {
      alerts,
    });
  }
}

/**
 * 格式化内存统计信息输出
 */
function formatMemoryStats(stats: MemoryStats): string {
  const parts = [
    `Heap: ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${stats.heapUsagePercent}%)`,
    `RSS: ${stats.rssMB} MB`,
    `External: ${stats.externalMB} MB`,
  ];

  // 获取Redis缓存统计
  try {
    const cacheStats = redis.getMemoryCacheStats();
    if (cacheStats.size > 0) {
      parts.push(`Cache: ${cacheStats.size}/${cacheStats.maxSize} keys`);
    }
  } catch {
    // Redis统计获取失败，忽略
  }

  return parts.join(', ');
}

/**
 * 启动内存监控
 * @param intervalMs 监控间隔（毫秒），默认30秒
 * @param config 告警配置
 */
export function startMemoryMonitor(
  intervalMs: number = 30000,
  config?: Partial<MemoryAlertConfig>
): void {
  // 如果已经在运行，先停止
  if (monitorInterval) {
    stopMemoryMonitor();
  }

  // 更新配置
  if (config) {
    alertConfig = { ...alertConfig, ...config };
  }

  // 仅在生产环境或显式启用时运行
  if (process.env.NODE_ENV !== 'production' && !config?.enabled) {
    if (process.env.DEBUG) {
      logger.debug(
        'memory-monitor',
        'Memory monitor disabled in development mode'
      );
    }
    return;
  }

  if (process.env.DEBUG) {
    logger.debug('memory-monitor', 'Starting memory monitor', {
      intervalMs,
      alertsEnabled: alertConfig.enabled,
    });
  }

  // 立即执行一次
  const stats = getMemoryStats();
  if (process.env.DEBUG) {
    logger.debug('memory-monitor', formatMemoryStats(stats));
  }

  // 定期监控
  monitorInterval = setInterval(() => {
    const stats = getMemoryStats();
    if (process.env.DEBUG) {
      logger.debug('memory-monitor', formatMemoryStats(stats));
    }
    checkAlerts(stats);
  }, intervalMs);

  // 使用unref()防止阻塞进程退出
  monitorInterval.unref();
}

/**
 * 停止内存监控
 */
export function stopMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    if (process.env.DEBUG) {
      logger.debug('memory-monitor', 'Memory monitor stopped');
    }
  }
}

/**
 * 更新告警配置
 */
export function updateAlertConfig(config: Partial<MemoryAlertConfig>): void {
  alertConfig = { ...alertConfig, ...config };
  if (process.env.DEBUG) {
    logger.debug('memory-monitor', 'Alert config updated', {
      config: JSON.stringify(alertConfig),
    });
  }
}

/**
 * 获取当前告警配置
 */
export function getAlertConfig(): MemoryAlertConfig {
  return { ...alertConfig };
}

/**
 * 手动触发垃圾回收（如果启用了--expose-gc标志）
 */
export function triggerGC(): void {
  if (global.gc) {
    if (process.env.DEBUG) {
      logger.debug('memory-monitor', 'Triggering manual GC');
    }
    const beforeStats = getMemoryStats();
    global.gc();
    const afterStats = getMemoryStats();
    if (process.env.DEBUG) {
      logger.debug('memory-monitor', 'Manual GC complete', {
        freedMb: Math.round(beforeStats.heapUsedMB - afterStats.heapUsedMB),
      });
    }
  } else {
    logger.warn(
      'memory-monitor',
      'Manual GC not available. Run with --expose-gc flag.'
    );
  }
}

/**
 * 生成内存快照报告（包含 Redis 监控指标）
 */
export function generateMemoryReport(): {
  stats: MemoryStats;
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
    recommendations.push(
      'Redis内存缓存接近上限，考虑增加MAX_MEMORY_CACHE_SIZE'
    );
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
    recommendations.push(
      `⚠️ 有 ${redisPoolHealth.reconnecting} 个 Redis 连接正在重连`
    );
  }

  if (redisPoolHealth.disconnected > 0) {
    recommendations.push(
      `⚠️ 有 ${redisPoolHealth.disconnected} 个 Redis 连接已断开`
    );
  }

  return {
    stats,
    cacheStats,
    redisPoolHealth,
    redisConfig,
    recommendations,
  };
}

// 进程退出时清理 - 使用全局标志防止重复注册（HMR场景）
if (typeof process !== 'undefined' && typeof global !== 'undefined') {
  // @ts-expect-error - 使用全局Symbol防止HMR时重复注册
  if (!global[GLOBAL_LISTENERS_KEY]) {
    // @ts-expect-error - 设置全局标志
    global[GLOBAL_LISTENERS_KEY] = true;

    // 只注册一次清理监听器
    process.on('exit', () => {
      stopMemoryMonitor();
    });

    process.on('SIGTERM', () => {
      stopMemoryMonitor();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      stopMemoryMonitor();
      process.exit(0);
    });

    if (process.env.DEBUG) {
      logger.debug(
        'memory-monitor',
        'Process cleanup listeners registered for memory monitor'
      );
    }
  }
}
