// 仪表盘快速操作组件
// 提供常用操作的快速入口

'use client';

import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getColorConfig } from '@/lib/config/dashboard';
import type { QuickAction } from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';

// 图标映射
const ICON_MAP = {
  plus: Plus,
  'shopping-cart': ShoppingCart,
  package: Package,
  users: Users,
  'rotate-ccw': RotateCcw,
  upload: Upload,
  download: Download,
  'bar-chart-3': BarChart3,
  settings: Settings,
  search: Search,
  'file-text': FileText,
  truck: Truck,
  'alert-triangle': AlertTriangle,
} as const;

export interface QuickActionItemProps {
  action: QuickAction;
  onClick?: (action: QuickAction) => void;
  compact?: boolean;
  className?: string;
}

const QuickActionItem = React.forwardRef<HTMLDivElement, QuickActionItemProps>(
  ({ action, onClick, compact = false, className, ...props }, ref) => {
    const IconComponent =
      ICON_MAP[action.icon as keyof typeof ICON_MAP] || Package;
    const colorConfig = getColorConfig(action.color);

    const handleClick = () => {
      if (onClick) {
        onClick(action);
      }
    };

    if (compact) {
      return (
        <Link href={action.href}>
          <div
            className={cn(
              'flex cursor-pointer items-center space-x-3 rounded-lg border p-3 transition-all duration-200',
              colorConfig.bg,
              colorConfig.border,
              className
            )}
            ref={ref}
            onClick={handleClick}
            {...props}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                colorConfig.bg.replace('hover:', '').replace('50', '100')
              )}
            >
              <IconComponent className={cn('h-4 w-4', colorConfig.icon)} />
            </div>

            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', colorConfig.text)}>
                {action.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>

            {action.badge && (
              <Badge
                variant={action.badge.variant}
                className="flex-shrink-0 text-xs"
              >
                {action.badge.text}
              </Badge>
            )}
          </div>
        </Link>
      );
    }

    return (
      <Link href={action.href}>
        <Card
          className={cn(
            'cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md',
            colorConfig.border,
            className
          )}
          ref={ref}
          onClick={handleClick}
          {...props}
        >
          <CardContent className={cn('p-6', colorConfig.bg)}>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      colorConfig.bg.replace('hover:', '').replace('50', '100'),
                      colorConfig.border.replace('hover:', '')
                    )}
                  >
                    <IconComponent
                      className={cn('h-5 w-5', colorConfig.icon)}
                    />
                  </div>
                  {action.badge && (
                    <Badge variant={action.badge.variant} className="text-xs">
                      {action.badge.text}
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className={cn('text-sm font-semibold', colorConfig.text)}>
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }
);

QuickActionItem.displayName = 'QuickActionItem';

export interface QuickActionsProps {
  actions: QuickAction[];
  loading?: boolean;
  onActionClick?: (action: QuickAction) => void;
  showHeader?: boolean;
  compact?: boolean;
  columns?: number;
  className?: string;
}

const QuickActions = React.forwardRef<HTMLDivElement, QuickActionsProps>(
  (
    {
      actions,
      loading = false,
      onActionClick,
      showHeader = true,
      compact = false,
      columns = 3,
      className,
      ...props
    },
    ref
  ) => {
    // 使用统一配置的默认快速操作
    const defaultActions = React.useMemo(() => DEFAULT_QUICK_ACTIONS, []);

    const displayActions = actions.length > 0 ? actions : defaultActions;

    if (loading) {
      return (
        <Card className={className} ref={ref} {...props}>
          {showHeader && (
            <CardHeader>
              <Skeleton className="mb-2 h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
          )}
          <CardContent>
            <div
              className={cn(
                'grid gap-4',
                compact
                  ? 'grid-cols-1'
                  : `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
              )}
            >
              {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={className} ref={ref} {...props}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>快速操作</span>
            </CardTitle>
            <CardDescription>常用功能快速入口</CardDescription>
          </CardHeader>
        )}

        <CardContent>
          {displayActions.length === 0 ? (
            <div className="py-8 text-center">
              <Plus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">暂无快速操作</p>
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                compact
                  ? 'grid-cols-1'
                  : `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
              )}
            >
              {displayActions.map(action => (
                <QuickActionItem
                  key={action.id}
                  action={action}
                  onClick={onActionClick}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

QuickActions.displayName = 'QuickActions';

// 快速操作按钮组（用于移动端）
export interface QuickActionButtonsProps {
  actions: QuickAction[];
  maxVisible?: number;
  className?: string;
}

const QuickActionButtons = React.forwardRef<
  HTMLDivElement,
  QuickActionButtonsProps
>(({ actions, maxVisible = 4, className, ...props }, ref) => {
  const visibleActions = actions.slice(0, maxVisible);

  return (
    <div className={cn('flex flex-wrap gap-2', className)} ref={ref} {...props}>
      {visibleActions.map(action => {
        const IconComponent =
          ICON_MAP[action.icon as keyof typeof ICON_MAP] || Package;
        const colorConfig = getColorConfig(action.color);

        return (
          <Link key={action.id} href={action.href}>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex items-center space-x-2',
                colorConfig.border,
                colorConfig.bg,
                colorConfig.text
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span>{action.title}</span>
              {action.badge && (
                <Badge variant={action.badge.variant} className="ml-1 text-xs">
                  {action.badge.text}
                </Badge>
              )}
            </Button>
          </Link>
        );
      })}

      {actions.length > maxVisible && (
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          更多 ({actions.length - maxVisible})
        </Button>
      )}
    </div>
  );
});

QuickActionButtons.displayName = 'QuickActionButtons';

export { QuickActionButtons, QuickActionItem, QuickActions };
