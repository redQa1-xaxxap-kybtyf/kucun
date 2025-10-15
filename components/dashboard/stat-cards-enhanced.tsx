// 优化版仪表盘统计卡片组件
// 展示关键业务指标的统计卡片 - 增强视觉效果和用户体验

'use client';

import {
  AlertTriangle,
  ArrowRight,
  BadgeJapaneseYen,
  Minus,
  Package,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
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

// 优化的颜色映射 - 更鲜明的视觉效果
const COLOR_MAP = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
    icon: 'text-blue-600',
    border: 'border-blue-200 hover:border-blue-400',
    glow: 'bg-blue-400/20',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
    icon: 'text-emerald-600',
    border: 'border-emerald-200 hover:border-emerald-400',
    glow: 'bg-emerald-400/20',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
    icon: 'text-amber-600',
    border: 'border-amber-200 hover:border-amber-400',
    glow: 'bg-amber-400/20',
  },
  red: {
    bg: 'bg-gradient-to-br from-rose-50 to-rose-100/50',
    icon: 'text-rose-600',
    border: 'border-rose-200 hover:border-rose-400',
    glow: 'bg-rose-400/20',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
    icon: 'text-purple-600',
    border: 'border-purple-200 hover:border-purple-400',
    glow: 'bg-purple-400/20',
  },
  gray: {
    bg: 'bg-gradient-to-br from-gray-50 to-gray-100/50',
    icon: 'text-gray-600',
    border: 'border-gray-200 hover:border-gray-400',
    glow: 'bg-gray-400/20',
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
          'group relative overflow-hidden border-2 transition-all duration-300',
          'hover:-translate-y-1 hover:shadow-2xl',
          href && 'cursor-pointer',
          colorClasses.border,
          className
        )}
        ref={ref}
        {...props}
      >
        {/* 装饰性渐变背景 - 更柔和的效果 */}
        <div
          className={cn(
            'absolute inset-0 opacity-30 transition-opacity duration-300 group-hover:opacity-50',
            colorClasses.bg
          )}
        />

        {/* 悬浮时的光效 */}
        <div
          className={cn(
            'absolute -inset-1 rounded-lg opacity-0 blur-2xl transition-opacity duration-500',
            'group-hover:opacity-40',
            colorClasses.glow
          )}
        />

        <CardContent className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            {/* 左侧内容区 */}
            <div className="flex-1 space-y-3">
              {/* 标题 - 增加图标装饰 */}
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  {title}
                </p>
                {change && change.type !== 'neutral' && (
                  <Sparkles
                    className={cn(
                      'h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100',
                      colorClasses.icon
                    )}
                  />
                )}
              </div>

              {/* 数值显示 - 更大更醒目 */}
              <div className="space-y-2">
                <p
                  className={cn(
                    'text-4xl font-black tracking-tight transition-all duration-300',
                    'group-hover:scale-105',
                    colorClasses.icon
                  )}
                >
                  {typeof value === 'number'
                    ? dashboardUtils.formatNumber(value)
                    : value}
                </p>

                {/* 变化趋势 - 优化视觉层次 */}
                {change && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium',
                        'border shadow-sm transition-all duration-300 group-hover:shadow-md',
                        change.type === 'increase' &&
                          'border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700',
                        change.type === 'decrease' &&
                          'border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700',
                        change.type === 'neutral' &&
                          'border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600'
                      )}
                    >
                      {change.type === 'increase' && (
                        <TrendingUp className="animate-in slide-in-from-bottom-2 h-4 w-4" />
                      )}
                      {change.type === 'decrease' && (
                        <TrendingDown className="animate-in slide-in-from-top-2 h-4 w-4" />
                      )}
                      {change.type === 'neutral' && (
                        <Minus className="h-4 w-4" />
                      )}
                      <span className="text-sm font-bold tabular-nums">
                        {dashboardUtils.formatPercentage(change.value)}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs font-medium">
                      较{change.period}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧图标区 - 增强动效 */}
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl border-2',
                  'shadow-lg backdrop-blur-sm',
                  'transition-all duration-500',
                  'group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-xl',
                  colorClasses.bg,
                  colorClasses.border
                )}
              >
                <IconComponent
                  className={cn(
                    'h-8 w-8 transition-transform duration-500',
                    'group-hover:scale-110',
                    colorClasses.icon
                  )}
                />
              </div>
              {/* 图标光晕效果 */}
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl blur-2xl',
                  'opacity-0 transition-all duration-500',
                  'group-hover:scale-110 group-hover:opacity-40',
                  colorClasses.glow
                )}
              />
            </div>
          </div>

          {/* 查看详情链接 - 更明显的交互反馈 */}
          {href && (
            <div
              className={cn(
                'mt-5 border-t border-dashed pt-4',
                'flex items-center justify-between gap-2',
                'transition-all duration-300',
                'opacity-60 group-hover:opacity-100',
                colorClasses.border
              )}
            >
              <span className={cn('text-sm font-semibold', colorClasses.icon)}>
                查看详情
              </span>
              <ArrowRight
                className={cn(
                  'h-4 w-4 transition-transform duration-300',
                  'group-hover:translate-x-2',
                  colorClasses.icon
                )}
              />
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
          'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4',
          'animate-in fade-in-50 slide-in-from-bottom-8 duration-500',
          className
        )}
        ref={ref}
        {...props}
      >
        {statCards.map((card, index) => (
          <div
            key={index}
            className="animate-in fade-in-50 slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms` }}
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
