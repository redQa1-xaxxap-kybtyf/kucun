/**
 * 内存监控模块
 * 用于监控Node.js应用的内存使用情况
 */

const MODULE_NAME = 'memory-monitor';

function logDebug(message: string, metadata?: unknown): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (!process.env.DEBUG) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[${MODULE_NAME}] ${message}`, metadata ?? '');
}

function logWarn(message: string, metadata?: unknown): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(`[${MODULE_NAME}] ${message}`, metadata ?? '');
}

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
    logWarn('Memory usage alerts triggered', { alerts });
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
    logDebug('Memory monitor disabled in development mode');
    return;
  }

  logDebug('Starting memory monitor', {
    intervalMs,
    alertsEnabled: alertConfig.enabled,
  });

  // 立即执行一次
  const stats = getMemoryStats();
  logDebug(formatMemoryStats(stats));

  // 定期监控
  monitorInterval = setInterval(() => {
    const stats = getMemoryStats();
    logDebug(formatMemoryStats(stats));
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
    logDebug('Memory monitor stopped');
  }
}

/**
 * 更新告警配置
 */
export function updateAlertConfig(config: Partial<MemoryAlertConfig>): void {
  alertConfig = { ...alertConfig, ...config };
  logDebug('Alert config updated', { config: JSON.stringify(alertConfig) });
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
    logDebug('Triggering manual GC');
    const beforeStats = getMemoryStats();
    global.gc();
    const afterStats = getMemoryStats();
    logDebug('Manual GC complete', {
      freedMb: Math.round(beforeStats.heapUsedMB - afterStats.heapUsedMB),
    });
  } else {
    logWarn('Manual GC not available. Run with --expose-gc flag.');
  }
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

    logDebug('Process cleanup listeners registered for memory monitor');
  }
}
