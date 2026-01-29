'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, TrendingUp } from 'lucide-react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
    // ✅ 覆盖全局设置：从创建/编辑页面返回时总是重新获取统计，避免看到旧数据
    refetchOnMount: 'always',
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
    <div className="grid gap-6 md:grid-cols-3">
      {/* 总费用金额 - Stat Hub 核心指标 */}
      <Card className="group relative overflow-hidden border-none bg-white shadow-[0_10px_30px_rgba(59,130,246,0.08)]">
        <div className="absolute top-0 right-0 p-4 opacity-[0.05] transition-transform group-hover:scale-110">
          <ChineseYuan size={80} />
        </div>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ChineseYuan className="h-5 w-5" />
            </div>
            <span className="text-sm font-black tracking-widest text-slate-400 uppercase">
              全额累计支出
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tracking-tighter text-slate-900">
              {formatCurrency(statistics.totalAmount)}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              当前时段累计
            </div>
            <div className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-600 uppercase">
              {params.startDate} - {params.endDate}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 总记录数 - Stat Hub 数据分布 */}
      <Card className="group relative overflow-hidden border-none bg-white shadow-[0_10px_30px_rgba(30,41,59,0.05)]">
        <div className="absolute top-0 right-0 p-4 opacity-[0.05] transition-transform group-hover:scale-110">
          <FileText size={80} />
        </div>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-sm font-black tracking-widest text-slate-400 uppercase">
              账目条数统计
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter text-slate-900">
              {statistics.totalCount}
            </span>
            <span className="text-sm font-bold text-slate-400">项流水记录</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              数据实时监控中
            </div>
            <div className="flex h-3 items-center gap-1">
              <div className="h-full w-1 rounded-full bg-emerald-500" />
              <div className="h-full w-1 rounded-full bg-emerald-500" />
              <div className="h-full w-1 rounded-full bg-slate-200" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 平均费用金额 - Stat Hub 均值洞察 */}
      <Card className="group relative overflow-hidden border-none bg-white shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
        <div className="absolute top-0 right-0 p-4 opacity-[0.05] transition-transform group-hover:scale-110">
          <TrendingUp size={80} />
        </div>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-sm font-black tracking-widest text-slate-400 uppercase">
              单笔均值开支
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tracking-tighter text-amber-600">
              {formatCurrency(statistics.averageAmount)}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              单笔平均财务压力
            </div>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[65%] bg-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
