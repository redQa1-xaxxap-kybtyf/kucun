import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';

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
 * 解析 Next.js 15 的 params（支持 Promise 或普通对象）
 *
 * @param params - 可能是 Promise 或普通对象的 params
 * @returns 解析后的 params 对象
 *
 * @example
 * const params = await resolveParams(context.params);
 * const { id } = params;
 */
export async function resolveParams<T extends Record<string, string>>(
  params?: Promise<T> | T
): Promise<T> {
  if (!params) {
    throw new Error('缺少必需的参数');
  }
  return await Promise.resolve(params);
}

/**
 * 认证中间件类型
 * 支持 Next.js 15 的新 params 类型（Promise 或普通对象）
 */
export type AuthenticatedHandler<
  TParams extends Record<string, string> = Record<string, string>,
> = (
  request: NextRequest,
  context: { params?: Promise<TParams> | TParams },
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>
) => Promise<Response>;

/**
 * 带认证的API处理器包装器
 * 所有环境都强制进行身份验证,确保安全性
 */
export function withAuth<
  TParams extends Record<string, string> = Record<string, string>,
>(handler: AuthenticatedHandler<TParams>) {
  return async (
    request: NextRequest,
    context: { params?: Promise<TParams> | TParams } = {}
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

export type ValidatedHandler<
  T = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = (
  request: NextRequest,
  context: { params?: Promise<TParams> | TParams },
  validatedData: T
) => Promise<Response>;

/**
 * 带验证的API处理器包装器
 */
export function withValidation<
  T,
  TParams extends Record<string, string> = Record<string, string>,
>(schema: ValidationSchema, handler: ValidatedHandler<T, TParams>) {
  return async (
    request: NextRequest,
    context: { params?: Promise<TParams> | TParams } = {}
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
export function withAuthAndValidation<
  T,
  TParams extends Record<string, string> = Record<string, string>,
>(
  schema: ValidationSchema,
  handler: (
    request: NextRequest,
    context: { params?: Promise<TParams> | TParams },
    session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>,
    validatedData: T
  ) => Promise<Response>
) {
  return withAuth<TParams>(async (request, context, session) => {
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
 * 支持 Next.js 15 的新 params 类型（Promise 或普通对象）
 *
 * @param handler API 处理器函数
 * @returns 包装后的处理器函数
 *
 * @example
 * // Next.js 15 动态路由
 * export const GET = withErrorHandling(async (request, context) => {
 *   const { id } = await context.params;
 *   const data = await fetchData(id);
 *   return successResponse(data);
 * });
 *
 * // 普通路由
 * export const GET = withErrorHandling(async (request) => {
 *   const data = await fetchData();
 *   return successResponse(data);
 * });
 */
export function withErrorHandling<
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
