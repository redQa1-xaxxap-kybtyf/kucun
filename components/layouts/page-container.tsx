import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bannerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  maxWidthClassName?: string;
  padded?: boolean;
  headerVariant?: 'gradient' | 'solid';
  headerIconBgColor?: string;
  headerShowBorder?: boolean;
}

export function PageContainer({
  title,
  description,
  icon,
  actions,
  banner,
  footer,
  children,
  className,
  headerClassName,
  bannerClassName,
  bodyClassName,
  footerClassName,
  maxWidthClassName = 'max-w-5xl',
  padded = true,
  headerVariant = 'gradient',
  headerIconBgColor = 'hsl(var(--color-primary))',
  headerShowBorder = true,
}: PageContainerProps) {
  const hasHeader = Boolean(title || description || actions || icon);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-[hsl(var(--color-bg-primary))]',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full min-h-0 flex-1 flex-col',
          maxWidthClassName
        )}
      >
        {hasHeader && (
          <div className={cn('px-4 pt-4 sm:px-6 sm:pt-6', headerClassName)}>
            <PageHeader
              title={title ?? ''}
              description={description ?? null}
              icon={icon}
              actions={actions}
              variant={headerVariant}
              iconBgColor={headerIconBgColor}
              showBorder={headerShowBorder}
            />
          </div>
        )}

        {banner && (
          <div className={cn('px-4 pt-4 sm:px-6', bannerClassName)}>
            {banner}
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-auto',
            padded && 'px-4 py-4 sm:px-6 sm:py-6',
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>

      {footer && (
        <div
          className={cn(
            'sticky bottom-0 z-20 border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]/95 backdrop-blur-md',
            footerClassName
          )}
        >
          <div
            className={cn(
              'mx-auto w-full px-4 py-3 sm:px-6 sm:py-4',
              'pb-[calc(env(safe-area-inset-bottom)+12px)]',
              maxWidthClassName
            )}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
