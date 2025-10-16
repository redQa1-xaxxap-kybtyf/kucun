/**
 * 统一的加载状态组件
 *
 * 提供统一的加载状态显示，包括：
 * - 页面加载
 * - 内容加载
 * - 按钮加载
 * - 卡片加载
 *
 * @see docs/LOADING_STATE_GUIDE.md
 */

'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * 加载状态变体
 */
export type LoadingVariant = 'page' | 'content' | 'inline' | 'card';

/**
 * 加载状态大小
 */
export type LoadingSize = 'sm' | 'md' | 'lg';

/**
 * 加载状态属性
 */
export interface LoadingProps {
  /**
   * 加载状态变体
   * @default 'content'
   */
  variant?: LoadingVariant;

  /**
   * 加载状态大小
   * @default 'md'
   */
  size?: LoadingSize;

  /**
   * 加载文本
   */
  text?: string;

  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 获取图标大小
 */
function getIconSize(size: LoadingSize): string {
  switch (size) {
    case 'sm':
      return 'h-4 w-4';
    case 'lg':
      return 'h-12 w-12';
    default:
      return 'h-8 w-8';
  }
}

/**
 * 加载状态组件
 *
 * @example
 * ```tsx
 * // 页面加载
 * <Loading variant="page" text="加载中..." />
 *
 * // 内容加载
 * <Loading variant="content" />
 *
 * // 行内加载
 * <Loading variant="inline" size="sm" />
 * ```
 */
export function Loading({
  variant = 'content',
  size = 'md',
  text,
  className = '',
}: LoadingProps) {
  const iconSize = getIconSize(size);

  // 页面加载
  if (variant === 'page') {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${className}`}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className={`${iconSize} text-muted-foreground animate-spin`}
          />
          {text && <p className="text-muted-foreground text-sm">{text}</p>}
        </div>
      </div>
    );
  }

  // 内容加载
  if (variant === 'content') {
    return (
      <div
        className={`flex min-h-[400px] items-center justify-center ${className}`}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className={`${iconSize} text-muted-foreground animate-spin`}
          />
          {text && <p className="text-muted-foreground text-sm">{text}</p>}
        </div>
      </div>
    );
  }

  // 行内加载
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className={`${iconSize} text-muted-foreground animate-spin`} />
        {text && <span className="text-muted-foreground text-sm">{text}</span>}
      </div>
    );
  }

  // 卡片加载
  if (variant === 'card') {
    return (
      <div className={`rounded-lg border p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2
              className={`${iconSize} text-muted-foreground animate-spin`}
            />
            {text && <p className="text-muted-foreground text-sm">{text}</p>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * 页面加载组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <PageLoading text="加载中..." />;
 * }
 * ```
 */
export function PageLoading({ text }: { text?: string }) {
  return <Loading variant="page" text={text} />;
}

/**
 * 内容加载组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <ContentLoading />;
 * }
 * ```
 */
export function ContentLoading({ text }: { text?: string }) {
  return <Loading variant="content" text={text} />;
}

/**
 * 行内加载组件
 *
 * @example
 * ```tsx
 * <Button disabled={isLoading}>
 *   {isLoading ? <InlineLoading size="sm" /> : '提交'}
 * </Button>
 * ```
 */
export function InlineLoading({
  text,
  size = 'sm',
  className,
}: {
  text?: string;
  size?: LoadingSize;
  className?: string;
}) {
  return (
    <Loading variant="inline" size={size} text={text} className={className} />
  );
}

/**
 * 卡片加载组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <CardLoading />;
 * }
 * ```
 */
export function CardLoading({ text }: { text?: string }) {
  return <Loading variant="card" text={text} />;
}

/**
 * 卡片骨架屏组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <CardSkeleton />;
 * }
 * ```
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * 表格骨架屏组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <TableSkeleton rows={5} columns={4} />;
 * }
 * ```
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 列表骨架屏组件
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <ListSkeleton items={5} />;
 * }
 * ```
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
