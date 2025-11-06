/**
 * 加载动画组件
 */

import { cn } from '@/lib/utils';

export interface SpinnerProps {
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 类名 */
  className?: string;
}

/**
 * 旋转加载动画
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="加载中"
    >
      <span className="sr-only">加载中...</span>
    </div>
  );
}
