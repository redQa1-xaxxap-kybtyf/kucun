'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, indicatorClassName, indicatorStyle, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-3 w-full overflow-hidden rounded-full bg-[hsl(var(--color-border-secondary))]',
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'flex h-full w-full flex-1 [transform:translateX(calc(var(--progress)*1%-100%))] bg-[hsl(var(--color-primary))] transition-all',
        indicatorClassName
      )}
      style={
        {
          '--progress': value ?? 0,
          ...indicatorStyle,
        } as React.CSSProperties
      }
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
