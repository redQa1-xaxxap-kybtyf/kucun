'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

import type { SalesOrderDetail } from './types';

interface OrderReconciliationSummaryCardProps {
  order: SalesOrderDetail;
}

export function OrderReconciliationSummaryCard({
  order,
}: OrderReconciliationSummaryCardProps) {
  const orderAmount = Number(order.totalAmount ?? 0);

  // 已退货金额：所有非取消退货单的退款金额之和
  const returnedAmount = (order.returnOrders ?? []).reduce(
    (sum, returnOrder) => sum + Number(returnOrder.refundAmount ?? 0),
    0
  );

  // 已收款（实际到账，不含抹零差额）
  const receivedAmount = Number(order.actualPaidAmount ?? 0);

  // 已退款（根据退款记录汇总的已处理金额）
  const refundedAmount = Number(order.refundedAmount ?? 0);

  // 本单未结 = 后端计算的 remainingAmount（与其他模块保持一致）
  const remainingAmount = Number(order.remainingAmount ?? 0);

  return (
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
          本单对账摘要
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-xs">
          帮助你从订单视角快速看清：本单卖了多少、收了多少、退了多少、还差多少。
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm">
          <SummaryRow label="订单金额" value={formatCurrency(orderAmount)} />
          <SummaryRow
            label="已退货金额"
            value={formatCurrency(returnedAmount)}
          />
          <SummaryRow
            label="已收款金额"
            value={formatCurrency(receivedAmount)}
          />
          <SummaryRow
            label="已退款金额"
            value={formatCurrency(refundedAmount)}
          />
          <Separator className="my-1" />
          <SummaryRow
            label="本单未结金额"
            value={formatCurrency(remainingAmount)}
            valueClassName="text-base font-bold text-[hsl(var(--color-warning))]"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function SummaryRow({ label, value, valueClassName }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[hsl(var(--color-text-tertiary))]">{label}</span>
      <span
        className={
          valueClassName ??
          'font-semibold text-[hsl(var(--color-text-primary))]'
        }
      >
        {value}
      </span>
    </div>
  );
}
