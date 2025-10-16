import { Inbox } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode | null;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  fullHeight?: boolean;
  align?: 'center' | 'start';
}

export function EmptyState({
  icon,
  title = '暂无数据',
  description,
  action,
  className,
  compact = false,
  fullHeight = false,
  align = 'center',
}: EmptyStateProps) {
  const shouldRenderIcon = icon !== null;
  const resolvedIcon =
    icon === undefined ? (
      <Inbox className="text-muted-foreground h-6 w-6" aria-hidden="true" />
    ) : (
      icon
    );

  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-12',
        fullHeight && 'h-full',
        align === 'start' && 'items-start text-left',
        className
      )}
    >
      {shouldRenderIcon && resolvedIcon && (
        <div
          className={cn(
            'bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            align === 'start' && 'justify-start'
          )}
        >
          {React.isValidElement(resolvedIcon)
            ? React.cloneElement(resolvedIcon, {
                className: cn(
                  'h-6 w-6 text-muted-foreground',
                  resolvedIcon.props.className
                ),
              })
            : resolvedIcon}
        </div>
      )}
      {title && (
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
      )}
      {description && (
        <div className="text-muted-foreground mt-2 text-sm">{description}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

EmptyState.displayName = 'EmptyState';
