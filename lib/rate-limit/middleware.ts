/**
 * 速率限制中间件
 * 为 Next.js API 路由提供速率限制功能
 */

import type { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';

import { RATE_LIMIT_ENABLED, RateLimitType } from './config';

import { getRateLimiter } from './index';

/**
 * 速率限制响应
 */
export interface RateLimitResponse {
  /** 是否被限制 */
  limited: boolean;
  /** HTTP 响应对象（如果被限制） */
  response?: Response;
}

/**
 * 从请求中提取标识符
 * 优先使用用户ID，其次使用IP地址
 *
 * @param request Next.js 请求对象
 * @returns 唯一标识符
 */
export function getIdentifier(request: NextRequest): string {
  // 1. 优先使用用户ID（已认证用户）
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }

  // 2. 使用IP地址（未认证用户）
  // 支持代理服务器场景（Nginx、Cloudflare等）
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个IP，取第一个
    const ip = forwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }

  // 3. 降级到默认IP（理论上不应该走到这里）
  return 'ip:127.0.0.1';
}

/**
 * 检查速率限制
 * 核心中间件函数
 *
 * @param request Next.js 请求对象
 * @param type 速率限制类型
 * @returns 速率限制响应
 */
export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = RateLimitType.GLOBAL
): Promise<RateLimitResponse> {
  // 如果速率限制未启用，直接通过
  if (!RATE_LIMIT_ENABLED) {
    return { limited: false };
  }

  try {
    // 获取速率限制器
    const limiter = getRateLimiter(type);

    // 提取请求标识符
    const identifier = getIdentifier(request);

    // 检查限制
    const result = await limiter.checkLimit(identifier);

    // 如果被限制，返回 429 响应
    if (!result.allowed) {
      const response = createRateLimitResponse(request, result, type);
      return { limited: true, response };
    }

    // 通过限制
    return { limited: false };
  } catch (error) {
    // 发生错误时，为了系统可用性，允许请求通过
    logger.error(
      'rate-limit',
      '检查速率限制错误',
      error instanceof Error ? error : undefined
    );
    return { limited: false };
  }
}

/**
 * 创建速率限制错误响应
 * 返回 429 Too Many Requests
 *
 * @param result 速率限制结果
 * @param type 限制类型
 * @returns HTTP 响应对象
 */
function createRateLimitResponse(
  request: NextRequest,
  result: { remaining: number; resetAt: Date; limit: number },
  type: RateLimitType
): Response {
  // 计算重试等待时间（秒）
  const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);

  // 错误消息映射
  const messages: Record<RateLimitType, string> = {
    [RateLimitType.GLOBAL]: '请求过于频繁，请稍后再试',
    [RateLimitType.AUTH]: '认证请求过于频繁，请稍后再试',
    [RateLimitType.READ]: '读取请求过于频繁，请稍后再试',
    [RateLimitType.FINANCE_READ]: '财务数据读取请求过于频繁，请稍后再试',
    [RateLimitType.WRITE]: '写入请求过于频繁，请稍后再试',
    [RateLimitType.LOGIN]: '登录尝试次数过多，请稍后再试',
    [RateLimitType.CAPTCHA]: '验证码请求过于频繁，请稍后再试',
  };

  const message = messages[type] || '请求过于频繁，请稍后再试';

  // 构造 NextAuth 兼容的错误跳转地址，确保前端能解析 error 参数
  const errorUrl = new URL('/auth/error', request.nextUrl.origin);
  errorUrl.searchParams.set('error', 'RATE_LIMIT_EXCEEDED');
  errorUrl.searchParams.set('type', type);

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfter: result.resetAt.toISOString(),
        details: {
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString(),
        },
      },
      url: errorUrl.toString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        // 标准 HTTP 头：告诉客户端多久后可以重试
        'Retry-After': String(retryAfter),
        // 自定义 HTTP 头：提供详细的速率限制信息
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
      },
    }
  );
}

/**
 * 速率限制中间件包装器
 * 用于包装 API 处理器
 *
 * @param type 速率限制类型
 * @returns 中间件函数
 *
 * @example
 * // 在 API 路由中使用
 * export const GET = withRateLimit(RateLimitType.READ)(async (request) => {
 *   // 处理请求
 *   return successResponse(data);
 * });
 */
export function withRateLimit(type: RateLimitType = RateLimitType.GLOBAL) {
  return function <
    TParams extends Record<string, string> = Record<string, string>,
  >(
    handler: (
      request: NextRequest,
      context: { params?: Promise<TParams> | TParams }
    ) => Promise<Response>
  ) {
    return async (
      request: NextRequest,
      context: { params?: Promise<TParams> | TParams } = {}
    ) => {
      // 检查速率限制
      const rateLimitResult = await checkRateLimit(request, type);

      // 如果被限制，返回 429 响应
      if (rateLimitResult.limited && rateLimitResult.response) {
        return rateLimitResult.response;
      }

      // 执行原处理器
      return await handler(request, context);
    };
  };
}

/**
 * 根据 HTTP 方法自动选择速率限制类型
 *
 * @param request Next.js 请求对象
 * @returns 速率限制类型
 */
export function getAutoRateLimitType(request: NextRequest): RateLimitType {
  const method = request.method.toUpperCase();

  switch (method) {
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
      return RateLimitType.READ;
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return RateLimitType.WRITE;
    default:
      return RateLimitType.GLOBAL;
  }
}

/**
 * 自动速率限制中间件
 * 根据 HTTP 方法自动选择限制类型
 *
 * @param request Next.js 请求对象
 * @returns 速率限制响应
 */
export async function autoRateLimit(
  request: NextRequest
): Promise<RateLimitResponse> {
  const type = getAutoRateLimitType(request);
  return await checkRateLimit(request, type);
}
