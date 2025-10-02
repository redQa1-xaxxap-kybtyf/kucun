import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message?: string;
  title?: string;
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'destructive' | 'warning';
  onRetry?: () => void;
}

export function ErrorMessage({
  message = '发生了未知错误',
  title = '错误',
  className,
  showIcon = true,
  variant = 'destructive',
  onRetry,
}: ErrorMessageProps) {
  const variantStyles = {
    default: 'border-gray-200 bg-gray-50 text-gray-900',
    destructive: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  };

  const iconStyles = {
    default: 'text-gray-400',
    destructive: 'text-red-400',
    warning: 'text-yellow-400',
  };

  return (
    <div
      className={cn('rounded-lg border p-4', variantStyles[variant], className)}
    >
      <div className="flex">
        {showIcon && (
          <div className="shrink-0">
            <AlertTriangle
              className={cn('h-5 w-5', iconStyles[variant])}
              aria-hidden="true"
            />
          </div>
        )}
        <div className={cn('ml-3', !showIcon && 'ml-0')}>
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="mt-2 text-sm">
            <p>{message}</p>
          </div>
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorMessage;
