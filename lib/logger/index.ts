/**
 * 统一结构化日志系统
 * 职责:
 * - 提供 JSON 格式的结构化日志输出
 * - 支持日志级别控制和环境区分
 * - 集成性能指标采集
 * - 支持审计日志记录
 * - 类型安全，零 any 类型
 */

import { prisma } from '@/lib/db';
import type { SystemLogLevel, SystemLogType } from '@/lib/types/settings';

// ==================== 类型定义 ====================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  changes?: Record<string, unknown>;
  result: 'success' | 'failure';
  reason?: string;
}

export interface MetricsEntry {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
}

// ==================== 配置 ====================

const config = {
  enabled: true,
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
  includeTimestamp: true,
  includeStack: process.env.NODE_ENV === 'development',
};

// ==================== 辅助函数 ====================

/**
 * 判断是否应该输出日志
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) {
    return false;
  }

  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
  const minLevelIndex = levels.indexOf(config.minLevel);
  const currentLevelIndex = levels.indexOf(level);

  return currentLevelIndex >= minLevelIndex;
}

/**
 * 格式化日志条目为 JSON
 */
function formatJSON(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * 格式化日志条目为文本
 */
function formatText(entry: LogEntry): string {
  const parts = [
    entry.timestamp,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.module}]`,
    entry.message,
  ];

  if (entry.duration !== undefined) {
    parts.push(`(${entry.duration}ms)`);
  }

  if (entry.context) {
    parts.push(JSON.stringify(entry.context));
  }

  if (entry.error) {
    parts.push(`Error: ${entry.error.message}`);
    if (entry.error.stack && config.includeStack) {
      parts.push(`\n${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

/**
 * 输出日志到控制台
 */
function output(level: LogLevel, formatted: string): void {
  if (process.env.NODE_ENV === 'test') {
    return; // 测试环境静默
  }

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
    case 'critical':
      console.error(formatted);
      break;
  }
}

// ==================== 核心日志函数 ====================

/**
 * 通用日志记录函数
 */
export function log(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext,
  error?: Error | unknown,
  duration?: number,
  metadata?: Record<string, unknown>
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    context,
    duration,
    metadata,
  };

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: config.includeStack ? error.stack : undefined,
      };
    } else {
      entry.error = {
        name: 'UnknownError',
        message: String(error),
      };
    }
  }

  const formatted = config.format === 'json' ? formatJSON(entry) : formatText(entry);
  output(level, formatted);
}

/**
 * 调试日志
 */
export function debug(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void {
  log('debug', module, message, context, undefined, undefined, metadata);
}

/**
 * 信息日志
 */
export function info(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void {
  log('info', module, message, context, undefined, undefined, metadata);
}

/**
 * 警告日志
 */
export function warn(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void {
  log('warn', module, message, context, undefined, undefined, metadata);
}

/**
 * 错误日志
 */
export function error(
  module: string,
  message: string,
  error?: Error | unknown,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void {
  log('error', module, message, context, error, undefined, metadata);
}

/**
 * 严重错误日志
 */
export function critical(
  module: string,
  message: string,
  error?: Error | unknown,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void {
  log('critical', module, message, context, error, undefined, metadata);
}

// ==================== 性能监控 ====================

/**
 * 记录性能指标
 */
export function metric(
  module: string,
  name: string,
  value: number,
  unit: MetricsEntry['unit'],
  tags?: Record<string, string>
): void {
  const entry: MetricsEntry = {
    name,
    value,
    unit,
    tags,
  };

  info(module, `Metric: ${name}`, { metric: JSON.stringify(entry) });
}

/**
 * 性能计时器
 */
export class Timer {
  private startTime: number;
  private module: string;
  private operation: string;
  private context?: LogContext;

  constructor(module: string, operation: string, context?: LogContext) {
    this.startTime = performance.now();
    this.module = module;
    this.operation = operation;
    this.context = context;
  }

  /**
   * 停止计时并记录日志
   */
  end(message?: string): number {
    const duration = Math.round(performance.now() - this.startTime);
    const msg = message || `Operation completed: ${this.operation}`;

    log('info', this.module, msg, this.context, undefined, duration);
    metric(this.module, this.operation, duration, 'ms');

    return duration;
  }

  /**
   * 停止计时并记录错误
   */
  endWithError(error: Error | unknown, message?: string): number {
    const duration = Math.round(performance.now() - this.startTime);
    const msg = message || `Operation failed: ${this.operation}`;

    log('error', this.module, msg, this.context, error, duration);
    metric(this.module, `${this.operation}_error`, 1, 'count');

    return duration;
  }
}

/**
 * 创建性能计时器
 */
export function timer(
  module: string,
  operation: string,
  context?: LogContext
): Timer {
  return new Timer(module, operation, context);
}

// ==================== 审计日志 ====================

/**
 * 记录审计日志
 * 用于关键业务操作的审计追踪
 */
export async function audit(entry: AuditLogEntry, context?: LogContext): Promise<void> {
  // 记录到应用日志
  info('audit', `${entry.action} ${entry.resource}`, {
    ...context,
    resourceId: entry.resourceId,
    result: entry.result,
  }, {
    changes: entry.changes,
    reason: entry.reason,
  });

  // 记录到数据库（异步，不阻塞主流程）
  try {
    const systemLogType: SystemLogType = 'business_operation';
    const systemLogLevel: SystemLogLevel = entry.result === 'success' ? 'info' : 'error';

    await prisma.systemLog.create({
      data: {
        type: systemLogType,
        level: systemLogLevel,
        action: entry.action,
        description: `${entry.action} ${entry.resource}${entry.resourceId ? ` (${entry.resourceId})` : ''}`,
        userId: context?.userId || entry.userId || null,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: JSON.stringify({
          resource: entry.resource,
          resourceId: entry.resourceId,
          changes: entry.changes,
          result: entry.result,
          reason: entry.reason,
        }),
      },
    });
  } catch (err) {
    // 审计日志写入失败不应该影响业务流程
    error('audit', 'Failed to write audit log to database', err);
  }
}

// ==================== 请求日志 ====================

/**
 * 从 Request 对象提取上下文
 */
export function extractRequestContext(request: Request): LogContext {
  return {
    method: request.method,
    path: new URL(request.url).pathname,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * API 请求日志记录器
 */
export function logRequest(
  module: string,
  request: Request,
  statusCode: number,
  duration: number,
  userId?: string
): void {
  const context = extractRequestContext(request);
  context.userId = userId;
  context.statusCode = statusCode;

  const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  log(level, module, `${request.method} ${context.path}`, context, undefined, duration);
  metric(module, 'api_request', duration, 'ms', {
    method: request.method,
    status: String(statusCode),
  });
}

// ==================== 导出旧API兼容层 ====================

/**
 * 兼容旧的 logger 接口
 */
export const logger = {
  debug,
  info,
  warn,
  error,
  timer,
  metric,
};

export default logger;
