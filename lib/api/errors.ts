import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { env } from '@/lib/env';

/**
 * 统一错误类型枚举
 * 遵循 HTTP 状态码规范
 */
export enum ApiErrorType {
  // 客户端错误 (4xx)
  BAD_REQUEST = 'BAD_REQUEST', // 400 - 请求参数错误
  UNAUTHORIZED = 'UNAUTHORIZED', // 401 - 未授权
  FORBIDDEN = 'FORBIDDEN', // 403 - 禁止访问
  NOT_FOUND = 'NOT_FOUND', // 404 - 资源未找到
  VALIDATION_ERROR = 'VALIDATION_ERROR', // 422 - 验证错误

  // 服务器错误 (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR', // 500 - 服务器内部错误
  DATABASE_ERROR = 'DATABASE_ERROR', // 500 - 数据库错误
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR', // 502 - 外部API错误
}

/**
 * 错误类型到 HTTP 状态码的映射
 */
const ERROR_TYPE_TO_STATUS: Record<ApiErrorType, number> = {
  [ApiErrorType.BAD_REQUEST]: 400,
  [ApiErrorType.UNAUTHORIZED]: 401,
  [ApiErrorType.FORBIDDEN]: 403,
  [ApiErrorType.NOT_FOUND]: 404,
  [ApiErrorType.VALIDATION_ERROR]: 422,
  [ApiErrorType.INTERNAL_ERROR]: 500,
  [ApiErrorType.DATABASE_ERROR]: 500,
  [ApiErrorType.EXTERNAL_API_ERROR]: 502,
};

/**
 * 统一错误类
 * 用于抛出业务错误
 */
export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly errorId: string;

  constructor(
    type: ApiErrorType,
    message: string,
    details?: unknown,
    errorId?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = ERROR_TYPE_TO_STATUS[type];
    this.details = details;
    this.errorId = errorId || generateErrorId();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * 创建 400 错误
   */
  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(ApiErrorType.BAD_REQUEST, message, details);
  }

  /**
   * 创建 401 错误
   */
  static unauthorized(message = '未授权访问'): ApiError {
    return new ApiError(ApiErrorType.UNAUTHORIZED, message);
  }

  /**
   * 创建 403 错误
   */
  static forbidden(message = '禁止访问'): ApiError {
    return new ApiError(ApiErrorType.FORBIDDEN, message);
  }

  /**
   * 创建 404 错误
   */
  static notFound(resource = '资源'): ApiError {
    return new ApiError(ApiErrorType.NOT_FOUND, `${resource}未找到`);
  }

  /**
   * 创建 422 验证错误
   */
  static validationError(message: string, details?: unknown): ApiError {
    return new ApiError(ApiErrorType.VALIDATION_ERROR, message, details);
  }

  /**
   * 创建 500 内部错误
   */
  static internalError(
    message = '服务器内部错误',
    details?: unknown
  ): ApiError {
    return new ApiError(ApiErrorType.INTERNAL_ERROR, message, details);
  }

  /**
   * 创建 500 数据库错误
   */
  static databaseError(message = '数据库错误', details?: unknown): ApiError {
    return new ApiError(ApiErrorType.DATABASE_ERROR, message, details);
  }

  /**
   * 创建 502 外部API错误
   */
  static externalApiError(
    message = '外部服务错误',
    details?: unknown
  ): ApiError {
    return new ApiError(ApiErrorType.EXTERNAL_API_ERROR, message, details);
  }
}

/**
 * 生成唯一错误ID
 * 用于错误追踪和日志关联
 */
export function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `err_${timestamp}_${random}`;
}

/**
 * 判断是否是 Prisma 错误
 */
export function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError
  );
}

/**
 * 处理 Prisma 错误
 * 将 Prisma 错误转换为 ApiError
 */
export function handlePrismaError(error: unknown): ApiError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: 唯一约束冲突
    if (error.code === 'P2002') {
      const fields = (error.meta?.target as string[]) || [];
      return ApiError.badRequest(`${fields.join(', ')} 已存在`, {
        code: error.code,
        fields,
      });
    }

    // P2025: 记录未找到
    if (error.code === 'P2025') {
      return ApiError.notFound('记录');
    }

    // P2003: 外键约束失败
    if (error.code === 'P2003') {
      return ApiError.badRequest('关联数据不存在或已被删除', {
        code: error.code,
      });
    }

    // 其他已知错误
    return ApiError.databaseError('数据库操作失败', {
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return ApiError.validationError('数据验证失败', { message: error.message });
  }

  // 未知 Prisma 错误
  return ApiError.databaseError(
    '数据库错误',
    env.NODE_ENV === 'development' ? error : undefined
  );
}

/**
 * 处理 Zod 验证错误
 * 将 Zod 错误转换为 ApiError
 */
export function handleZodError(error: ZodError): ApiError {
  const details = error.issues.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return ApiError.validationError('数据验证失败', details);
}

/**
 * 判断是否是 ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * 判断是否是 ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

/**
 * 从错误中提取错误信息
 * 用于日志记录
 */
export function extractErrorInfo(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  details?: unknown;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details: isApiError(error) ? error.details : undefined,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
    details: error,
  };
}
