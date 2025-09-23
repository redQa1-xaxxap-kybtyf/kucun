import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { unauthorizedResponse } from './response';

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
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context: { params?: Record<string, string> } = {}
  ) => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return unauthorizedResponse('请先登录');
      }
      
      return await handler(request, context, session);
    } catch (error) {
      console.error('认证中间件错误:', error);
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
      return unauthorizedResponse('数据验证失败');
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
      return unauthorizedResponse('数据验证失败');
    }
  });
}

/**
 * 错误处理包装器
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
      console.error('API处理器错误:', error);
      return unauthorizedResponse('服务器内部错误');
    }
  };
}
