import { FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

import type { StatementsSummary } from './statements-types';

export function StatementsSummaryCards({
  summary,
}: {
  summary: StatementsSummary;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="应收账款"
        icon={
          <TrendingUp className="h-4 w-4 text-[hsl(var(--color-success))]" />
        }
        valueClass="text-[hsl(var(--color-success))]"
        value={formatCurrency(summary.totalReceivable)}
        footer={`${summary.totalCustomers} 个客户`}
      />
      <SummaryCard
        title="应付账款"
        icon={
          <TrendingDown className="h-4 w-4 text-[hsl(var(--color-warning))]" />
        }
        valueClass="text-[hsl(var(--color-warning))]"
        value={formatCurrency(summary.totalPayable)}
        footer={`${summary.totalSuppliers} 个供应商`}
      />
      <SummaryCard
        title="客户数量"
        icon={<Users className="h-4 w-4 text-[hsl(var(--color-primary))]" />}
        valueClass="text-[hsl(var(--color-primary))]"
        value={summary.totalCustomers}
        footer="活跃客户"
      />
      <SummaryCard
        title="供应商数量"
        icon={<FileText className="h-4 w-4 text-[hsl(var(--color-purple))]" />}
        valueClass="text-[hsl(var(--color-purple))]"
        value={summary.totalSuppliers}
        footer="活跃供应商"
      />
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  value,
  valueClass,
  footer,
}: {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  valueClass: string;
  footer: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
        <p className="text-muted-foreground text-xs">{footer}</p>
      </CardContent>
    </Card>
  );
}
