'use client';

import { RotateCcw, ShoppingCart, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

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
      amount: totalSalesAmount,
      countLabel: `${salesOrderCount} 单`,
      icon: ShoppingCart,
      tone: 'primary',
    },
    {
      title: '累计退货',
      amount: totalReturnAmount,
      countLabel: `${returnOrderCount} 单`,
      icon: RotateCcw,
      tone: 'danger',
    },
    {
      title: '待收款',
      amount: totalUnpaidAmount,
      countLabel: `${unpaidOrderCount} 笔`,
      icon: Wallet,
      tone: 'warning',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
      {stats.map(stat => {
        const Icon = stat.icon;

        return (
          <div key={stat.title} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                  {stat.title}
                </p>
                <p className="mt-2 text-xl font-semibold text-[hsl(var(--color-text-primary))]">
                  {formatCurrency(stat.amount)}
                </p>
              </div>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  stat.tone === 'primary' &&
                    'bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
                  stat.tone === 'danger' &&
                    'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
                  stat.tone === 'warning' &&
                    'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 border-t pt-3 text-xs text-[hsl(var(--color-text-secondary))]">
              单据数量：
              <span className="font-medium text-[hsl(var(--color-text-primary))]">
                {stat.countLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
