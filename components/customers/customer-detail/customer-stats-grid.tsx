'use client';

import { RotateCcw, ShoppingCart, Wallet } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface CustomerStatsGridProps {
  salesOrderCount: number;
  returnOrderCount: number;
  unpaidOrderCount: number;
  totalSalesAmount: number;
  totalReturnAmount: number;
  totalUnpaidAmount: number;
}

export function CustomerStatsGrid({
  salesOrderCount,
  returnOrderCount,
  unpaidOrderCount,
  totalSalesAmount,
  totalReturnAmount,
  totalUnpaidAmount,
}: CustomerStatsGridProps) {
  return (
    <div className="space-y-2.5">
      <StatsCard
        title="累计销售"
        icon={<ShoppingCart className="h-4 w-4 text-green-600" />}
        iconWrapperClass="bg-green-100"
        amount={formatCurrency(totalSalesAmount)}
        countLabel="订单数"
        count={salesOrderCount}
        amountClass="text-green-600"
      />

      {totalReturnAmount > 0 && (
        <StatsCard
          title="累计退货"
          icon={<RotateCcw className="h-4 w-4 text-red-600" />}
          iconWrapperClass="bg-red-100"
          amount={formatCurrency(totalReturnAmount)}
          countLabel="退货单数"
          count={returnOrderCount}
          amountClass="text-red-600"
        />
      )}

      <StatsCard
        title="未收款"
        icon={<Wallet className="h-4 w-4 text-orange-600" />}
        iconWrapperClass="bg-orange-100"
        amount={formatCurrency(totalUnpaidAmount)}
        countLabel="待收款订单"
        count={unpaidOrderCount}
        amountClass="text-orange-600"
      />
    </div>
  );
}

interface StatsCardProps {
  title: string;
  icon: React.ReactNode;
  iconWrapperClass: string;
  amount: string;
  amountClass?: string;
  countLabel: string;
  count: number | string;
}

function StatsCard({
  title,
  icon,
  iconWrapperClass,
  amount,
  amountClass,
  countLabel,
  count,
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconWrapperClass}`}
            >
              {icon}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{title}</p>
              <p className={`text-xl font-bold ${amountClass}`}>{amount}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{count}</p>
            <p className="text-muted-foreground text-xs">{countLabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
