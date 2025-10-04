/**
 * API 性能监控中间件
 * 自动记录所有 API 请求的性能指标
 *
 * 使用方式:
 * ```ts
 * import { withMetrics } from '@/lib/logger/middleware';
 *
 * export const GET = withMetrics(async (req: Request) => {
 *   // your handler code
 * });
 * ```
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  recordApiDuration,
  recordApiError,
  recordApiRequest,
} from '@/lib/logger/metrics';

/**
 * API Handler 类型
 */
type ApiHandler = (
  req: NextRequest,
  context?: Record<string, unknown>
) => Promise<NextResponse | Response>;

/**
 * 包装 API Handler，自动记录性能指标
 */
export function withMetrics(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: Record<string, unknown>) => {
    const path = new URL(req.url).pathname;
    const method = req.method;
    const moduleName = `api${path.replace(/\//g, ':')}`;

    // 创建计时器
    const t = logger.timer(moduleName, `${method} ${path}`);

    let response: NextResponse | Response;
    let statusCode = 500;

    try {
      // 执行原始 handler
      response = await handler(req, context);
      statusCode = response.status;

      return response;
    } catch (error) {
      // 记录错误
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      recordApiError(method, path, errorType);

      t.endWithError(error, `API request failed: ${method} ${path}`);

      // 重新抛出错误
      throw error;
    } finally {
      // 记录指标
      const duration = t.end();

      recordApiRequest(method, path, statusCode);
      recordApiDuration(method, path, duration);
    }
  };
}

/**
 * 数据库操作性能监控包装器
 */
export function withDatabaseMetrics<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const moduleName = `db:${table}`;
  const t = logger.timer(moduleName, operation);

  return fn()
    .then(result => {
      t.end(`Database ${operation} on ${table} completed`);
      return result;
    })
    .catch(error => {
      const errorType = error instanceof Error ? error.name : 'UnknownError';

      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Dynamic import for metrics
      const { recordDatabaseError } = require('@/lib/logger/metrics');
      recordDatabaseError(operation, table, errorType);

      t.endWithError(error, `Database ${operation} on ${table} failed`);
      throw error;
    });
}

export default withMetrics;
