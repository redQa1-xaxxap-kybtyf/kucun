import { NextResponse } from 'next/server';

/**
 * 统一的API响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response, { status });
}

/**
 * 创建错误响应
 */
export function errorResponse(
  error: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error,
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    console.error('API Error:', error, details);
  }
  
  return NextResponse.json(response, { status });
}

/**
 * 创建验证错误响应
 */
export function validationErrorResponse(
  error: string,
  details?: unknown
): NextResponse {
  return errorResponse(error, 400, details);
}

/**
 * 创建认证错误响应
 */
export function unauthorizedResponse(
  error: string = '未授权访问'
): NextResponse {
  return errorResponse(error, 401);
}

/**
 * 创建禁止访问响应
 */
export function forbiddenResponse(
  error: string = '禁止访问'
): NextResponse {
  return errorResponse(error, 403);
}

/**
 * 创建未找到响应
 */
export function notFoundResponse(
  error: string = '资源未找到'
): NextResponse {
  return errorResponse(error, 404);
}

/**
 * 创建服务器错误响应
 */
export function serverErrorResponse(
  error: string = '服务器内部错误',
  details?: unknown
): NextResponse {
  return errorResponse(error, 500, details);
}
