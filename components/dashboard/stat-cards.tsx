// 仪表盘统计卡片组件
// 展示关键业务指标的统计卡片

'use client';

import {
  AlertTriangle,
  ArrowRight,
  BadgeJapaneseYen,
  Minus,
  Package,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { dashboardUtils } from '@/lib/api/dashboard';
import type { BusinessOverview, StatCard } from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';

// 图标映射
const ICON_MAP = {
  'dollar-sign': BadgeJapaneseYen,
  'shopping-cart': ShoppingCart,
  package: Package,
  users: Users,
  'alert-triangle': AlertTriangle,
  'rotate-ccw': RotateCcw,
} as const;

// 颜色映射
const COLOR_MAP = {
  blue: {
    bg: 'bg-[hsl(var(--color-primary-light))]',
    icon: 'text-[hsl(var(--color-primary))]',
    border: 'border-[hsl(var(--color-primary-lighter))] border-opacity-60',
  },
  green: {
    bg: 'bg-[hsl(var(--color-success-light))]',
    icon: 'text-[hsl(var(--color-success))]',
    border: 'border-[hsl(var(--color-success-light))] border-opacity-60',
  },
  yellow: {
    bg: 'bg-[hsl(var(--color-warning-light))]',
    icon: 'text-[hsl(var(--color-warning))]',
    border: 'border-[hsl(var(--color-warning-light))] border-opacity-60',
  },
  red: {
    bg: 'bg-[hsl(var(--color-error-light))]',
    icon: 'text-[hsl(var(--color-error))]',
    border: 'border-[hsl(var(--color-error-light))] border-opacity-60',
  },
  purple: {
    bg: 'bg-[hsl(var(--color-purple-light))]',
    icon: 'text-[hsl(var(--color-purple))]',
    border: 'border-[hsl(var(--color-purple-light))] border-opacity-60',
  },
  gray: {
    bg: 'bg-[hsl(var(--color-bg-tertiary))]',
    icon: 'text-[hsl(var(--color-text-secondary))]',
    border: 'border-[hsl(var(--color-border-secondary))]',
  },
} as const;

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  icon: keyof typeof ICON_MAP;
  color: keyof typeof COLOR_MAP;
  href?: string;
  loading?: boolean;
  className?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      change,
      icon,
      color,
      href,
      loading = false,
      className,
      ...props
    },
    ref
  ) => {
    const IconComponent = ICON_MAP[icon];
    const colorClasses = COLOR_MAP[color];

    if (loading) {
      return (
        <Card className={cn('', className)} ref={ref} {...props}>
          <CardContent className="p-6">
            <ContentLoading text="加载中..." />
          </CardContent>
        </Card>
      );
    }

    // 卡片内容
    const cardContent = (
      <Card
        className={cn(
          'group relative overflow-hidden shadow-sm',
          href && 'cursor-pointer hover:shadow-sm',
          className
        )}
        ref={ref}
        {...props}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm font-medium">
                {title}
              </p>
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold tracking-tight">
                  {typeof value === 'number'
                    ? dashboardUtils.formatNumber(value)
                    : value}
                </p>
                {change && (
                  <div className="flex items-center space-x-1">
                    {change.type === 'increase' && (
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--color-success))]" />
                    )}
                    {change.type === 'decrease' && (
                      <TrendingDown className="h-4 w-4 text-[hsl(var(--color-error))]" />
                    )}
                    {change.type === 'neutral' && (
                      <Minus className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
                    )}
                    <Badge
                      variant={
                        change.type === 'increase'
                          ? 'success'
                          : change.type === 'decrease'
                            ? 'destructive'
                            : 'outline'
                      }
                      className={cn(
                        'text-xs font-medium',
                        change.type === 'neutral' &&
                          'border-[hsl(var(--color-border-secondary))] text-[hsl(var(--color-text-secondary))]'
                      )}
                    >
                      {dashboardUtils.formatPercentage(change.value)}
                    </Badge>
                  </div>
                )}
              </div>
              {change && (
                <p className="text-muted-foreground text-xs">
                  较{change.period}
                </p>
              )}
            </div>

            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-md border-2 shadow-sm',
                colorClasses.bg,
                colorClasses.border
              )}
            >
              <IconComponent className={cn('h-7 w-7', colorClasses.icon)} />
            </div>
          </div>

          {href && (
            <div className="text-muted-foreground group-hover:text-foreground mt-4 flex items-center text-sm transition-colors">
              <span>查看详情</span>
              <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
            </div>
          )}
        </CardContent>
      </Card>
    );

    // 根据 href 决定是否包裹 Link
    if (href) {
      return <Link href={href}>{cardContent}</Link>;
    }

    return cardContent;
  }
);

StatCard.displayName = 'StatCard';

// 统计卡片网格组件
export interface StatCardsGridProps {
  overview: BusinessOverview;
  loading?: boolean;
  className?: string;
}

const StatCardsGrid = React.forwardRef<HTMLDivElement, StatCardsGridProps>(
  ({ overview, loading = false, className, ...props }, ref) => {
    // 构建统计卡片数据 - 只保留4个核心指标
    const statCards: StatCardProps[] = React.useMemo(
      () => [
        {
          title: '总收入',
          value: dashboardUtils.formatCurrency(
            overview?.sales?.totalRevenue || 0
          ),
          change: {
            value: overview?.sales?.revenueGrowth || 0,
            type:
              (overview?.sales?.revenueGrowth || 0) > 0
                ? 'increase'
                : (overview?.sales?.revenueGrowth || 0) < 0
                  ? 'decrease'
                  : 'neutral',
            period: '上月',
          },
          icon: 'dollar-sign',
          color: 'green',
          href: '/sales-orders',
          loading,
        },
        {
          title: '订单数量',
          value: overview?.sales?.totalOrders || 0,
          change: {
            value: overview?.sales?.ordersGrowth || 0,
            type:
              (overview?.sales?.ordersGrowth || 0) > 0
                ? 'increase'
                : (overview?.sales?.ordersGrowth || 0) < 0
                  ? 'decrease'
                  : 'neutral',
            period: '上月',
          },
          icon: 'shopping-cart',
          color: 'blue',
          href: '/sales-orders',
          loading,
        },
        {
          title: '库存产品',
          value: overview?.inventory?.totalProducts || 0,
          change: {
            value: overview?.inventory?.stockHealth || 0,
            type:
              (overview?.inventory?.stockHealth || 0) >= 80
                ? 'increase'
                : (overview?.inventory?.stockHealth || 0) >= 60
                  ? 'neutral'
                  : 'decrease',
            period: '健康度',
          },
          icon: 'package',
          color: 'purple',
          href: '/inventory',
          loading,
        },
        {
          title: '退货处理',
          value: overview?.returns?.pendingReturns || 0,
          change: {
            value: overview?.returns?.returnRate || 0,
            type: 'neutral' as const,
            period: '退货率',
          },
          icon: 'rotate-ccw',
          color:
            (overview?.returns?.pendingReturns || 0) > 0 ? 'yellow' : 'gray',
          href: '/return-orders',
          loading,
        },
      ],
      [overview, loading]
    );

    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4',
          className
        )}
        ref={ref}
        {...props}
      >
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>
    );
  }
);

StatCardsGrid.displayName = 'StatCardsGrid';

// 单个指标卡片（用于移动端优化）
export interface MobileStatCardProps extends StatCardProps {
  compact?: boolean;
}

const MobileStatCard = React.forwardRef<HTMLDivElement, MobileStatCardProps>(
  ({ compact = false, ...props }, ref) => {
    if (compact) {
      const IconComponent = ICON_MAP[props.icon];
      const colorClasses = COLOR_MAP[props.color];

      return (
        <div
          className="bg-card flex items-center justify-between rounded-lg border p-3"
          ref={ref}
        >
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded',
                colorClasses.bg
              )}
            >
              <IconComponent className={cn('h-4 w-4', colorClasses.icon)} />
            </div>
            <div>
              <p className="text-sm font-medium">{props.title}</p>
              <p className="text-muted-foreground text-xs">
                {typeof props.value === 'number'
                  ? dashboardUtils.formatNumber(props.value)
                  : props.value}
              </p>
            </div>
          </div>

          {props.change && (
            <Badge variant="outline" className="text-xs">
              {dashboardUtils.formatPercentage(props.change.value)}
            </Badge>
          )}
        </div>
      );
    }

    return <StatCard {...props} ref={ref} />;
  }
);

MobileStatCard.displayName = 'MobileStatCard';

export { MobileStatCard, StatCard, StatCardsGrid };
