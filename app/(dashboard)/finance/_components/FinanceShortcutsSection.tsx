import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { financeShortcutGroups } from '@/app/(dashboard)/finance/_lib/shortcut-groups.config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function FinanceShortcutsSection() {
  return (
    <section className="space-y-4">
      {financeShortcutGroups.map(group => (
        <Card
          key={group.id}
          className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{group.title}</CardTitle>
            <p className="text-muted-foreground text-sm">{group.description}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map(item => {
                const IconComponent = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group rounded-xl border border-[hsl(var(--color-border-secondary))] p-4 transition-colors hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
                          <span className="font-medium text-[hsl(var(--color-text-primary))]">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--color-text-tertiary))] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
