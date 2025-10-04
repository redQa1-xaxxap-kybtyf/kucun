/**
 * API 辅助函数
 * 提供统一的认证、参数验证等功能
 * 遵循唯一真理源原则和全栈类型安全原则
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

/**
 * 从请求头中验证用户身份
 * 中间件已经完成认证并透传 x-user-* 头信息
 * 避免重复调用 getServerSession，提升性能
 */
export function verifyApiAuth(request: NextRequest): {
  success: boolean;
  authenticated: boolean; // 为了向后兼容，同时提供两个字段
  userId?: string;
  username?: string;
  role?: string;
  error?: string;
} {
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-user-name');
  const role = request.headers.get('x-user-role');

  if (!userId || !username) {
    return {
      success: false,
      authenticated: false,
      error: '未授权访问',
    };
  }

  return {
    success: true,
    authenticated: true,
    userId,
    username,
    role: role || 'user',
  };
}

/**
 * 统一的参数验证函数
 * 使用 Zod schema 进行验证，遵循唯一真理源原则
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    // 将 URLSearchParams 转换为普通对象
    const params: Record<string, string | number> = {};

    searchParams.forEach((value, key) => {
      // 尝试将数字字符串转换为数字
      if (/^\d+$/.test(value)) {
        params[key] = parseInt(value, 10);
      } else {
        params[key] = value;
      }
    });

    // 使用 Zod schema 验证
    const result = schema.safeParse(params);

    if (!result.success) {
      // 提取第一个错误消息
      const firstError = result.error.issues[0];
      return {
        success: false,
        error: firstError?.message || '参数验证失败',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参数验证失败',
    };
  }
}

/**
 * 统一的错误响应
 */
export function errorResponse(error: string, status: number = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * 统一的成功响应
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * 统一的 API 错误处理
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API 错误:', error);

  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  return errorResponse('服务器内部错误', 500);
}
