import { Loader2 } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

export function LoadingSpinner({
  size = 'md',
  className,
  text,
  variant = 'default',
}: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const variantStyles = {
    default: 'text-gray-500',
    primary: 'text-blue-600',
    secondary: 'text-gray-400',
  };

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  if (text) {
    return (
      <div
        className={cn('flex items-center justify-center space-x-2', className)}
      >
        <Loader2
          className={cn(
            'animate-spin',
            sizeStyles[size],
            variantStyles[variant]
          )}
        />
        <span className={cn(textSizeStyles[size], variantStyles[variant])}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <Loader2
        className={cn('animate-spin', sizeStyles[size], variantStyles[variant])}
      />
    </div>
  );
}

export default LoadingSpinner;
