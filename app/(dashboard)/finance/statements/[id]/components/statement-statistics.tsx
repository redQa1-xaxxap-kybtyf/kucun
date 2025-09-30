'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatementStatisticsProps {
  summary: {
    currentMonthAmount: number;
    lastMonthAmount: number;
    averageMonthlyAmount: number;
    paymentRate: number;
    averagePaymentDays: number;
  };
}

/**
 * 账单统计分析卡片组件
 */
export function StatementStatistics({ summary }: StatementStatisticsProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const monthTrend =
    summary.currentMonthAmount > summary.lastMonthAmount ? 'up' : 'down';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {monthTrend === 'up' ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600" />
          )}
          统计分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">本月交易额</span>
          <span className="font-medium">
            {formatCurrency(summary.currentMonthAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">上月交易额</span>
          <span className="font-medium">
            {formatCurrency(summary.lastMonthAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">月均交易额</span>
          <span className="font-medium">
            {formatCurrency(summary.averageMonthlyAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">付款率</span>
          <span className="font-medium">{summary.paymentRate}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">平均付款天数</span>
          <span className="font-medium">{summary.averagePaymentDays} 天</span>
        </div>
      </CardContent>
    </Card>
  );
}
