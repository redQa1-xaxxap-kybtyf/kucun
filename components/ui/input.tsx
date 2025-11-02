import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  (
    { className, type, value, defaultValue, onFocus, inputMode, ...props },
    ref
  ) => {
    // 简化受控/非受控组件逻辑
    // 如果提供了 value 属性，则使用受控模式
    // 否则使用非受控模式
    const inputProps =
      value !== undefined
        ? { value: value ?? '' } // 受控模式：确保 value 不为 undefined，同时保留0等有效值
        : defaultValue !== undefined
          ? { defaultValue: defaultValue ?? '' } // 非受控模式：使用 defaultValue
          : {}; // 完全非受控模式

    // 处理焦点事件：数字输入框自动全选内容
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // 对于数字类型的输入框（type="number" 或 inputMode="decimal"/"numeric"），
      // 聚焦时自动全选内容，方便用户直接输入新值覆盖默认值
      if (
        type === 'number' ||
        inputMode === 'decimal' ||
        inputMode === 'numeric'
      ) {
        e.target.select();
      }
      // 保留原有的 onFocus 回调
      onFocus?.(e);
    };

    return (
      <input
        type={type}
        inputMode={inputMode}
        className={cn(
          'border-input bg-background ring-offset-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          // 隐藏数字输入框的增减控件（spinner）
          type === 'number' &&
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className
        )}
        ref={ref}
        onFocus={handleFocus}
        {...inputProps}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
