'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownIcon,
  ArrowUpIcon,
  Calendar,
  Eye,
  MinusIcon,
  Package,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type { ProfitLossAnalysis } from '@/lib/types/report';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

const ProfitLossTrendChart = dynamic(
  () =>
    import('./profit-loss-trend-chart').then(mod => mod.ProfitLossTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full animate-pulse rounded-2xl bg-slate-50" />
    ),
  }
);

const DateRangePicker = dynamic(
  () =>
    import('@/components/ui/date-range-picker').then(
      mod => mod.DateRangePicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
    ),
  }
);

export function ProfitLossClient() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [startDate, setStartDate] = React.useState(
    firstDayOfMonth.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = React.useState(now.toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = React.useState<'day' | 'week' | 'month'>('day');

  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);

  // 安全百分比计算
  const safePercent = (num: number, den: number) => {
    if (!den || den === 0) return 0;
    return (num / den) * 100;
  };

  // 获取盈亏分析数据
  const { data: analysis, isLoading } = useQuery({
    queryKey: queryKeys.finance.profitLoss({ startDate, endDate }),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy,
        includeComparison: 'false',
      });

      const response = await fetch(
        `/api/finance/reports/profit-loss?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取盈亏分析失败');
      }

      const result = await response.json();
      return result.data as ProfitLossAnalysis;
    },
  });

  // 导出图片：统一使用默认 DIY 模板
  const handleExportImage = React.useCallback(async () => {
    if (!analysis || isExporting) return;
    setIsExporting(true);
    try {
      const filename = `盈亏分析报告-${startDate}-${endDate}`;
      const { PrintTemplateExportService } =
        await import('@/lib/services/print-template-export-service');

      await PrintTemplateExportService.exportDataToImage({
        templateType: 'finance-profit-loss-report',
        data: {
          ...analysis,
          reportMeta: {
            title: '盈亏分析',
            exportDate: new Date().toISOString().split('T')[0],
            startDate,
            endDate,
            groupBy,
          },
        },
        filename,
        format: 'png',
        scale: 2,
        backgroundColor: '#ffffff',
      });

      toast({ title: '导出成功', description: '分析报告已生成' });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [analysis, endDate, groupBy, isExporting, startDate, toast]);

  // 快捷日期选择
  const handleQuickSelect = (type: string) => {
    const today = new Date();
    let start: Date;
    const end = today;

    switch (type) {
      case 'today':
        start = today;
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(
          today.getFullYear(),
          Math.floor(today.getMonth() / 3) * 3,
          1
        );
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <ProfitLossSkeleton />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            暂无数据
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 shadow-[0_10px_24px_rgba(59,130,246,0.3)] sm:h-12 sm:w-12">
                  <TrendingUp className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl">
                    盈亏多维分析{' '}
                    <span className="ml-2 text-xs font-normal opacity-60 sm:text-sm">
                      利润与亏损分析
                    </span>
                  </h1>
                  <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                    经营状况深度透视 · 实时财务健康看板
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportImage()}
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  导出分析报告
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日期筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              选择日期范围
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <DateRangePicker
                  value={{
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                  }}
                  onChange={({
                    startDate: nextStartDate,
                    endDate: nextEndDate,
                  }) => {
                    setStartDate(nextStartDate ?? '');
                    setEndDate(nextEndDate ?? '');
                  }}
                  label="日期范围"
                  placeholder="选择日期范围"
                  showPresets
                  showClearButton
                  className="w-full md:w-[240px]"
                />
                <div>
                  <Label htmlFor="groupBy">趋势分组</Label>
                  <select
                    id="groupBy"
                    value={groupBy}
                    onChange={e =>
                      setGroupBy(e.target.value as 'day' | 'week' | 'month')
                    }
                    className={cn(
                      'border-input bg-background ring-offset-background focus:ring-ring mt-2 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  >
                    <option value="day">按天</option>
                    <option value="week">按周</option>
                    <option value="month">按月</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('today')}
                >
                  今天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('week')}
                >
                  最近7天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('month')}
                >
                  本月
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('quarter')}
                >
                  本季度
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('year')}
                >
                  本年
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 盈亏状态“超级卡片” (Status Hub) */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col md:flex-row">
            <div
              className={cn(
                'flex flex-1 flex-col items-center justify-center p-8 text-center transition-colors lg:p-12',
                analysis.status === 'profit'
                  ? 'bg-emerald-50 text-emerald-900'
                  : analysis.status === 'loss'
                    ? 'bg-rose-50 text-rose-900'
                    : 'bg-slate-50 text-slate-900'
              )}
            >
              <div className="mb-2 text-xs font-black tracking-[0.2em] uppercase opacity-60">
                当前经营状态
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full shadow-lg',
                    analysis.status === 'profit'
                      ? 'bg-emerald-500 text-white'
                      : analysis.status === 'loss'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-500 text-white'
                  )}
                >
                  {analysis.status === 'profit' ? (
                    <TrendingUp className="h-6 w-6" />
                  ) : analysis.status === 'loss' ? (
                    <TrendingDown className="h-6 w-6" />
                  ) : (
                    <RefreshCw className="h-6 w-6" />
                  )}
                </div>
                <div className="text-4xl font-black lg:text-5xl">
                  {analysis.status === 'profit'
                    ? '盈利'
                    : analysis.status === 'loss'
                      ? '亏损'
                      : '盈亏平衡'}
                </div>
              </div>
              <div className="mt-6 font-mono text-3xl font-black tracking-tighter lg:text-4xl">
                {formatCurrency(Math.abs(analysis.profit.netProfit))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-bold opacity-70">
                <span className="uppercase">净利率:</span>
                <span className="rounded-full bg-white/50 px-3 py-0.5 shadow-sm">
                  {analysis.profit.netProfitMargin.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="grid flex-[1.5] grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-center border-r border-b border-slate-100 p-6 lg:p-8">
                <div className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  销售总收入
                </div>
                <div className="mt-2 font-mono text-xl font-black text-slate-900">
                  {formatCurrency(analysis.revenue.totalRevenue)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  成交单量: {analysis.revenue.orderCount}
                </div>
              </div>
              <div className="flex flex-col justify-center border-r border-b border-slate-100 p-6 lg:p-8">
                <div className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  营业总成本
                </div>
                <div className="mt-2 font-mono text-xl font-black text-slate-900">
                  {formatCurrency(analysis.costs.totalCost)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  成本率: {analysis.costs.costRate.toFixed(2)}%
                </div>
              </div>
              <div className="flex flex-col justify-center border-b border-slate-100 p-6 lg:border-r-0 lg:p-8">
                <div className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  经营总费用
                </div>
                <div className="mt-2 font-mono text-xl font-black text-slate-900">
                  {formatCurrency(analysis.expenses.totalExpenses)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  费用率: {analysis.expenses.expenseRate.toFixed(2)}%
                </div>
              </div>
              <div className="flex flex-col justify-center border-r border-slate-100 p-6 lg:p-8">
                <div className="text-xs font-black tracking-widest text-emerald-600 uppercase">
                  综合毛利润
                </div>
                <div className="mt-2 font-mono text-xl font-black text-emerald-600">
                  {formatCurrency(analysis.profit.grossProfit)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  毛利率: {analysis.profit.grossProfitMargin.toFixed(2)}%
                </div>
              </div>
              <div className="flex flex-col justify-center border-r border-slate-100 p-6 lg:p-8">
                <div className="text-xs font-black tracking-widest text-blue-600 uppercase">
                  直发业务利润
                </div>
                <div className="mt-2 font-mono text-xl font-black text-blue-600">
                  {formatCurrency(
                    analysis.factoryShipmentProfit.customerProfit
                  )}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  占比:{' '}
                  {analysis.factoryShipmentProfit.percentageOfTotal.toFixed(1)}%
                </div>
              </div>
              <div className="flex flex-col justify-center p-6 lg:p-8">
                <div className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  营业经营利润
                </div>
                <div className="mt-2 font-mono text-xl font-black text-slate-900">
                  {formatCurrency(analysis.profit.operatingProfit)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  盈亏平衡点: 100%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 核心指标高清晰分区 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 收入流深度分析 */}
          <section className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-blue-500" />
                <h2 className="text-sm font-black tracking-widest text-slate-900 uppercase">
                  收入构成深度分析
                </h2>
              </div>
              <Eye className="h-4 w-4 text-slate-300" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                title="销售收入（含样品）"
                value={analysis.revenue.salesRevenue}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="info"
              />
              <StatCard
                title="样品费收入"
                value={analysis.sample.sampleRevenue}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="warning"
                subtitle={`${analysis.sample.orderCount} 张样品单`}
              />
              <StatCard
                title="厂家直发收入"
                value={analysis.revenue.factoryShipmentRevenue}
                icon={<Package className="h-4 w-4" />}
                variant="primary"
              />
              <StatCard
                title="其他经营收入"
                value={analysis.revenue.otherRevenue}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="neutral"
              />
              <StatCard
                title="收入规模总计"
                value={analysis.revenue.totalRevenue}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="info"
                subtitle={`样品数量: ${analysis.sample.sampleQuantity}`}
              />
            </div>
          </section>

          {/* 费用成本结构 */}
          <section className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-amber-500" />
                <h2 className="text-sm font-black tracking-widest text-slate-900 uppercase">
                  支出成本结构透视
                </h2>
              </div>
              <RefreshCw className="h-4 w-4 text-slate-300" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                title="销售产品成本"
                value={analysis.costs.salesCost}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="warning"
              />
              <StatCard
                title="库存价值变化"
                value={analysis.costs.inventoryCost}
                icon={<Package className="h-4 w-4" />}
                variant="neutral"
              />
              <StatCard
                title="各项经营费用"
                value={analysis.expenses.totalExpenses}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="error"
                subtitle={`费用率: ${analysis.expenses.expenseRate.toFixed(2)}%`}
              />
              <StatCard
                title="支出成本总计"
                value={
                  analysis.costs.totalCost + analysis.expenses.totalExpenses
                }
                icon={<TrendingDown className="h-4 w-4" />}
                variant="warning"
              />
            </div>
          </section>
        </div>

        {/* 费用细分看板 (v3 紧凑式) */}
        <section className="rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-slate-50 pb-4">
            <h2 className="text-sm font-black tracking-widest text-slate-900 uppercase italic">
              费用开支明细账目
            </h2>
            <div className="text-xs font-bold text-slate-400">
              数据更新于: {new Date().toLocaleDateString()}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {[
              { label: '运费', value: analysis.expenses.shipping },
              { label: '仓储费', value: analysis.expenses.storage },
              { label: '工资', value: analysis.expenses.labor },
              { label: '营业费', value: analysis.expenses.operating },
              { label: '管理费', value: analysis.expenses.management },
              { label: '差旅费', value: analysis.expenses.travel },
              { label: '生活费', value: analysis.expenses.living },
              { label: '装卸费', value: analysis.expenses.loading_unloading },
              { label: '其他费用', value: analysis.expenses.other },
            ].map(item => (
              <div
                key={item.label}
                className="flex flex-col rounded-xl bg-slate-50/50 p-4 transition-colors hover:bg-slate-100"
              >
                <span className="text-xs font-black text-slate-400 uppercase">
                  {item.label}
                </span>
                <span className="mt-2 font-mono text-sm font-black text-slate-900">
                  {formatCurrency(item.value)}
                </span>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-slate-400"
                    style={{
                      width: `${safePercent(item.value, analysis.expenses.totalExpenses)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 利润深度透视 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-100 bg-emerald-50/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-emerald-500" />
                <h2 className="font-mono text-sm font-black tracking-widest text-slate-900 uppercase">
                  核心盈利能力评估
                </h2>
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                title="经营毛利润清单"
                value={analysis.profit.grossProfit}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="success"
                subtitle={`毛利率: ${analysis.profit.grossProfitMargin.toFixed(2)}%`}
              />
              <StatCard
                title="营业核心利润"
                value={analysis.profit.operatingProfit}
                icon={<RefreshCw className="h-4 w-4" />}
                variant="success"
              />
              <StatCard
                title="结算净利润额"
                value={analysis.profit.netProfit}
                icon={<Receipt className="h-4 w-4" />}
                variant="primary"
                subtitle={`净利率: ${analysis.profit.netProfitMargin.toFixed(2)}%`}
                size="lg"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-blue-50/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-blue-500" />
                <h2 className="font-mono text-sm font-black tracking-widest text-slate-900 uppercase">
                  直发业务利润分析
                </h2>
              </div>
              <Package className="h-4 w-4 text-blue-400" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                title="客户结算货利润"
                value={analysis.factoryShipmentProfit.customerProfit}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="info"
              />
              <StatCard
                title="自有货出库成本"
                value={analysis.factoryShipmentProfit.selfCostAmount}
                icon={<TrendingDown className="h-4 w-4" />}
                variant="neutral"
              />
              <StatCard
                title="直发环节占比"
                value={analysis.factoryShipmentProfit.percentageOfTotal}
                icon={<RefreshCw className="h-4 w-4" />}
                variant="info"
                isCurrency={false}
                subtitle={`${analysis.factoryShipmentProfit.percentageOfTotal.toFixed(2)}% 贡献占比`}
              />
              <StatCard
                title="直发综合利润率"
                value={analysis.factoryShipmentProfit.profitMargin}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="success"
                isCurrency={false}
                subtitle={`${analysis.factoryShipmentProfit.profitMargin.toFixed(2)}% 利润空间`}
              />
            </div>
          </section>
        </div>

        {/* 趋势图表 */}
        <ProfitLossTrendChart trend={analysis.trend} />

        {/* 预警信息 */}
        {analysis.alerts && analysis.alerts.length > 0 && (
          <Card className="rounded-2xl border-rose-100 bg-rose-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-900">
                <AlertCircle className="h-5 w-5" />
                异常监控预警
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      'rounded-xl border p-4 shadow-sm transition-all hover:shadow-md',
                      alert.type === 'danger'
                        ? 'border-rose-200 bg-white text-rose-700'
                        : alert.type === 'warning'
                          ? 'border-amber-200 bg-white text-amber-700'
                          : 'border-blue-200 bg-white text-blue-700'
                    )}
                  >
                    <div className="flex items-center gap-2 font-black tracking-tight uppercase">
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          alert.type === 'danger'
                            ? 'bg-rose-500'
                            : alert.type === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        )}
                      />
                      {alert.title}
                    </div>
                    <div className="mt-1 ml-1 border-l border-slate-100 pl-4 text-sm font-medium opacity-80">
                      {alert.message}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

// 统计卡片组件 (v3: 高清晰专业版，同步自报表系统)
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  isCurrency?: boolean;
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  comparison?: {
    current: number;
    previous: number;
    change: number;
    changeRate: number;
    trend: 'up' | 'down' | 'stable';
  };
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  isCurrency = true,
  variant = 'default',
  size = 'md',
  comparison,
}: StatCardProps) {
  const themeStyles = {
    default: 'border-slate-200 bg-white text-slate-600',
    primary: 'border-blue-100 bg-blue-50/30 text-blue-700',
    success: 'border-emerald-100 bg-emerald-50/30 text-emerald-700',
    warning: 'border-amber-100 bg-amber-50/30 text-amber-700',
    error: 'border-red-100 bg-red-50/30 text-red-700',
    info: 'border-sky-100 bg-sky-50/30 text-sky-700',
    neutral: 'border-slate-200 bg-slate-50/50 text-slate-600',
  };

  const iconStyles = {
    default: 'bg-slate-100 text-slate-500',
    primary: 'bg-blue-100 text-blue-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    error: 'bg-red-100 text-red-600',
    info: 'bg-sky-100 text-sky-600',
    neutral: 'bg-slate-200 text-slate-600',
  };

  return (
    <Card
      className={cn(
        'group hover:border-opacity-50 relative overflow-hidden border transition-all duration-300 hover:shadow-md',
        themeStyles[variant],
        size === 'lg' ? 'md:col-span-2 lg:col-span-1' : ''
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5 pt-5 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xs font-bold tracking-wider uppercase opacity-80">
            {title}
          </CardTitle>
          <div className="flex flex-col">
            <div
              className={cn(
                'font-black tracking-tight',
                size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'
              )}
            >
              {isCurrency
                ? formatCurrency(value)
                : typeof value === 'number'
                  ? value.toLocaleString()
                  : value}
            </div>
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg p-2 transition-transform duration-300 group-hover:scale-110',
            iconStyles[variant]
          )}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-0 pb-5">
        <div className="flex flex-col gap-2">
          {comparison && (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm',
                  comparison.trend === 'up'
                    ? 'bg-emerald-500 text-white'
                    : comparison.trend === 'down'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-500 text-white'
                )}
              >
                {comparison.trend === 'up' ? (
                  <ArrowUpIcon className="h-3 w-3" />
                ) : comparison.trend === 'down' ? (
                  <ArrowDownIcon className="h-3 w-3" />
                ) : (
                  <MinusIcon className="h-3 w-3" />
                )}
                {Math.abs(comparison.changeRate).toFixed(1)}%
              </div>
              <span className="text-xs font-medium text-slate-400">较上期</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs leading-relaxed font-medium text-slate-500/80">
              {subtitle}
            </p>
          )}
        </div>
        {/* 底部装饰线 */}
        <div
          className={cn(
            'absolute bottom-0 left-0 h-1 w-full opacity-30',
            variant === 'primary'
              ? 'bg-blue-500'
              : variant === 'success'
                ? 'bg-emerald-500'
                : variant === 'warning'
                  ? 'bg-amber-500'
                  : variant === 'error'
                    ? 'bg-red-500'
                    : variant === 'info'
                      ? 'bg-sky-500'
                      : 'bg-slate-300'
          )}
        />
      </CardContent>
    </Card>
  );
}

// 加载骨架屏
function ProfitLossSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {[1, 2, 3, 4, 5].map(section => (
        <div key={section}>
          <Skeleton className="mb-4 h-6 w-24" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
