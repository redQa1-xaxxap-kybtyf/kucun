'use client';

import {
  ArrowUpRight,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface CustomerStatsGridProps {
  salesOrderCount: number;
  returnOrderCount: number;
  unpaidOrderCount: number;
  totalSalesAmount: number;
  totalReturnAmount: number;
  totalUnpaidAmount: number;
}

export function CustomerStatsGrid({
  salesOrderCount,
  returnOrderCount,
  unpaidOrderCount,
  totalSalesAmount,
  totalReturnAmount,
  totalUnpaidAmount,
}: CustomerStatsGridProps) {
  const stats = [
    {
      title: '累计销售',
      value: totalSalesAmount,
      count: salesOrderCount,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'blue',
      trend: <TrendingUp className="h-3 w-3" />,
      unit: '单',
    },
    {
      title: '累计退货',
      value: totalReturnAmount,
      count: returnOrderCount,
      icon: <RotateCcw className="h-5 w-5" />,
      color: 'rose',
      trend: <TrendingDown className="h-3 w-3" />,
      unit: '单',
    },
    {
      title: '当前欠款',
      value: totalUnpaidAmount,
      count: unpaidOrderCount,
      icon: <Wallet className="h-5 w-5" />,
      color: 'amber',
      trend: <ArrowUpRight className="h-3 w-3" />,
      unit: '笔',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {stats.map(stat => (
        <div
          key={stat.title}
          className={cn(
            'group relative overflow-hidden rounded-3xl border border-white bg-white/60 p-5 backdrop-blur-md transition-all duration-500',
            'hover:-translate-y-1 hover:bg-white hover:shadow-xl'
          )}
        >
          <div
            className={cn(
              'absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-20 blur-2xl',
              stat.color === 'blue' && 'bg-blue-500',
              stat.color === 'rose' && 'bg-rose-500',
              stat.color === 'amber' && 'bg-amber-500'
            )}
          />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform duration-500 group-hover:scale-110',
                  stat.color === 'blue' && 'bg-blue-50 text-blue-600',
                  stat.color === 'rose' && 'bg-rose-50 text-rose-600',
                  stat.color === 'amber' && 'bg-amber-50 text-amber-600'
                )}
              >
                {stat.icon}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  指标活跃度
                </span>
                <div
                  className={cn(
                    'flex items-center justify-end gap-1 text-xs font-bold italic',
                    stat.color === 'blue' && 'text-blue-500/80',
                    stat.color === 'rose' && 'text-rose-500/80',
                    stat.color === 'amber' && 'text-amber-500/80'
                  )}
                >
                  {stat.trend} 专业数据
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {stat.title}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-slate-400">¥</span>
                <span className="text-2xl leading-none font-black tracking-tighter text-slate-900">
                  {stat.value.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
                <span className="text-xs font-bold text-slate-500">总单量</span>
                <span className="text-xs font-bold text-slate-900">
                  {stat.count} {stat.unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
