import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-focus))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-primary-hover))]',
        secondary:
          'border-transparent bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-bg-card-hover))]',
        destructive:
          'border-transparent bg-[hsl(var(--color-error))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-error-hover))]',
        success:
          'border-transparent bg-[hsl(var(--color-success))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-success-hover))]',
        warning:
          'border-transparent bg-[hsl(var(--color-warning))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-warning-hover))]',
        info: 'border-transparent bg-[hsl(var(--color-info))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-info-hover))]',
        purple:
          'border-transparent bg-[hsl(var(--color-purple-light))] text-[hsl(var(--color-purple))] hover:bg-[hsl(var(--color-purple-hover))]',
        outline:
          'border-[hsl(var(--color-border-secondary))] text-[hsl(var(--color-text-secondary))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
