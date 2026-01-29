// 优化版仪表盘统计卡片组件
// 展示关键业务指标的统计卡片 - 增强视觉效果和用户体验

'use client';

import {
  AlertTriangle,
  ArrowRight,
  BadgeJapaneseYen,
  Package,
  RotateCcw,
  ShoppingCart,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
    bg: 'bg-blue-50/30',
    icon: 'text-blue-600',
    border: 'border-blue-100 hover:border-blue-200',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-emerald-50/30',
    icon: 'text-emerald-600',
    border: 'border-emerald-100 hover:border-emerald-200',
    dot: 'bg-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-50/30',
    icon: 'text-amber-600',
    border: 'border-amber-100 hover:border-amber-200',
    dot: 'bg-amber-500',
  },
  red: {
    bg: 'bg-rose-50/30',
    icon: 'text-rose-600',
    border: 'border-rose-100 hover:border-rose-200',
    dot: 'bg-rose-500',
  },
  purple: {
    bg: 'bg-indigo-50/30',
    icon: 'text-indigo-600',
    border: 'border-indigo-100 hover:border-indigo-200',
    dot: 'bg-indigo-500',
  },
  gray: {
    bg: 'bg-slate-50/30',
    icon: 'text-slate-600',
    border: 'border-slate-100 hover:border-slate-200',
    dot: 'bg-slate-500',
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
        <Card
          className={cn(
            'h-[160px] animate-pulse rounded-3xl bg-white/40',
            className
          )}
          ref={ref}
          {...props}
        />
      );
    }

    const cardContent = (
      <div
        className={cn(
          'group relative flex h-[160px] flex-col justify-between overflow-hidden rounded-3xl border border-white bg-white/60 p-6 shadow-sm backdrop-blur-md transition-all duration-500',
          'hover:-translate-y-1 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50',
          href && 'cursor-pointer',
          className
        )}
        ref={ref}
        {...props}
      >
        {/* 背景装饰轨迹 */}
        <div
          className={cn(
            'absolute -top-4 -right-4 h-24 w-24 rounded-full opacity-5 blur-2xl transition-all group-hover:opacity-10',
            colorClasses.dot
          )}
        />

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={cn('h-1.5 w-1.5 rounded-full', colorClasses.dot)}
              />
              <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {title}
              </p>
            </div>
            <p className="text-3xl font-black tracking-tighter text-slate-900">
              {typeof value === 'number'
                ? dashboardUtils.formatNumber(value)
                : value}
            </p>
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6',
              colorClasses.bg
            )}
          >
            <IconComponent className={cn('h-6 w-6', colorClasses.icon)} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {change ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'h-6 rounded-lg border-none px-2 text-xs font-bold tracking-tight uppercase',
                  change.type === 'increase'
                    ? 'bg-emerald-50 text-emerald-700'
                    : change.type === 'decrease'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-50 text-slate-500'
                )}
              >
                {dashboardUtils.formatPercentage(change.value)}
              </Badge>
              <span className="text-xs font-bold text-slate-400">
                较 {change.period}
              </span>
            </div>
          ) : (
            <div className="h-6" />
          )}

          {href && (
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all group-hover:bg-slate-900 group-hover:text-white">
              <ArrowRight className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    );

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
    const statCards: StatCardProps[] = React.useMemo(
      () => [
        {
          title: '累计营收',
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
          title: '成交订单',
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
          title: '产品库容',
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
          title: '退货统计',
          value: overview?.returns?.pendingReturns || 0,
          change: {
            value: overview?.returns?.returnRate || 0,
            type: 'neutral',
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
          <div
            key={index}
            className="animate-in fade-in-50 slide-in-from-bottom-4"
            style={
              {
                'animation-delay': `${index * 100}ms`,
              } as React.CSSProperties
            }
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
