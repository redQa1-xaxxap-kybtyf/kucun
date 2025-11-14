'use client';

import { CheckCircle, Clock } from 'lucide-react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePayableStatistics } from '@/hooks/use-payable-statistics';
import type { PayableRecordQuery } from '@/lib/types/payable';
import { formatCurrency } from '@/lib/utils/format';

interface Props {
  filters?: PayableRecordQuery;
  initialStatistics?: {
    totalPayables: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    pendingCount: number;
    partialCount: number;
    paidCount: number;
  };
}

export function PayablesSummary({ filters, initialStatistics }: Props) {
  // ✅ 使用 TanStack Query 根据筛选条件动态获取统计数据
  const { data: statistics, isLoading } = usePayableStatistics({
    filters,
    enabled: true,
  });

  // 使用动态数据或初始数据
  const displayStatistics = statistics ||
    initialStatistics || {
      totalPayables: 0,
      totalPaidAmount: 0,
      totalRemainingAmount: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0,
    };

  const totalTrackedCount =
    displayStatistics.pendingCount +
    displayStatistics.partialCount +
    displayStatistics.paidCount;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总应付金额</CardTitle>
          <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-error))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-error))]">
            {formatCurrency(displayStatistics.totalPayables)}
          </div>
          <p className="text-muted-foreground text-xs">
            共 {totalTrackedCount} 个应付订单
          </p>
          <p className="text-muted-foreground text-xs">
            待付款 {displayStatistics.pendingCount} · 部分付款{' '}
            {displayStatistics.partialCount}
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
            {formatCurrency(displayStatistics.totalPaidAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            付款率{' '}
            {displayStatistics.totalPayables > 0
              ? Math.round(
                  (displayStatistics.totalPaidAmount /
                    displayStatistics.totalPayables) *
                    100
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
            {formatCurrency(displayStatistics.totalRemainingAmount)}
          </div>
          <p className="text-muted-foreground text-xs">待付款金额</p>
        </CardContent>
      </Card>
    </div>
  );
}
