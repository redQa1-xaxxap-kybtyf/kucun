import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { buildFinancePriorityCards } from '@/app/(dashboard)/finance/_lib/priority-cards.config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { FinanceOverview } from '@/lib/services/finance-statistics';

type FinancePrioritySectionProps = {
  overview: FinanceOverview;
};

export function FinancePrioritySection({
  overview,
}: FinancePrioritySectionProps) {
  const items = buildFinancePriorityCards(overview);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))] sm:text-lg">
          今日优先处理
        </h2>
        <p className="text-muted-foreground text-sm">
          把最常用、最影响回款和结算的任务放在前面。
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map(item => {
          const IconComponent = item.icon;

          return (
            <Card
              key={item.id}
              className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
            >
              <CardContent className="p-5">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-md ${item.accentClassName}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      优先
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">
                      {item.hint}
                    </span>
                    <Button asChild size="sm">
                      <Link href={item.href}>
                        立即查看
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
