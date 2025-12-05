// 优化版仪表盘统计卡片组件
// 展示关键业务指标的统计卡片 - 增强视觉效果和用户体验

'use client';

import {
  AlertTriangle,
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

// 优化的颜色映射 - 使用CSS变量统一颜色
// ✅ 使用项目定义的CSS变量替代硬编码颜色
const COLOR_MAP = {
  blue: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-info-light))] to-[hsl(var(--color-info-light))]/50',
    icon: 'text-[hsl(var(--color-info))]',
    border:
      'border-[hsl(var(--color-info-light))] hover:border-[hsl(var(--color-info))]',
    glow: 'bg-[hsl(var(--color-info))]/20',
  },
  green: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-success-light))] to-[hsl(var(--color-success-light))]/50',
    icon: 'text-[hsl(var(--color-success))]',
    border:
      'border-[hsl(var(--color-success-light))] hover:border-[hsl(var(--color-success))]',
    glow: 'bg-[hsl(var(--color-success))]/20',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-warning-light))] to-[hsl(var(--color-warning-light))]/50',
    icon: 'text-[hsl(var(--color-warning))]',
    border:
      'border-[hsl(var(--color-warning-light))] hover:border-[hsl(var(--color-warning))]',
    glow: 'bg-[hsl(var(--color-warning))]/20',
  },
  red: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-error-light))] to-[hsl(var(--color-error-light))]/50',
    icon: 'text-[hsl(var(--color-error))]',
    border:
      'border-[hsl(var(--color-error-light))] hover:border-[hsl(var(--color-error))]',
    glow: 'bg-[hsl(var(--color-error))]/20',
  },
  purple: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-purple-light))] to-[hsl(var(--color-purple-light))]/50',
    icon: 'text-[hsl(var(--color-purple))]',
    border:
      'border-[hsl(var(--color-purple-light))] hover:border-[hsl(var(--color-purple))]',
    glow: 'bg-[hsl(var(--color-purple))]/20',
  },
  gray: {
    bg: 'bg-gradient-to-br from-[hsl(var(--color-bg-tertiary))] to-[hsl(var(--color-bg-tertiary))]/50',
    icon: 'text-[hsl(var(--color-text-secondary))]',
    border:
      'border-[hsl(var(--color-border-secondary))] hover:border-[hsl(var(--color-border))]',
    glow: 'bg-[hsl(var(--color-text-secondary))]/20',
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
          'group relative transition-all duration-300',
          'hover:-translate-y-1 hover:shadow-md',
          href && 'cursor-pointer',
          'border-l-4',
          colorClasses.border,
          className
        )}
        ref={ref}
        {...props}
      >
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            {/* 左侧内容区 */}
            <div className="flex-1 space-y-2">
              {/* 标题 - 增加图标装饰 */}
              <p className="text-muted-foreground text-sm font-semibold tracking-wide">
                {title}
              </p>

              {/* 数值显示 - 更大更醒目 */}
              <div className="space-y-2">
                <p
                  className={cn(
                    'text-3xl font-bold tracking-tight',
                    colorClasses.icon
                  )}
                >
                  {typeof value === 'number'
                    ? dashboardUtils.formatNumber(value)
                    : value}
                </p>

                {/* 变化趋势 - 优化视觉层次 */}
                {change && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Badge
                      variant={
                        change.type === 'increase'
                          ? 'success'
                          : change.type === 'decrease'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="gap-1 font-semibold"
                    >
                      {change.type === 'increase' && (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {change.type === 'decrease' && (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {change.type === 'neutral' && (
                        <Minus className="h-3 w-3" />
                      )}
                      <span>
                        {dashboardUtils.formatPercentage(change.value)}
                      </span>
                    </Badge>
                    <span>较{change.period}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧图标区 - 增强动效 */}
            <div className="relative flex-shrink-0">
              <IconComponent className={cn('h-8 w-8', colorClasses.icon)} />
            </div>
          </div>
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
              (overview?.sales?.revenueGrowth || 0) >= 0
                ? 'increase'
                : 'decrease',
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
              (overview?.sales?.ordersGrowth || 0) >= 0
                ? 'increase'
                : 'decrease',
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
          'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
          'animate-in fade-in-50 slide-in-from-bottom-8 duration-500',
          className
        )}
        ref={ref}
        {...props}
      >
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`animate-in fade-in-50 slide-in-from-bottom-4 fade-delay-${Math.min(index + 1, 6)}`}
          >
            <StatCard {...card} />
          </div>
        ))}
      </div>
    );
  }
);

StatCardsGrid.displayName = 'StatCardsGrid';

export { StatCard, StatCardsGrid };
