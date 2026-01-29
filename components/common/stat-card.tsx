'use client';

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  isCurrency?: boolean;
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  comparison?: {
    current: number;
    previous: number;
    change: number;
    changeRate: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  isCurrency = true,
  variant = 'default',
  size = 'md',
  comparison,
}: StatCardProps) {
  // 高级配色方案：极淡的背景 + 饱和度适中的语义色
  const themeStyles = {
    default: 'border-slate-200 bg-white text-slate-600',
    primary: 'border-blue-100 bg-blue-50/30 text-blue-700',
    success: 'border-emerald-100 bg-emerald-50/30 text-emerald-700',
    warning: 'border-amber-100 bg-amber-50/30 text-amber-700',
    error: 'border-red-100 bg-red-50/30 text-red-700',
    info: 'border-sky-100 bg-sky-50/30 text-sky-700',
    neutral: 'border-slate-200 bg-slate-50/50 text-slate-600',
  };

  const iconStyles = {
    default: 'bg-slate-100 text-slate-500',
    primary: 'bg-blue-100 text-blue-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    error: 'bg-red-100 text-red-600',
    info: 'bg-sky-100 text-sky-600',
    neutral: 'bg-slate-200 text-slate-600',
  };

  return (
    <Card
      className={cn(
        'group hover:border-opacity-50 relative overflow-hidden border transition-all duration-300 hover:shadow-md',
        themeStyles[variant],
        size === 'lg' ? 'md:col-span-2 lg:col-span-1' : ''
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5 pt-5 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {title}
          </CardTitle>
          <div
            className={cn(
              'font-black tracking-tight text-slate-900',
              size === 'lg' ? 'text-3xl' : 'text-2xl'
            )}
          >
            {isCurrency ? formatCurrency(value) : value.toLocaleString()}
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg p-2 transition-transform group-hover:scale-110',
            iconStyles[variant]
          )}
        >
          {icon}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4">
        <div className="flex flex-col gap-2">
          {comparison && (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold shadow-sm',
                  comparison.trend === 'up'
                    ? 'bg-emerald-500 text-white'
                    : comparison.trend === 'down'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-400 text-white'
                )}
              >
                {comparison.trend === 'up' && (
                  <ArrowUpIcon className="mr-0.5 h-3 w-3" />
                )}
                {comparison.trend === 'down' && (
                  <ArrowDownIcon className="mr-0.5 h-3 w-3" />
                )}
                {comparison.trend === 'stable' && (
                  <MinusIcon className="mr-0.5 h-3 w-3" />
                )}
                {Math.abs(comparison.changeRate).toFixed(1)}%
              </div>
              <span className="text-xs font-bold text-slate-500 italic">
                较上次记录
              </span>
            </div>
          )}
          {subtitle && (
            <p className="mt-1 line-clamp-1 border-t border-slate-200/50 pt-2 text-xs leading-relaxed font-bold text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>

      {/* 底部装饰线条，增加专业感 */}
      <div
        className={cn(
          'h-1 w-full opacity-30',
          variant === 'primary'
            ? 'bg-blue-600'
            : variant === 'success'
              ? 'bg-emerald-600'
              : variant === 'error'
                ? 'bg-red-600'
                : variant === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-slate-300'
        )}
      />
    </Card>
  );
}
