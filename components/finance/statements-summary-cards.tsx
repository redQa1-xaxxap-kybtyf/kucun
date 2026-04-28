'use client';

import { Building2, FileText, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

import type { StatementsSummary } from './statements-types';

export function StatementsSummaryCards({
  summary,
}: {
  summary: StatementsSummary;
}) {
  const cards = [
    {
      title: '应收账款',
      value: formatCurrency(summary.totalReceivable),
      description: `${summary.totalCustomers} 个客户有余额`,
      icon: TrendingUp,
      iconClassName: 'text-[hsl(var(--color-success))]',
    },
    {
      title: '应付账款',
      value: formatCurrency(summary.totalPayable),
      description: `${summary.totalSuppliers} 个供应商有余额`,
      icon: TrendingDown,
      iconClassName: 'text-[hsl(var(--color-error))]',
    },
    {
      title: '客户数',
      value: summary.totalCustomers.toLocaleString(),
      description: '已建立往来的客户',
      icon: FileText,
      iconClassName: 'text-[hsl(var(--color-primary))]',
    },
    {
      title: '供应商数',
      value: summary.totalSuppliers.toLocaleString(),
      description: '已建立往来的供应商',
      icon: Building2,
      iconClassName: 'text-[hsl(var(--color-warning))]',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => {
        const IconComponent = card.icon;
        return (
          <Card
            key={card.title}
            className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${card.iconClassName}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
                {card.value}
              </div>
              <p className="text-muted-foreground text-xs">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
