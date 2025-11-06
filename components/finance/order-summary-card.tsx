import type { ReactNode } from 'react';


import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

import { type OrderInfo } from './payment-creation-dialog.config';

interface OrderSummaryCardProps {
  orderInfo: OrderInfo;
}

export function OrderSummaryCard({ orderInfo }: OrderSummaryCardProps) {
  const roundingAdjustmentLabel =
    orderInfo.roundingAdjustment > 0 ? 'text-[hsl(var(--color-success))]' : 'text-[hsl(var(--color-error))]';
  const roundingAdjustmentValue = `${orderInfo.roundingAdjustment > 0 ? '+' : ''}${formatCurrency(orderInfo.roundingAdjustment)}`;

  return (
    <div className="mb-4 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-4">
      <div className="grid gap-3">
        <SummaryItem label="订单号" value={orderInfo.orderNumber} />
        <SummaryItem label="客户名称" value={orderInfo.customerName} />
        <Separator />
        <SummaryItem
          label="商品总额"
          value={formatCurrency(orderInfo.totalAmount)}
          valueClassName="text-base font-bold text-[hsl(var(--color-text-primary))]"
        />
        {orderInfo.roundingAdjustment !== 0 && (
          <SummaryItem
            label="订单抹零"
            value={roundingAdjustmentValue}
            valueClassName={`text-sm font-semibold ${roundingAdjustmentLabel}`}
          />
        )}
        <Separator />
        <SummaryItem
          label="实际应收"
          value={formatCurrency(orderInfo.totalAmount + orderInfo.roundingAdjustment)}
          valueClassName="text-base font-bold text-[hsl(var(--color-primary))]"
        />
        <SummaryItem
          label="已收金额"
          value={formatCurrency(orderInfo.paidAmount)}
          valueClassName="text-sm text-[hsl(var(--color-success))]"
        />
        <SummaryItem
          label="待收金额"
          value={formatCurrency(orderInfo.remainingAmount)}
          valueClassName="text-lg font-bold text-[hsl(var(--color-warning))]"
        />
      </div>
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

function SummaryItem({ label, value, valueClassName }: SummaryItemProps) {
  return (
    <div className="flex justify-between">
      <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">{label}</span>
      <span className={valueClassName ?? 'text-sm font-semibold text-[hsl(var(--color-text-primary))]'}>
        {value}
      </span>
    </div>
  );
}

