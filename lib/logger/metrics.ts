/**
 * Prometheus 指标采集系统
 * 职责:
 * - 提供 Prometheus 格式的指标导出
 * - 监控 API 响应时间、错误率、数据库性能
 * - 支持自定义指标和标签
 * - 类型安全，零 any 类型
 *
 * 使用方式:
 * 1. 在 API Route 中: registerMetric('api_request_duration', duration, { method, path, status })
 * 2. 访问 /api/metrics 获取 Prometheus 格式的指标
 */

// ==================== 类型定义 ====================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp?: number;
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  values: MetricValue[];
}

// ==================== 内存指标存储 ====================

const metrics = new Map<string, MetricDefinition>();

/**
 * 注册或更新指标
 */
export function registerMetric(
  name: string,
  value: number,
  labels: MetricLabels = {},
  type: MetricType = 'gauge',
  help = ''
): void {
  const metricKey = name;

  let metric = metrics.get(metricKey);
  if (!metric) {
    metric = {
      name,
      type,
      help: help || `Metric ${name}`,
      values: [],
    };
    metrics.set(metricKey, metric);
  }

  // 对于 counter 类型，累加值
  if (type === 'counter') {
    const existing = metric.values.find(v =>
      Object.entries(labels).every(([k, val]) => v.labels[k] === val)
    );
    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      metric.values.push({ value, labels, timestamp: Date.now() });
    }
  } else {
    // 对于 gauge, histogram, summary 类型，替换或添加值
    const existing = metric.values.find(v =>
      Object.entries(labels).every(([k, val]) => v.labels[k] === val)
    );
    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      metric.values.push({ value, labels, timestamp: Date.now() });
    }
  }
}

/**
 * 递增 counter 指标
 */
export function incrementCounter(
  name: string,
  labels: MetricLabels = {},
  help = ''
): void {
  registerMetric(name, 1, labels, 'counter', help);
}

/**
 * 设置 gauge 指标
 */
export function setGauge(
  name: string,
  value: number,
  labels: MetricLabels = {},
  help = ''
): void {
  registerMetric(name, value, labels, 'gauge', help);
}

/**
 * 记录 histogram 值
 */
export function recordHistogram(
  name: string,
  value: number,
  labels: MetricLabels = {},
  help = ''
): void {
  registerMetric(name, value, labels, 'histogram', help);
}

// ==================== 预定义指标 ====================

/**
 * API 请求计数器
 */
export function recordApiRequest(
  method: string,
  path: string,
  statusCode: number
): void {
  incrementCounter(
    'http_requests_total',
    {
      method,
      path,
      status: String(statusCode),
    },
    'Total HTTP requests'
  );
}

/**
 * API 响应时间
 */
export function recordApiDuration(
  method: string,
  path: string,
  duration: number
): void {
  recordHistogram(
    'http_request_duration_ms',
    duration,
    {
      method,
      path,
    },
    'HTTP request duration in milliseconds'
  );
}

/**
 * API 错误计数
 */
export function recordApiError(
  method: string,
  path: string,
  errorType: string
): void {
  incrementCounter(
    'http_errors_total',
    {
      method,
      path,
      error_type: errorType,
    },
    'Total HTTP errors'
  );
}

/**
 * 数据库查询时间
 */
export function recordDatabaseQuery(
  operation: string,
  table: string,
  duration: number
): void {
  recordHistogram(
    'db_query_duration_ms',
    duration,
    {
      operation,
      table,
    },
    'Database query duration in milliseconds'
  );
}

/**
 * 数据库错误计数
 */
export function recordDatabaseError(
  operation: string,
  table: string,
  errorType: string
): void {
  incrementCounter(
    'db_errors_total',
    {
      operation,
      table,
      error_type: errorType,
    },
    'Total database errors'
  );
}

/**
 * 缓存命中率
 */
export function recordCacheHit(cacheKey: string, hit: boolean): void {
  incrementCounter(
    'cache_operations_total',
    {
      key: cacheKey,
      result: hit ? 'hit' : 'miss',
    },
    'Total cache operations'
  );
}

/**
 * WebSocket 连接数
 */
export function setActiveWebsocketConnections(count: number): void {
  setGauge(
    'websocket_connections_active',
    count,
    {},
    'Active WebSocket connections'
  );
}

/**
 * 队列大小
 */
export function setQueueSize(queueName: string, size: number): void {
  setGauge(
    'queue_size',
    size,
    {
      queue: queueName,
    },
    'Current queue size'
  );
}

// ==================== 系统指标 ====================

/**
 * 记录内存使用
 */
export function recordMemoryUsage(): void {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    setGauge(
      'process_memory_bytes',
      usage.heapUsed,
      { type: 'heap_used' },
      'Process memory usage'
    );
    setGauge(
      'process_memory_bytes',
      usage.heapTotal,
      { type: 'heap_total' },
      'Process memory usage'
    );
    setGauge(
      'process_memory_bytes',
      usage.rss,
      { type: 'rss' },
      'Process memory usage'
    );
  }
}

/**
 * 记录 Node.js 事件循环延迟
 */
export function recordEventLoopLag(lag: number): void {
  setGauge(
    'nodejs_eventloop_lag_ms',
    lag,
    {},
    'Event loop lag in milliseconds'
  );
}

// ==================== Prometheus 格式导出 ====================

/**
 * 格式化标签为 Prometheus 格式
 */
function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return '';
  }

  const formatted = entries
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');

  return `{${formatted}}`;
}

/**
 * 导出 Prometheus 格式的指标
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];

  for (const metric of metrics.values()) {
    // HELP 行
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    // TYPE 行
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    // 值行
    for (const { value, labels } of metric.values) {
      const labelStr = formatLabels(labels);
      lines.push(`${metric.name}${labelStr} ${value}`);
    }

    lines.push(''); // 空行分隔
  }

  return lines.join('\n');
}

/**
 * 获取所有指标的 JSON 格式
 */
export function exportMetricsJSON(): Record<string, MetricDefinition> {
  const result: Record<string, MetricDefinition> = {};
  for (const [key, value] of metrics.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * 清空所有指标（用于测试）
 */
export function clearMetrics(): void {
  metrics.clear();
}

/**
 * 获取指标统计信息
 */
export function getMetricsStats(): {
  totalMetrics: number;
  totalDataPoints: number;
  metricsByType: Record<MetricType, number>;
} {
  const stats = {
    totalMetrics: metrics.size,
    totalDataPoints: 0,
    metricsByType: {
      counter: 0,
      gauge: 0,
      histogram: 0,
      summary: 0,
    } as Record<MetricType, number>,
  };

  for (const metric of metrics.values()) {
    stats.totalDataPoints += metric.values.length;
    stats.metricsByType[metric.type]++;
  }

  return stats;
}

// ==================== 自动采集系统指标 ====================

/**
 * 启动系统指标自动采集
 */
let metricsInterval: NodeJS.Timeout | null = null;

export function startMetricsCollection(intervalMs = 60000): void {
  if (metricsInterval) {
    return; // 已经启动
  }

  // 立即采集一次
  recordMemoryUsage();

  // 定时采集
  metricsInterval = setInterval(() => {
    recordMemoryUsage();
  }, intervalMs);
}

/**
 * 停止系统指标自动采集
 */
export function stopMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

// ==================== 导出 ====================

export const promMetrics = {
  // 注册指标
  registerMetric,
  incrementCounter,
  setGauge,
  recordHistogram,

  // 预定义指标
  recordApiRequest,
  recordApiDuration,
  recordApiError,
  recordDatabaseQuery,
  recordDatabaseError,
  recordCacheHit,
  setActiveWebsocketConnections,
  setQueueSize,

  // 系统指标
  recordMemoryUsage,
  recordEventLoopLag,

  // 导出
  exportPrometheusMetrics,
  exportMetricsJSON,
  getMetricsStats,

  // 管理
  clearMetrics,
  startMetricsCollection,
  stopMetricsCollection,
};

export default promMetrics;
