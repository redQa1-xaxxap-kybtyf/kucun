import Link from 'next/link';
import type { ReactNode } from 'react';

import { RelativeTime } from '@/components/common/relative-time';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

import {
    STATUS_LABEL_MAP,
    TYPE_LABEL_MAP,
    type AccountStatementItem,
} from './statements-types';

type StatementCardItemProps = {
  statement: AccountStatementItem;
};

type BadgeVariant = 'secondary' | 'destructive' | 'outline';

const STATUS_BADGE_VARIANT: Record<
  AccountStatementItem['status'],
  BadgeVariant
> = {
  active: 'outline',
  settled: 'secondary',
  suspended: 'destructive',
};

type StatementMetricProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

export function StatementCardItem({ statement }: StatementCardItemProps) {
  const balance = statement.currentBalance ?? 0;
  const balanceLabel =
    balance > 0 ? '应收余额' : balance < 0 ? '应付余额' : '余额';
  const balanceColorClass =
    balance > 0
      ? 'text-[hsl(var(--color-success))]'
      : balance < 0
        ? 'text-[hsl(var(--color-warning))]'
        : 'text-muted-foreground';
  const paymentRate =
    Math.abs(statement.totalAmount) > 0
      ? (Math.abs(statement.paidAmount) / Math.abs(statement.totalAmount)) * 100
      : 0;
  const pendingRate = Math.max(100 - paymentRate, 0);
  const statusVariant = STATUS_BADGE_VARIANT[statement.status];

  return (
    <Card className="overflow-hidden transition-all hover:border-[hsl(var(--color-primary))] hover:shadow-[var(--shadow-medium)]">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          <StatementMainContent
            statement={statement}
            paymentRate={paymentRate}
            statusVariant={statusVariant}
          />
          <StatementSidebar
            statement={statement}
            balance={balance}
            balanceLabel={balanceLabel}
            balanceColorClass={balanceColorClass}
            pendingRate={pendingRate}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatementMainContent({
  statement,
  paymentRate,
  statusVariant,
}: {
  statement: AccountStatementItem;
  paymentRate: number;
  statusVariant: BadgeVariant;
}) {
  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
          {statement.name}
        </h3>
        <Badge variant="outline" className="font-medium">
          {TYPE_LABEL_MAP[statement.type]}
        </Badge>
        <Badge variant={statusVariant} className="font-medium">
          {STATUS_LABEL_MAP[statement.status]}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatementMetric
          label="订单数量"
          value={statement.totalOrders}
          valueClassName="text-[hsl(var(--color-info))]"
        />
        <StatementMetric
          label="总交易额"
          value={formatCurrency(Math.abs(statement.totalAmount))}
        />
        <StatementMetric
          label="已收付金额"
          value={formatCurrency(Math.abs(statement.paidAmount))}
          valueClassName="text-[hsl(var(--color-success))]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">收付进度</span>
          <span className="font-medium">{paymentRate.toFixed(1)}%</span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="h-full bg-gradient-to-r from-[hsl(var(--color-success))] to-[hsl(var(--color-info))] transition-all"
            style={{ width: `${paymentRate}%` }}
          />
        </div>
      </div>

      <StatementTimeline statement={statement} />
    </div>
  );
}

function StatementSidebar({
  statement,
  balance,
  balanceLabel,
  balanceColorClass,
  pendingRate,
}: {
  statement: AccountStatementItem;
  balance: number;
  balanceLabel: string;
  balanceColorClass: string;
  pendingRate: number;
}) {
  return (
    <div className="bg-muted/30 flex flex-col justify-between space-y-4 p-6 lg:w-64">
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground text-sm">{balanceLabel}</p>
          <p className={`text-3xl font-bold ${balanceColorClass}`}>
            {formatCurrency(Math.abs(balance))}
          </p>
        </div>

        {statement.pendingAmount > 0 && (
          <div className="border-border/50 border-t pt-4">
            <div className="space-y-1 text-center">
              <p className="text-muted-foreground text-xs">待收付金额</p>
              <p className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                {formatCurrency(statement.pendingAmount)}
              </p>
              <p className="text-muted-foreground text-xs">
                占比 {pendingRate.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="default" size="sm" className="w-full" asChild>
          <Link href={`/finance/statements/${statement.id}`}>查看详情</Link>
        </Button>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/finance/statements/${statement.id}/transactions`}>
            交易记录
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatementTimeline({ statement }: { statement: AccountStatementItem }) {
  if (!statement.lastTransactionDate && !statement.lastPaymentDate) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
      {statement.lastTransactionDate && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">最后交易:</span>
          <span>
            <RelativeTime date={statement.lastTransactionDate} />
          </span>
        </div>
      )}
      {statement.lastPaymentDate && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">最近收付:</span>
          <span>
            <RelativeTime date={statement.lastPaymentDate} />
          </span>
        </div>
      )}
    </div>
  );
}

function StatementMetric({
  label,
  value,
  valueClassName,
}: StatementMetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName ?? ''}`}>{value}</p>
    </div>
  );
}
