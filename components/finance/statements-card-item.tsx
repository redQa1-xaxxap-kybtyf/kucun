import {
  ChevronRight,
  History,
  TrendingDown,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

import { RelativeTime } from '@/components/common/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

import {
  STATUS_LABEL_MAP,
  TYPE_LABEL_MAP,
  type AccountStatementItem,
} from './statements-types';

type StatementCardItemProps = {
  statement: AccountStatementItem;
};

export function StatementCardItem({ statement }: StatementCardItemProps) {
  const balance = statement.currentBalance ?? 0;
  const balanceLabel =
    balance > 0 ? '待收余额' : balance < 0 ? '待付余额' : '无余额';
  const paymentRate =
    Math.abs(statement.totalAmount) > 0
      ? (Math.abs(statement.paidAmount) / Math.abs(statement.totalAmount)) * 100
      : 0;

  return (
    <div className="rounded-md border border-[hsl(var(--color-border-secondary))] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-md text-white',
              statement.type === 'customer'
                ? 'bg-[hsl(var(--color-primary))]'
                : 'bg-[hsl(var(--color-text-secondary))]'
            )}
          >
            {statement.type === 'customer' ? (
              <User className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="truncate text-base font-semibold text-[hsl(var(--color-text-primary))]">
              {statement.name}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TYPE_LABEL_MAP[statement.type]}</Badge>
              <Badge variant="secondary">
                {STATUS_LABEL_MAP[statement.status]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-4 sm:grid-cols-3">
          <MetricBlock label="业务笔数" value={`${statement.totalOrders} 笔`} />
          <MetricBlock
            label="累计往来金额"
            value={formatCurrency(Math.abs(statement.totalAmount))}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[hsl(var(--color-text-secondary))]">
              <span>收付进度</span>
              <span className="font-medium text-[hsl(var(--color-primary))]">
                {paymentRate.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--color-bg-secondary))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--color-primary))]"
                style={{ width: `${paymentRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:min-w-[220px] lg:justify-end">
          <div className="text-left lg:text-right">
            <div className="text-xs text-[hsl(var(--color-text-secondary))]">
              {balanceLabel}
            </div>
            <div
              className={cn(
                'text-2xl font-semibold',
                balance > 0
                  ? 'text-[hsl(var(--color-success))]'
                  : balance < 0
                    ? 'text-[hsl(var(--color-error))]'
                    : 'text-[hsl(var(--color-text-secondary))]'
              )}
            >
              {formatCurrency(Math.abs(balance))}
            </div>
          </div>

          <Button size="icon" variant="outline" asChild>
            <Link href={`/finance/statements/${statement.id}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--color-border-secondary))] pt-4 text-xs text-[hsl(var(--color-text-secondary))]">
        <div className="flex flex-wrap items-center gap-4">
          {statement.lastTransactionDate && (
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span>最近业务</span>
              <span className="text-[hsl(var(--color-text-primary))]">
                <RelativeTime date={statement.lastTransactionDate} />
              </span>
            </div>
          )}
          {statement.lastPaymentDate && (
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              <span>最近收付款</span>
              <span className="text-[hsl(var(--color-text-primary))]">
                <RelativeTime date={statement.lastPaymentDate} />
              </span>
            </div>
          )}
        </div>

        <Link
          href={`/finance/statements/${statement.id}/transactions`}
          className="font-medium text-[hsl(var(--color-primary))] hover:underline"
        >
          查看明细
        </Link>
      </div>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
        {label}
      </div>
      <div className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
        {value}
      </div>
    </div>
  );
}
