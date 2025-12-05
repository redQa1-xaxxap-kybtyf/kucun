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
  // 已退货金额：所有非取消退货单的退款金额之和
  const returnedAmount = (order.returnOrders ?? []).reduce(
    (sum, returnOrder) => sum + Number(returnOrder.refundAmount ?? 0),
    0
  );

  // 已退款（根据退款记录汇总的已处理金额）
  const refundedAmount = Number(order.refundedAmount ?? 0);

  // 如果没有退货或退款，不显示此卡片
  if (returnedAmount === 0 && refundedAmount === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SummaryCard
        label="已退货金额"
        value={formatCurrency(returnedAmount)}
        description={`${order.returnOrders?.filter(r => r.status !== 'cancelled').length || 0} 个退货单`}
        variant="warning"
      />
      <SummaryCard
        label="已退款金额"
        value={formatCurrency(refundedAmount)}
        description="已处理的退款"
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
    default: 'text-[hsl(var(--color-text-primary))]',
    warning: 'text-orange-600',
    error: 'text-red-600',
  }[variant];

  const bgClass = {
    default: 'border-[hsl(var(--color-border-primary))]',
    warning: 'border-orange-200 bg-orange-50/50',
    error: 'border-red-200 bg-red-50/50',
  }[variant];

  return (
    <Card className={`border ${bgClass} card-shadow-light`}>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-gray-600">{label}</div>
        <div className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</div>
        {description && (
          <div className="mt-1 text-xs text-gray-500">{description}</div>
        )}
      </CardContent>
    </Card>
  );
}
