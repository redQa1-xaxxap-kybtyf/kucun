'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';

import { useQuery } from '@tanstack/react-query';
import { FileText, TrendingUp } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import type { ExpenseStatisticsParams } from '@/lib/types/expense';
import { formatCurrency } from '@/lib/utils/format';

interface ExpenseStatisticsProps {
  params: ExpenseStatisticsParams;
}

export function ExpenseStatistics({ params }: ExpenseStatisticsProps) {
  // 获取统计数据
  const { data: statistics, isLoading } = useQuery({
    queryKey: queryKeys.finance.expensesStatistics(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        groupBy: params.groupBy || 'type',
      });

      if (params.expenseType) {
        searchParams.set('expenseType', params.expenseType);
      }

      const response = await fetch(
        `/api/finance/expenses/statistics?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* 总费用金额 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总费用金额</CardTitle>
          <ChineseYuan className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.totalAmount)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {params.startDate} 至 {params.endDate}
          </p>
        </CardContent>
      </Card>

      {/* 总记录数 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总记录数</CardTitle>
          <FileText className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalCount}</div>
          <p className="text-muted-foreground mt-1 text-xs">
            共 {statistics.totalCount} 条费用记录
          </p>
        </CardContent>
      </Card>

      {/* 平均费用金额 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均费用金额</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.averageAmount)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">每条记录平均金额</p>
        </CardContent>
      </Card>
    </div>
  );
}
