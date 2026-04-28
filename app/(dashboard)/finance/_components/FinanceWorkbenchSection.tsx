import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { getWorkbenchToneStyles } from '@/app/(dashboard)/finance/_lib/workbench-cards.builder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { FinanceWorkbenchCard } from '@/lib/types/finance-dashboard';
import { formatCurrency } from '@/lib/utils/format';

type FinanceWorkbenchSectionProps = {
  cards: FinanceWorkbenchCard[];
  summary: string;
};

export function FinanceWorkbenchSection({
  cards,
  summary,
}: FinanceWorkbenchSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))] sm:text-lg">
          今日待办
        </h2>
        <p className="text-muted-foreground text-sm">{summary}</p>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => {
            const IconComponent = card.icon;
            const toneStyles = getWorkbenchToneStyles(card.tone);

            return (
              <Card
                key={card.id}
                className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
              >
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-md ${toneStyles.icon}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge className={`text-xs ${toneStyles.badge}`}>
                      {card.count} 项
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {card.description}
                    </p>
                  </div>

                  <div className="space-y-1 rounded-md bg-[hsl(var(--color-bg-secondary))] px-3 py-3">
                    <p className={`text-xl font-bold ${toneStyles.amount}`}>
                      {formatCurrency(card.amount)}
                    </p>
                    <p className="text-muted-foreground text-xs">{card.hint}</p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">
                      {card.count} 项待处理
                    </span>
                    <Button asChild size="sm">
                      <Link href={card.href}>
                        立即处理
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                今天的财务待办已经清空
              </p>
              <p className="text-muted-foreground text-sm">
                当前没有待确认到账、待确认付款、待退款或待审核费用，可以开始看报表和经营数据。
              </p>
            </div>
            <Badge
              variant="secondary"
              className="w-fit bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]"
            >
              进度正常
            </Badge>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
