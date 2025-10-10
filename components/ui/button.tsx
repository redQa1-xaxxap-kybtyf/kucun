import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-medium)] text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-primary-hover))] focus-visible:ring-[hsl(var(--color-focus))]',
        destructive:
          'bg-[hsl(var(--color-error))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-error-hover))]',
        outline:
          'border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary))]',
        secondary:
          'bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-bg-card-hover))]',
        ghost:
          'text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary))]',
        link: 'text-[hsl(var(--color-primary))] underline-offset-4 hover:text-[hsl(var(--color-primary-hover))] hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
