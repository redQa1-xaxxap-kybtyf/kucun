import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context: { params?: Record<string, string> } = {}
  ) => {
    try {
      // 开发环境下绕过身份验证,使用数据库中的第一个用户
      if (env.NODE_ENV === 'development') {
        const user = await prisma.user.findFirst();
        if (!user) {
          return unauthorizedResponse('开发环境下未找到可用用户');
        }
        const mockSession = {
          user: {
            id: user.id,
            name: user.name || 'Dev User',
            username: user.username,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        return await handler(request, context, mockSession as any);
      }

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
      return new Response(JSON.stringify({ error: '服务器内部错误' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
