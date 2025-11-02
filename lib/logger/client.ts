/**
 * Client-side logging utilities.
 * Provides a thin wrapper around the server logging API so that
 * browser components avoid importing server-only dependencies.
 *
 * 严格遵循全栈项目统一约定规范：
 * - 客户端代码不导入服务端依赖
 * - 使用浏览器 console API 进行日志输出
 * - 可选地将错误报告到服务端
 */

interface ClientErrorPayload {
  module: string;
  message: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    digest?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * 客户端日志级别
 */
type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 通用客户端日志函数
 */
function logToConsole(
  level: ClientLogLevel,
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const prefix = `[${module}]`;
  const fullMessage = `${prefix} ${message}`;

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(fullMessage, metadata || '');
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.log(fullMessage, metadata || '');
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(fullMessage, metadata || '');
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(fullMessage, metadata || '');
      break;
  }
}

/**
 * 客户端 debug 日志
 */
export function debug(
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  logToConsole('debug', module, message, metadata);
}

/**
 * 客户端 info 日志
 */
export function info(
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  logToConsole('info', module, message, metadata);
}

/**
 * 客户端 warn 日志
 */
export function warn(
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  logToConsole('warn', module, message, metadata);
}

/**
 * 客户端 error 日志
 */
export function error(
  module: string,
  message: string,
  errorObj?: Error | unknown,
  metadata?: Record<string, unknown>
): void {
  const combinedMetadata = {
    ...metadata,
    error:
      errorObj instanceof Error
        ? {
            name: errorObj.name,
            message: errorObj.message,
            stack: errorObj.stack,
          }
        : errorObj,
  };
  logToConsole('error', module, message, combinedMetadata);
}

/**
 * Report an error from the browser to the server logging endpoint.
 * Falls back to console logging when the request fails.
 */
export async function logClientError(
  module: string,
  message: string,
  errorObj: unknown,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // 先输出到控制台
  error(module, message, errorObj, metadata);

  const payload: ClientErrorPayload = {
    module,
    message,
    error: normalizeError(errorObj),
    metadata: {
      url: window.location.href,
      ...metadata,
    },
  };

  try {
    await fetch('/api/logs/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (requestError) {
    // eslint-disable-next-line no-console
    console.error('Failed to report client error', requestError, payload);
  }
}

function normalizeError(errorObj: unknown) {
  if (!errorObj) {
    return undefined;
  }

  if (errorObj instanceof Error) {
    return {
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
      digest: (errorObj as Error & { digest?: string }).digest,
    };
  }

  if (typeof errorObj === 'object') {
    try {
      return JSON.parse(JSON.stringify(errorObj));
    } catch {
      return { message: String(errorObj) };
    }
  }

  return { message: String(errorObj) };
}

/**
 * 客户端 logger 对象（兼容服务端 logger 接口）
 */
export const clientLogger = {
  debug,
  info,
  warn,
  error,
};
