'use client';

import { Clock, Calendar, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import type {
  PaymentStatus,
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';
import { formatCurrency } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';

import type { ReceivablesQueryParams } from './types';
import { formatCurrencyWithSign, isMeaningfulAmount } from './utils';

type ReceivablesFilterCardProps = {
  queryParams: ReceivablesQueryParams;
  isLoading: boolean;
  error: unknown;
  receivables: ReceivableItem[];
  pagination?: ReceivablesResult['pagination'];
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
  onPageChange: (page: number) => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
};

export function ReceivablesFilterCard({
  queryParams,
  isLoading,
  error,
  receivables,
  pagination,
  onSearch,
  onFilterChange,
  onDateRangeChange,
  onPageChange,
  onOpenPaymentDialog,
}: ReceivablesFilterCardProps) {
  const router = useRouter();
  const handleViewOrder = React.useCallback(
    (orderId: string) => router.push(`/sales-orders/${orderId}`),
    [router]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <ReceivablesFilterBar
          queryParams={queryParams}
          onSearch={onSearch}
          onFilterChange={onFilterChange}
          onDateRangeChange={onDateRangeChange}
        />

        <ReceivablesList
          isLoading={isLoading}
          error={error}
          receivables={receivables}
          pagination={pagination}
          onPageChange={onPageChange}
          onOpenPaymentDialog={onOpenPaymentDialog}
          onViewOrder={handleViewOrder}
        />
      </CardContent>
    </Card>
  );
}

type ReceivablesFilterBarProps = {
  queryParams: ReceivablesQueryParams;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
};

function ReceivablesFilterBar({
  queryParams,
  onSearch,
  onFilterChange,
  onDateRangeChange,
}: ReceivablesFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[280px] flex-1">
        <UnifiedSearchBar
          searchValue={queryParams.search}
          onSearchChange={onSearch}
          searchPlaceholder="搜索订单号或客户名称..."
          debounceDelay={400}
          filters={[
            {
              key: 'paymentStatus',
              label: '状态',
              includeAllOption: true,
              options: [
                { label: '未收款', value: 'unpaid' },
                { label: '部分收款', value: 'partial' },
                { label: '待确认', value: 'pending' },
                { label: '已收款', value: 'paid' },
              ],
              width: 'w-[140px]',
            },
          ]}
          filterValues={{
            paymentStatus: queryParams.paymentStatus || 'all',
          }}
          onFilterChange={onFilterChange}
        />
      </div>
      <DateRangePicker
        value={{
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
        }}
        onChange={onDateRangeChange}
        label=""
        placeholder="选择订单日期范围"
        showPresets
        className="min-w-[220px]"
      />
    </div>
  );
}

type ReceivablesListProps = {
  isLoading: boolean;
  error: unknown;
  receivables: ReceivableItem[];
  pagination?: ReceivablesResult['pagination'];
  onPageChange: (page: number) => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
};

function ReceivablesList({
  isLoading,
  error,
  receivables,
  pagination,
  onPageChange,
  onOpenPaymentDialog,
  onViewOrder,
}: ReceivablesListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[hsl(var(--color-error))]">加载失败: {message}</div>
      </div>
    );
  }

  if (!receivables.length) {
    return <EmptyState className="mt-6" title="暂无应收账款数据" compact />;
  }

  return (
    <>
      <div className="mt-6 space-y-4">
        {receivables.map(receivable => (
          <ReceivableCard
            key={receivable.id}
            receivable={receivable}
            onOpenPaymentDialog={onOpenPaymentDialog}
            onViewOrder={onViewOrder}
          />
        ))}
      </div>

      {pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          showTotal
          disabled={isLoading}
          containerClassName="mt-6"
        />
      )}
    </>
  );
}

type ReceivableCardProps = {
  receivable: ReceivableItem;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
};

function ReceivableCard({
  receivable,
  onOpenPaymentDialog,
  onViewOrder,
}: ReceivableCardProps) {
  const amounts = getReceivableAmounts(receivable);

  return (
    <Card className="group overflow-hidden border border-[hsl(var(--color-border-secondary))] bg-white transition-all duration-300 hover:border-[hsl(var(--color-primary))]/40 hover:shadow-lg">
      <CardContent className="p-0">
        <ReceivableCardHeader
          receivable={receivable}
          onOpenPaymentDialog={onOpenPaymentDialog}
          onViewOrder={onViewOrder}
        />
        <ReceivableCardStats amounts={amounts} />
        <ReceivableCardDates receivable={receivable} />
      </CardContent>
    </Card>
  );
}

type ReceivableCardHeaderProps = {
  receivable: ReceivableItem;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onViewOrder: (orderId: string) => void;
};

function ReceivableCardHeader({
  receivable,
  onOpenPaymentDialog,
  onViewOrder,
}: ReceivableCardHeaderProps) {
  return (
    <div className="relative flex items-center justify-between border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-6 py-5">
      <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold tracking-tight text-[hsl(var(--color-text-primary))] transition-colors group-hover:text-[hsl(var(--color-primary))]">
            {receivable.orderNumber}
          </h3>
          <ReceivableStatusBadge status={receivable.paymentStatus} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
            客户
          </span>
          <span className="text-sm font-semibold text-[hsl(var(--color-text-secondary))]">
            {receivable.customerName}
          </span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewOrder(receivable.id)}
          className="border-[hsl(var(--color-border-primary))] hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary))]/5 hover:text-[hsl(var(--color-primary))]"
        >
          查看详情
        </Button>
        {receivable.paymentStatus === 'pending' ? (
          <Button
            size="sm"
            variant="outline"
            disabled
            className="cursor-not-allowed border-[hsl(var(--color-border-primary))] bg-white text-[hsl(var(--color-warning))]"
          >
            待确认
          </Button>
        ) : (
          receivable.remainingAmount > 0 && (
            <Button
              size="sm"
              className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              onClick={() => onOpenPaymentDialog(receivable)}
            >
              收款
            </Button>
          )
        )}
      </div>
    </div>
  );
}

type ReceivableCardStatsProps = {
  amounts: ReceivableAmounts;
};

function ReceivableCardStats({ amounts }: ReceivableCardStatsProps) {
  const {
    orderActualAmount,
    hasOrderRounding,
    orderRoundingDisplay,
    hasPaymentRounding,
    paymentRoundingDisplay,
    receivableAmount,
    paidActual,
    actualRemaining,
  } = amounts;

  return (
    <div className="grid grid-cols-4 gap-px bg-[hsl(var(--color-border-secondary))]/30">
      <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
        <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
          订单金额
        </span>
        <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
          {formatCurrency(orderActualAmount)}
        </span>
        {hasOrderRounding && (
          <span className="mt-1 text-xs text-[hsl(var(--color-success))]">
            已抹零 {formatCurrency(orderRoundingDisplay)}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
        <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
          收款差额
        </span>
        {hasPaymentRounding ? (
          <div className="flex flex-col items-center">
            <span
              className={`text-2xl font-bold tracking-tight ${
                paymentRoundingDisplay > 0
                  ? 'text-[hsl(var(--color-error))]'
                  : 'text-[hsl(var(--color-success))]'
              }`}
            >
              {formatCurrencyWithSign(paymentRoundingDisplay, {
                positiveSign: '+',
                negativeSign: '-',
              })}
            </span>
            <span
              className={`mt-1 text-xs ${
                paymentRoundingDisplay > 0
                  ? 'text-[hsl(var(--color-error))]'
                  : 'text-[hsl(var(--color-success))]'
              }`}
            >
              {paymentRoundingDisplay > 0 ? '多收' : '少收'}
            </span>
          </div>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-tertiary))]">
            -
          </span>
        )}
      </div>

      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[hsl(var(--color-warning))]/5 to-white px-6 py-6 transition-all hover:from-[hsl(var(--color-warning))]/10">
        {actualRemaining > 0 && (
          <div className="absolute top-2 right-2 h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--color-warning))]" />
        )}
        <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
          应收金额
        </span>
        <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-warning))]">
          {formatCurrency(receivableAmount)}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(var(--color-success))]/5 to-white px-6 py-6 transition-all hover:from-[hsl(var(--color-success))]/10">
        <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
          已收金额
        </span>
        <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-success))]">
          {formatCurrency(paidActual)}
        </span>
      </div>
    </div>
  );
}

type ReceivableCardDatesProps = {
  receivable: ReceivableItem;
};

function ReceivableCardDates({ receivable }: ReceivableCardDatesProps) {
  return (
    <div className="flex items-center gap-6 border-t border-[hsl(var(--color-border-secondary))]/30 bg-[hsl(var(--color-bg-tertiary))]/30 px-6 py-3.5 text-xs">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
        <span className="text-[hsl(var(--color-text-tertiary))]">订单日期:</span>
        <span className="font-medium text-[hsl(var(--color-text-secondary))]">
          {formatDateTime(receivable.orderDate, 'yyyy-MM-dd HH:mm')}
        </span>
      </div>
      {receivable.lastPaymentDate && (
        <>
          <span className="text-[hsl(var(--color-border-primary))]">•</span>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-success))]" />
            <span className="text-[hsl(var(--color-text-tertiary))]">最后收款:</span>
            <span className="font-medium text-[hsl(var(--color-success))]">
              {formatDateTime(receivable.lastPaymentDate, 'yyyy-MM-dd HH:mm')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

type StatusConfigItem = {
  label: string;
  variant: BadgeProps['variant'];
  className?: string;
  icon?: LucideIcon;
};

const STATUS_CONFIG: Partial<Record<PaymentStatus | string, StatusConfigItem>> = {
  unpaid: { label: '未收款', variant: 'destructive' },
  partial: {
    label: '部分收款',
    variant: 'outline',
    className: 'gap-1 border-yellow-300 bg-yellow-50 text-yellow-700',
    icon: Clock,
  },
  paid: { label: '已收款', variant: 'default' },
  pending: { label: '待确认', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  cancelled: { label: '已取消', variant: 'secondary' },
};

function ReceivableStatusBadge({ status }: { status: PaymentStatus | string }) {
  const config =
    STATUS_CONFIG[status] ?? { label: '未知状态', variant: 'secondary' as BadgeProps['variant'] };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

type ReceivableAmounts = {
  orderActualAmount: number;
  orderRoundingDisplay: number;
  hasOrderRounding: boolean;
  paymentRoundingDisplay: number;
  hasPaymentRounding: boolean;
  receivableAmount: number;
  paidActual: number;
  actualRemaining: number;
};

function getReceivableAmounts(receivable: ReceivableItem): ReceivableAmounts {
  const productAmount = receivable.totalAmount;
  const orderRoundingRaw = receivable.roundingAdjustment ?? 0;
  const paymentRoundingRaw =
    (receivable.paymentRoundingAmount ?? 0) + (receivable.pendingRoundingAmount ?? 0);
  const paidActual = receivable.paidAmount ?? 0;

  const orderActualAmount = productAmount + orderRoundingRaw;
  const receivableAmount = orderActualAmount - paymentRoundingRaw;
  const actualRemaining = receivableAmount - paidActual;

  return {
    orderActualAmount,
    orderRoundingDisplay: Math.abs(orderRoundingRaw),
    hasOrderRounding: isMeaningfulAmount(orderRoundingRaw),
    paymentRoundingDisplay: -paymentRoundingRaw,
    hasPaymentRounding: isMeaningfulAmount(paymentRoundingRaw),
    receivableAmount,
    paidActual,
    actualRemaining,
  };
}
