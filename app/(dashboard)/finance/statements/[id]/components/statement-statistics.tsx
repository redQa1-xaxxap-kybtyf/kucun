'use client';

import { Activity, Clock, TrendingDown, TrendingUp, Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

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
  const monthTrend =
    summary.currentMonthAmount > summary.lastMonthAmount ? 'up' : 'down';

  return (
    <Card className="overflow-hidden border-slate-200/60 transition-all hover:shadow-lg">
      <CardHeader className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 italic">
          <Activity className="h-4 w-4" />
          经营绩效看板 (Performance KPI)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-px bg-slate-100 border-b border-slate-100">
          <div className="bg-white p-6 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">本月交易额</span>
              {monthTrend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <div className="text-xl font-black font-mono text-slate-900">
              {formatCurrency(summary.currentMonthAmount).replace('¥', '')}
            </div>
            <div className="mt-2 flex items-center gap-2">
               <span className={cn(
                 "text-[9px] font-bold px-1.5 py-0.5 rounded",
                 monthTrend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
               )}>
                 {monthTrend === 'up' ? '+' : ''}{((summary.currentMonthAmount / (summary.lastMonthAmount || 1) - 1) * 100).toFixed(1)}%
               </span>
               <span className="text-[9px] font-bold text-slate-300 uppercase">vs 上月同期</span>
            </div>
          </div>
          <div className="bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">平均付款周期</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900">
              {summary.averagePaymentDays} <span className="text-[10px] font-bold text-slate-400">DAYS</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
               <div 
                 className="h-full bg-blue-500 transition-all" 
                 style={{ width: `${Math.min((summary.averagePaymentDays / 60) * 100, 100)}%` }} 
               />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
               <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
               <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">账务回款健康度</span>
             </div>
             <span className="font-mono text-sm font-black text-slate-900">{summary.paymentRate.toFixed(1)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div 
              className={cn(
                "absolute h-full transition-all duration-1000",
                summary.paymentRate > 80 ? "bg-emerald-500" : summary.paymentRate > 50 ? "bg-amber-500" : "bg-rose-500"
              )}
              style={{ width: `${summary.paymentRate}%` }} 
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-300">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">月均交易强度</div>
                <div className="text-xs font-black text-slate-700">{formatCurrency(summary.averageMonthlyAmount)}</div>
             </div>
             <div className="rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-purple-300">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">上月实付基准</div>
                <div className="text-xs font-black text-slate-700">{formatCurrency(summary.lastMonthAmount)}</div>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
