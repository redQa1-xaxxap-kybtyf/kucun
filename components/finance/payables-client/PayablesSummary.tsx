'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';

import { CheckCircle, Clock } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

interface Props {
  statistics: {
    totalPayables: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    pendingCount: number;
    partialCount: number;
    paidCount: number;
  };
}

export function PayablesSummary({ statistics }: Props) {
  const totalTrackedCount =
    statistics.pendingCount + statistics.partialCount + statistics.paidCount;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总应付金额</CardTitle>
          <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-error))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-error))]">
            {formatCurrency(statistics.totalPayables)}
          </div>
          <p className="text-muted-foreground text-xs">
            共 {totalTrackedCount} 个应付订单
          </p>
          <p className="text-muted-foreground text-xs">
            待付款 {statistics.pendingCount} · 部分付款{' '}
            {statistics.partialCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已付金额</CardTitle>
          <CheckCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
            {formatCurrency(statistics.totalPaidAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            付款率{' '}
            {statistics.totalPayables > 0
              ? Math.round(
                  (statistics.totalPaidAmount / statistics.totalPayables) * 100
                )
              : 0}
            %
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">剩余应付</CardTitle>
          <Clock className="h-4 w-4 text-[hsl(var(--color-warning))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
            {formatCurrency(statistics.totalRemainingAmount)}
          </div>
          <p className="text-muted-foreground text-xs">待付款金额</p>
        </CardContent>
      </Card>
    </div>
  );
}
