'use client';

import { AlertCircle, ArrowLeft, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

/**
 * 错误类型枚举
 */
export type ErrorType =
  | 'network'
  | 'permission'
  | 'filter'
  | 'server'
  | 'unknown';

/**
 * 错误边界回退组件的属性
 */
export interface ErrorBoundaryFallbackProps {
  /** 错误对象 */
  error: Error | unknown;
  /** 重试回调 */
  onRetry?: () => void;
  /** 清空筛选回调 */
  onClearFilters?: () => void;
  /** 返回回调 */
  onGoBack?: () => void;
  /** 自定义错误类型 */
  errorType?: ErrorType;
}

/**
 * 根据错误对象判断错误类型
 */
export function getErrorType(error: Error | unknown): ErrorType {
  if (!error) return 'unknown';

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // 网络错误
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('连接') ||
    lowerMessage.includes('网络')
  ) {
    return 'network';
  }

  // 权限错误
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('权限') ||
    lowerMessage.includes('未授权')
  ) {
    return 'permission';
  }

  // 筛选错误（无数据）
  if (
    lowerMessage.includes('no data') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('无数据') ||
    lowerMessage.includes('未找到')
  ) {
    return 'filter';
  }

  // 服务器错误
  if (
    lowerMessage.includes('server') ||
    lowerMessage.includes('500') ||
    lowerMessage.includes('503') ||
    lowerMessage.includes('服务器')
  ) {
    return 'server';
  }

  return 'unknown';
}

/**
 * 获取错误标题
 */
function getErrorTitle(errorType: ErrorType): string {
  switch (errorType) {
    case 'network':
      return '网络连接失败';
    case 'permission':
      return '权限不足';
    case 'filter':
      return '未找到数据';
    case 'server':
      return '服务器错误';
    default:
      return '加载失败';
  }
}

/**
 * 获取错误描述
 */
function getErrorDescription(
  error: Error | unknown,
  errorType: ErrorType
): string {
  const errorMessage = getFriendlyErrorMessage(
    error,
    '页面暂时无法打开，请稍后重试'
  );

  switch (errorType) {
    case 'network':
      return '请检查网络后再试';
    case 'permission':
      return '当前账号暂时无法查看这部分内容';
    case 'filter':
      return '按现在的筛选条件还没有查到内容';
    case 'server':
      return '系统暂时忙，请稍后再试';
    default:
      return errorMessage || '页面暂时无法打开，请稍后重试';
  }
}

/**
 * 错误边界回退组件
 *
 * 提供友好的错误提示和多种恢复选项
 */
export function ErrorBoundaryFallback({
  error,
  onRetry,
  onClearFilters,
  onGoBack,
  errorType: customErrorType,
}: ErrorBoundaryFallbackProps) {
  const router = useRouter();
  const errorType = customErrorType || getErrorType(error);
  const title = getErrorTitle(errorType);
  const description = getErrorDescription(error, errorType);

  // 默认的返回处理
  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      router.back();
    }
  };

  // 默认的重试处理
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] p-8 text-center shadow-sm">
        {/* 错误图标 */}
        <div className="bg-opacity-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--color-error))]">
          <AlertCircle className="h-8 w-8 text-[hsl(var(--color-error))]" />
        </div>

        {/* 错误标题 */}
        <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>

        {/* 错误描述 */}
        <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
          {description}
        </p>

        {/* 详细错误信息（开发环境） */}
        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              查看开发调试信息
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700">
              {error.stack || error.message}
            </pre>
          </details>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/* 返回按钮 */}
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="min-w-[100px]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>

          {/* 清空筛选按钮（仅在筛选错误时显示） */}
          {errorType === 'filter' && onClearFilters && (
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="min-w-[100px]"
            >
              <X className="mr-2 h-4 w-4" />
              清空筛选
            </Button>
          )}

          {/* 重试按钮 */}
          <Button onClick={handleRetry} className="min-w-[100px]">
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    </div>
  );
}
