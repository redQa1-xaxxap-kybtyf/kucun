/**
 * Toast 统一封装工具
 *
 * 基于 shadcn/ui Toast 组件的统一封装，提供一致的用户体验
 *
 * @see docs/TOAST_NOTIFICATION_GUIDE.md
 */

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { toast as baseToast } from '@/components/ui/use-toast';

/**
 * Toast 配置选项
 */
export interface ToastOptions {
  /** 标题 */
  title?: string;
  /** 描述信息 */
  description?: string;
  /** 停留时长（毫秒），默认使用预设值 */
  duration?: number;
  /** 是否显示图标，默认 true */
  showIcon?: boolean;
}

/**
 * 统一的停留时长配置（毫秒）
 */
export const TOAST_DURATION = {
  /** 成功消息：3秒 */
  SUCCESS: 3000,
  /** 错误消息：5秒 */
  ERROR: 5000,
  /** 信息消息：3秒 */
  INFO: 3000,
  /** 警告消息：4秒 */
  WARNING: 4000,
} as const;

/**
 * 显示成功提示
 *
 * @example
 * ```ts
 * showSuccess('操作成功', { description: '数据已保存' });
 * ```
 */
export function showSuccess(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  const {
    description,
    duration = TOAST_DURATION.SUCCESS,
    showIcon = true,
  } = options || {};

  const content = showIcon ? (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4" />
      <div className="space-y-1">
        <span>{message}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  ) : description;

  return baseToast({
    title: showIcon ? undefined : message,
    description: content ?? undefined,
    variant: 'success',
    duration,
  });
}

/**
 * 显示错误提示
 *
 * @example
 * ```ts
 * showError('操作失败', { description: '请检查网络连接' });
 * ```
 */
export function showError(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  const {
    description,
    duration = TOAST_DURATION.ERROR,
    showIcon = true,
  } = options || {};

  const content = showIcon ? (
    <div className="flex items-start gap-2">
      <AlertCircle className="mt-0.5 h-4 w-4" />
      <div className="space-y-1">
        <span>{message}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  ) : description;

  return baseToast({
    title: showIcon ? undefined : message,
    description: content ?? undefined,
    variant: 'destructive',
    duration,
  });
}

/**
 * 显示信息提示
 *
 * @example
 * ```ts
 * showInfo('提示', { description: '这是一条信息' });
 * ```
 */
export function showInfo(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  const {
    description,
    duration = TOAST_DURATION.INFO,
    showIcon = true,
  } = options || {};

  const content = showIcon ? (
    <div className="flex items-start gap-2">
      <Info className="mt-0.5 h-4 w-4" />
      <div className="space-y-1">
        <span>{message}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  ) : description;

  return baseToast({
    title: showIcon ? undefined : message,
    description: content ?? undefined,
    variant: 'default',
    duration,
  });
}

/**
 * 显示警告提示
 *
 * @example
 * ```ts
 * showWarning('注意', { description: '此操作不可撤销' });
 * ```
 */
export function showWarning(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  const {
    description,
    duration = TOAST_DURATION.WARNING,
    showIcon = true,
  } = options || {};

  const content = showIcon ? (
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 h-4 w-4" />
      <div className="space-y-1">
        <span>{message}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  ) : description;

  return baseToast({
    title: showIcon ? undefined : message,
    description: content ?? undefined,
    variant: 'default',
    duration,
    className:
      'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  });
}

/**
 * Toast 辅助工具集合
 */
export const toastHelper = {
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
  duration: TOAST_DURATION,
} as const;
