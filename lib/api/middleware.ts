import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  ApiErrorType,
  extractErrorInfo,
  generateErrorId,
  handlePrismaError,
  handleZodError,
  isApiError,
  isPrismaError,
  isZodError,
} from '@/lib/api/errors';
import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';

import { badRequestResponse, unauthorizedResponse } from './response';

/**
 * 认证中间件类型
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: { params?: Record<string, string> },
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>
) => Promise<Response>;

/**
 * 带认证的API处理器包装器
 * 所有环境都强制进行身份验证,确保安全性
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context: { params?: Record<string, string> } = {}
  ) => {
    try {
      // 获取用户会话
      const session = await getServerSession(authOptions);

      // 验证会话是否存在
      if (!session || !session.user) {
        return unauthorizedResponse('请先登录');
      }

      // 执行处理器
      return await handler(request, context, session);
    } catch (error) {
      // 使用日志库记录错误(生产环境不使用 console.error)
      if (env.NODE_ENV === 'development') {
        console.error('认证中间件错误:', error);
      }
      return unauthorizedResponse('认证失败');
    }
  };
}

/**
 * 验证中间件类型
 */
export type ValidationSchema = {
  parse: (data: unknown) => unknown;
};

export type ValidatedHandler<T = unknown> = (
  request: NextRequest,
  context: { params?: Record<string, string> },
  validatedData: T
) => Promise<Response>;

/**
 * 带验证的API处理器包装器
 */
export function withValidation<T>(
  schema: ValidationSchema,
  handler: ValidatedHandler<T>
) {
  return async (
    request: NextRequest,
    context: { params?: Record<string, string> } = {}
  ) => {
    try {
      const body = await request.json();
      const validatedData = schema.parse(body) as T;

      return await handler(request, context, validatedData);
    } catch (error) {
      console.error('验证中间件错误:', error);
      return badRequestResponse('数据验证失败');
    }
  };
}

/**
 * 带认证和验证的API处理器包装器
 */
export function withAuthAndValidation<T>(
  schema: ValidationSchema,
  handler: (
    request: NextRequest,
    context: { params?: Record<string, string> },
    session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>,
    validatedData: T
  ) => Promise<Response>
) {
  return withAuth(async (request, context, session) => {
    try {
      const body = await request.json();
      const validatedData = schema.parse(body) as T;

      return await handler(request, context, session, validatedData);
    } catch (error) {
      console.error('验证错误:', error);
      return badRequestResponse('数据验证失败');
    }
  });
}

/**
 * 统一错误处理包装器
 * 自动捕获和处理所有错误，提供统一的错误响应格式
 *
 * @param handler API 处理器函数
 * @returns 包装后的处理器函数
 *
 * @example
 * export const GET = withErrorHandling(async (request, context) => {
 *   const data = await fetchData();
 *   return successResponse(data);
 * });
 */
export function withErrorHandling(
  handler: (
    request: NextRequest,
    context: { params?: Record<string, string> }
  ) => Promise<Response>
) {
  return async (
    request: NextRequest,
    context: { params?: Record<string, string> } = {}
  ) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, request);
    }
  };
}

/**
 * 统一错误处理函数
 * 根据错误类型返回相应的错误响应
 *
 * @param error 错误对象
 * @param request 请求对象（用于日志）
 * @returns 错误响应
 */
function handleApiError(error: unknown, request?: NextRequest): Response {
  const errorId = generateErrorId();

  // 1. 处理自定义 ApiError
  if (isApiError(error)) {
    logError(error, errorId, request);
    return createErrorResponse(
      error.type,
      error.message,
      error.statusCode,
      error.details,
      error.errorId
    );
  }

  // 2. 处理 Zod 验证错误
  if (isZodError(error)) {
    const apiError = handleZodError(error);
    logError(apiError, errorId, request);
    return createErrorResponse(
      apiError.type,
      apiError.message,
      apiError.statusCode,
      apiError.details,
      errorId
    );
  }

  // 3. 处理 Prisma 错误
  if (isPrismaError(error)) {
    const apiError = handlePrismaError(error);
    logError(apiError, errorId, request);
    return createErrorResponse(
      apiError.type,
      apiError.message,
      apiError.statusCode,
      apiError.details,
      errorId
    );
  }

  // 4. 处理未知错误
  logError(error, errorId, request);

  return createErrorResponse(
    ApiErrorType.INTERNAL_ERROR,
    '服务器内部错误',
    500,
    env.NODE_ENV === 'development' ? extractErrorInfo(error) : undefined,
    errorId
  );
}

/**
 * 创建标准化错误响应
 *
 * @param type 错误类型
 * @param message 错误消息
 * @param statusCode HTTP 状态码
 * @param details 错误详情（仅开发环境）
 * @param errorId 错误追踪ID
 * @returns 错误响应
 */
function createErrorResponse(
  type: ApiErrorType,
  message: string,
  statusCode: number,
  details?: unknown,
  errorId?: string
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type,
        message,
        details: env.NODE_ENV === 'development' ? details : undefined,
        errorId,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * 错误日志函数
 * 记录错误信息到控制台和数据库
 *
 * @param error 错误对象
 * @param errorId 错误追踪ID
 * @param request 请求对象（可选）
 */
function logError(
  error: unknown,
  errorId: string,
  request?: NextRequest
): void {
  const errorInfo = {
    errorId,
    timestamp: new Date().toISOString(),
    url: request?.url,
    method: request?.method,
    error: extractErrorInfo(error),
  };

  // 控制台日志
  console.error('[API Error]', errorInfo);

  // TODO: 写入数据库或发送到错误监控服务
  // if (env.NODE_ENV === 'production') {
  //   prisma.systemLog.create({
  //     data: {
  //       type: 'error',
  //       level: 'error',
  //       action: 'api_error',
  //       details: errorInfo,
  //     },
  //   }).catch(console.error);
  // }
}
