'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

import type { SalesOrderDetail } from './types';

interface OrderReconciliationSummaryCardProps {
  order: SalesOrderDetail;
}

/**
 * 退货退款摘要卡片
 * 只显示退货和退款相关信息，避免与顶部 AmountSummaryCards 重复
 */
export function OrderReconciliationSummaryCard({
  order,
}: OrderReconciliationSummaryCardProps) {
  const returnedAmount = (order.returnOrders ?? []).reduce(
    (sum, returnOrder) => sum + Number(returnOrder.refundAmount ?? 0),
    0
  );

  const refundedAmount = Number(order.refundedAmount ?? 0);

  if (returnedAmount === 0 && refundedAmount === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SummaryCard
        label="关联退货总值"
        value={formatCurrency(returnedAmount)}
        description={`${order.returnOrders?.filter(r => r.status !== 'cancelled').length || 0} 笔有效的退货申请单`}
        variant="warning"
      />
      <SummaryCard
        label="财务实退金额"
        value={formatCurrency(refundedAmount)}
        description="已通过账务审核并完成退付"
        variant="error"
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
  variant?: 'default' | 'warning' | 'error';
}

function SummaryCard({
  label,
  value,
  description,
  variant = 'default',
}: SummaryCardProps) {
  const colorClass = {
    default: 'text-slate-900',
    warning: 'text-amber-600',
    error: 'text-rose-600',
  }[variant];

  const borderClass = {
    default: 'border-slate-100',
    warning: 'border-amber-100 ring-1 ring-amber-100/50',
    error: 'border-rose-100 ring-1 ring-rose-100/50',
  }[variant];

  return (
    <Card className={`overflow-hidden rounded-md border bg-white shadow-sm ${borderClass}`}>
      <CardContent className="p-5">
        <div className="text-[10px] font-bold text-slate-500">
          {label}
        </div>
        <div
          className={`mt-2 font-mono text-2xl font-semibold ${colorClass}`}
        >
          {value}
        </div>
        {description && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
            <div
              className={`h-1 w-1 rounded-full ${variant === 'warning' ? 'bg-amber-400' : 'bg-rose-400'}`}
            />
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
