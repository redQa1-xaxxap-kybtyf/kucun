'use client';

import { DollarSign } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

interface StatementFinancialSummaryProps {
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  currentBalance: number;
}

export function StatementFinancialSummary({
  totalOrders,
  totalAmount,
  paidAmount,
  currentBalance,
}: StatementFinancialSummaryProps) {
  const balanceLabel =
    currentBalance > 0 ? '应收余额' : currentBalance < 0 ? '应付余额' : '结清';
  const balanceClassName =
    currentBalance > 0
      ? 'text-[hsl(var(--color-success))]'
      : currentBalance < 0
        ? 'text-[hsl(var(--color-warning))]'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          财务汇总
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">总订单数</span>
          <span className="font-medium">{totalOrders} 个</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">总交易额</span>
          <span className="font-medium">
            {formatCurrency(Math.abs(totalAmount))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">累计收付</span>
          <span className="font-medium text-[hsl(var(--color-success))]">
            {formatCurrency(Math.abs(paidAmount))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">{balanceLabel}</span>
          <span className={`font-medium ${balanceClassName}`}>
            {formatCurrency(Math.abs(currentBalance))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
