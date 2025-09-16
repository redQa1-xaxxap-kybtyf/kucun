import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, value, defaultValue, ...props }, ref) => {
    // 确保受控组件的一致性：如果提供了 value，则确保它不是 undefined
    // 如果没有提供 value 但提供了 defaultValue，则使用 defaultValue
    // 否则使用空字符串作为默认值
    const controlledValue =
      value !== undefined ? value : defaultValue !== undefined ? undefined : '';
    const isControlled = value !== undefined;

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...(isControlled ? { value: controlledValue } : { defaultValue })}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
