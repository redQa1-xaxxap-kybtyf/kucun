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

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// 颜色配置 - 使用CSS变量统一颜色
// ✅ 使用项目定义的CSS变量替代硬编码颜色
const COLOR_CONFIG = {
  blue: {
    bg: 'bg-[hsl(var(--color-info-light))] hover:bg-[hsl(var(--color-info-light))]/80',
    text: 'text-[hsl(var(--color-info))]',
    icon: 'text-[hsl(var(--color-info))]',
    border:
      'border-[hsl(var(--color-info-light))] hover:border-[hsl(var(--color-info))]',
  },
  green: {
    bg: 'bg-[hsl(var(--color-success-light))] hover:bg-[hsl(var(--color-success-light))]/80',
    text: 'text-[hsl(var(--color-success))]',
    icon: 'text-[hsl(var(--color-success))]',
    border:
      'border-[hsl(var(--color-success-light))] hover:border-[hsl(var(--color-success))]',
  },
  yellow: {
    bg: 'bg-[hsl(var(--color-warning-light))] hover:bg-[hsl(var(--color-warning-light))]/80',
    text: 'text-[hsl(var(--color-warning))]',
    icon: 'text-[hsl(var(--color-warning))]',
    border:
      'border-[hsl(var(--color-warning-light))] hover:border-[hsl(var(--color-warning))]',
  },
  red: {
    bg: 'bg-[hsl(var(--color-error-light))] hover:bg-[hsl(var(--color-error-light))]/80',
    text: 'text-[hsl(var(--color-error))]',
    icon: 'text-[hsl(var(--color-error))]',
    border:
      'border-[hsl(var(--color-error-light))] hover:border-[hsl(var(--color-error))]',
  },
  purple: {
    bg: 'bg-[hsl(var(--color-purple-light))] hover:bg-[hsl(var(--color-purple-light))]/80',
    text: 'text-[hsl(var(--color-purple))]',
    icon: 'text-[hsl(var(--color-purple))]',
    border:
      'border-[hsl(var(--color-purple-light))] hover:border-[hsl(var(--color-purple))]',
  },
  gray: {
    bg: 'bg-[hsl(var(--color-bg-tertiary))] hover:bg-[hsl(var(--color-bg-tertiary))]/80',
    text: 'text-[hsl(var(--color-text-secondary))]',
    icon: 'text-[hsl(var(--color-text-secondary))]',
    border:
      'border-[hsl(var(--color-border-secondary))] hover:border-[hsl(var(--color-border))]',
  },
  orange: {
    bg: 'bg-[hsl(var(--color-warning-light))] hover:bg-[hsl(var(--color-warning-light))]/80',
    text: 'text-[hsl(var(--color-warning))]',
    icon: 'text-[hsl(var(--color-warning))]',
    border:
      'border-[hsl(var(--color-warning-light))] hover:border-[hsl(var(--color-warning))]',
  },
  indigo: {
    bg: 'bg-[hsl(var(--color-info-light))] hover:bg-[hsl(var(--color-info-light))]/80',
    text: 'text-[hsl(var(--color-info))]',
    icon: 'text-[hsl(var(--color-info))]',
    border:
      'border-[hsl(var(--color-info-light))] hover:border-[hsl(var(--color-info))]',
  },
} as const;

// 默认颜色配置（防御性编程）
const DEFAULT_COLOR_CONFIG = {
  bg: 'bg-[hsl(var(--color-bg-tertiary))] hover:bg-[hsl(var(--color-bg-tertiary))]/80',
  text: 'text-[hsl(var(--color-text-secondary))]',
  icon: 'text-[hsl(var(--color-text-secondary))]',
  border:
    'border-[hsl(var(--color-border-secondary))] hover:border-[hsl(var(--color-border))]',
};

// 类型安全的颜色配置获取函数
const getColorConfig = (color: string) =>
  COLOR_CONFIG[color as keyof typeof COLOR_CONFIG] || DEFAULT_COLOR_CONFIG;

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
        <Link href={action.href} prefetch={false}>
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
              <p className="text-muted-foreground truncate text-xs">
                {action.description}
              </p>
            </div>

            {action.badge && (
              <Badge
                variant={action.badge.variant}
                className="shrink-0 text-xs"
              >
                {action.badge.text}
              </Badge>
            )}
          </div>
        </Link>
      );
    }

    return (
      <Link href={action.href} prefetch={false}>
        <Card
          className={cn(
            'cursor-pointer hover:shadow-sm',
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
                  <p className="text-muted-foreground mt-1 text-xs">
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
    // 默认快速操作（当没有数据时显示）
    const defaultActions: QuickAction[] = React.useMemo(
      () => [
        {
          id: 'create-sales-order',
          title: '新建销售订单',
          description: '录入新的销售订单',
          icon: 'shopping-cart',
          href: '/sales-orders/create',
          color: 'blue',
        },
        {
          id: 'add-product',
          title: '新建产品',
          description: '新建产品信息',
          icon: 'package',
          href: '/products/create',
          color: 'green',
        },
        {
          id: 'add-customer',
          title: '新建客户',
          description: '新建客户信息',
          icon: 'users',
          href: '/customers/create',
          color: 'purple',
        },
        {
          id: 'inventory-inbound',
          title: '产品入库',
          description: '新增入库记录',
          icon: 'upload',
          href: '/inventory/inbound',
          color: 'yellow',
        },
        {
          id: 'inventory-outbound',
          title: '产品出库',
          description: '新增出库记录',
          icon: 'download',
          href: '/inventory/outbound',
          color: 'red',
        },

        {
          id: 'process-returns',
          title: '退货订单',
          description: '查看待处理退货',
          icon: 'rotate-ccw',
          href: '/return-orders',
          color: 'yellow',
          badge: {
            text: '待处理',
            variant: 'secondary',
          },
        },
        {
          id: 'inventory-alerts',
          title: '库存预警',
          description: '查看库存预警',
          icon: 'alert-triangle',
          href: '/inventory?filter=alerts',
          color: 'red',
          badge: {
            text: '预警',
            variant: 'destructive',
          },
        },
        {
          id: 'reports',
          title: '业务报表',
          description: '查看业务报表',
          icon: 'bar-chart-3',
          href: '/reports',
          color: 'blue',
        },
      ],
      []
    );

    const displayActions = actions.length > 0 ? actions : defaultActions;

    if (loading) {
      return (
        <Card className={className} ref={ref} {...props}>
          <CardContent className="p-6">
            <ContentLoading text="加载快速操作..." />
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
          </CardHeader>
        )}

        <CardContent>
          {displayActions.length === 0 ? (
            <div className="py-8 text-center">
              <Plus className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
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
