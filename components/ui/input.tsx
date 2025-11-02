import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, value, defaultValue, ...props }, ref) => {
    // 简化受控/非受控组件逻辑
    // 如果提供了 value 属性，则使用受控模式
    // 否则使用非受控模式
    const inputProps =
      value !== undefined
        ? { value: value ?? '' } // 受控模式：确保 value 不为 undefined，同时保留0等有效值
        : defaultValue !== undefined
          ? { defaultValue: defaultValue ?? '' } // 非受控模式：使用 defaultValue
          : {}; // 完全非受控模式

    return (
      <input
        type={type}
        className={cn(
          'border-input bg-background ring-offset-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          // 隐藏数字输入框的增减控件（spinner）
          type === 'number' &&
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className
        )}
        ref={ref}
        {...inputProps}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
