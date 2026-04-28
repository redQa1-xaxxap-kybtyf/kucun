import {
  Calendar,
  RotateCcw,
  TrendingUp,
  type LucideIcon,
  Wallet,
} from 'lucide-react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceOverview } from '@/lib/services/finance-statistics';
import { formatCurrency } from '@/lib/utils/format';

type FinanceOverviewHeaderProps = {
  dateLabel: string;
  roleLabel: string;
  overview: FinanceOverview;
};

export function FinanceOverviewHeader({
  dateLabel,
  roleLabel,
  overview,
}: FinanceOverviewHeaderProps) {
  const { summary } = overview;
  const cards = [
    {
      title: '应收账款',
      value: formatCurrency(overview.totalReceivable),
      description: `${overview.receivableCount} 笔待跟进`,
      icon: TrendingUp,
      valueClassName: 'text-[hsl(var(--color-success))]',
    },
    {
      title: '待退款',
      value: formatCurrency(overview.totalRefundable),
      description: `${overview.refundCount} 笔退款待处理`,
      icon: RotateCcw,
      valueClassName: 'text-[hsl(var(--color-warning))]',
    },
    {
      title: '本月已收款',
      value: formatCurrency(overview.monthlyReceived),
      description: `回款率 ${summary.paymentRate.toFixed(1)}%`,
      icon: ChineseYuan,
      valueClassName: 'text-[hsl(var(--color-primary))]',
    },
    {
      title: '累计业务金额',
      value: formatCurrency(summary.totalAmount),
      description: `累计已收 ${formatCurrency(summary.paidAmount)}`,
      icon: Wallet,
      valueClassName: 'text-[hsl(var(--color-text-primary))]',
    },
  ] satisfies Array<{
    title: string;
    value: string;
    description: string;
    icon: LucideIcon | typeof ChineseYuan;
    valueClassName: string;
  }>;

  return (
    <>
      <Card className="border border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]">
        <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl sm:font-bold xl:text-3xl">
                  财务中心
                </h1>
                <Badge variant="secondary" className="text-xs">
                  {roleLabel}视角
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                先处理应收、应付、待退款，再查看收款、付款、费用和报表。
              </p>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span>{dateLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <IconComponent className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.valueClassName}`}>
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
    </>
  );
}
