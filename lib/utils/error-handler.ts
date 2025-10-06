/**
 * 错误处理统一工具
 * 
 * 提供统一的错误类型、错误处理函数和错误信息格式化
 * 
 * @see docs/ERROR_HANDLING_GUIDE.md
 */

import { showError } from './toast-helper';

/**
 * 应用错误类
 * 
 * 统一的错误类型，包含错误码、HTTP 状态码等信息
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    
    // 保持正确的原型链
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 判断是否为客户端错误（4xx）
   */
  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * 判断是否为服务器错误（5xx）
   */
  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }

  /**
   * 判断是否为网络错误
   */
  isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'FETCH_ERROR';
  }

  /**
   * 判断是否为认证错误
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  /**
   * 判断是否为权限错误
   */
  isForbiddenError(): boolean {
    return this.statusCode === 403 || this.code === 'FORBIDDEN';
  }

  /**
   * 判断是否为验证错误
   */
  isValidationError(): boolean {
    return this.statusCode === 422 || this.code === 'VALIDATION_ERROR';
  }
}

/**
 * 错误类型枚举
 */
export const ErrorCode = {
  // 网络错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // 业务错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // 服务器错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // 未知错误
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * 错误信息映射
 */
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [ErrorCode.FETCH_ERROR]: '请求失败，请稍后重试',
  [ErrorCode.TIMEOUT]: '请求超时，请稍后重试',
  [ErrorCode.UNAUTHORIZED]: '未登录或登录已过期，请重新登录',
  [ErrorCode.FORBIDDEN]: '没有权限执行此操作',
  [ErrorCode.VALIDATION_ERROR]: '输入数据验证失败',
  [ErrorCode.INVALID_INPUT]: '输入数据格式不正确',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.ALREADY_EXISTS]: '资源已存在',
  [ErrorCode.OPERATION_FAILED]: '操作失败，请重试',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
  [ErrorCode.UNKNOWN]: '未知错误，请联系管理员',
};

/**
 * 从 HTTP 状态码获取错误码
 */
function getErrorCodeFromStatus(status: number): string {
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 422) return ErrorCode.VALIDATION_ERROR;
  if (status >= 500) return ErrorCode.INTERNAL_ERROR;
  return ErrorCode.UNKNOWN;
}

/**
 * 处理 API 错误
 * 
 * 将各种类型的错误统一转换为 AppError
 * 
 * @example
 * ```ts
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const appError = handleApiError(error);
 *   showError(appError.message);
 * }
 * ```
 */
export function handleApiError(error: unknown): AppError {
  // 已经是 AppError，直接返回
  if (error instanceof AppError) {
    return error;
  }

  // Fetch API 错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError(
      ERROR_MESSAGES[ErrorCode.NETWORK_ERROR],
      ErrorCode.NETWORK_ERROR
    );
  }

  // Response 错误
  if (error instanceof Response) {
    const code = getErrorCodeFromStatus(error.status);
    return new AppError(
      ERROR_MESSAGES[code] || error.statusText,
      code,
      error.status
    );
  }

  // 标准 Error 对象
  if (error instanceof Error) {
    return new AppError(
      error.message || ERROR_MESSAGES[ErrorCode.UNKNOWN],
      ErrorCode.UNKNOWN
    );
  }

  // 对象类型错误（可能来自 API 响应）
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // 检查是否有 message 字段
    if (typeof err.message === 'string') {
      return new AppError(
        err.message,
        typeof err.code === 'string' ? err.code : ErrorCode.UNKNOWN,
        typeof err.statusCode === 'number' ? err.statusCode : undefined,
        err.details
      );
    }

    // 检查是否有 error 字段
    if (typeof err.error === 'string') {
      return new AppError(
        err.error,
        typeof err.code === 'string' ? err.code : ErrorCode.UNKNOWN
      );
    }
  }

  // 字符串类型错误
  if (typeof error === 'string') {
    return new AppError(error, ErrorCode.UNKNOWN);
  }

  // 未知类型错误
  return new AppError(
    ERROR_MESSAGES[ErrorCode.UNKNOWN],
    ErrorCode.UNKNOWN,
    undefined,
    error
  );
}

/**
 * 处理 API 错误并显示 Toast
 * 
 * @example
 * ```ts
 * try {
 *   await apiCall();
 * } catch (error) {
 *   handleApiErrorWithToast(error);
 * }
 * ```
 */
export function handleApiErrorWithToast(
  error: unknown,
  customMessage?: string
): AppError {
  const appError = handleApiError(error);
  
  showError(customMessage || '操作失败', {
    description: appError.message,
  });
  
  return appError;
}

/**
 * 处理表单验证错误
 * 
 * @example
 * ```ts
 * try {
 *   await submitForm(data);
 * } catch (error) {
 *   const validationError = handleValidationError(error);
 *   // 设置表单错误
 *   form.setError('field', { message: validationError.message });
 * }
 * ```
 */
export function handleValidationError(error: unknown): AppError {
  const appError = handleApiError(error);
  
  // 如果不是验证错误，转换为验证错误
  if (!appError.isValidationError()) {
    return new AppError(
      appError.message,
      ErrorCode.VALIDATION_ERROR,
      422,
      appError.details
    );
  }
  
  return appError;
}

/**
 * 安全地获取错误信息
 * 
 * @example
 * ```ts
 * const message = getErrorMessage(error);
 * console.error(message);
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') {
      return err.message;
    }
    if (typeof err.error === 'string') {
      return err.error;
    }
  }
  
  return ERROR_MESSAGES[ErrorCode.UNKNOWN];
}

/**
 * 判断是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isNetworkError();
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  return false;
}

/**
 * 判断是否为认证错误
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isAuthError();
  }
  
  if (error instanceof Response && error.status === 401) {
    return true;
  }
  
  return false;
}

