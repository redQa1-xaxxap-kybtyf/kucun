'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Calendar,
  MinusIcon,
  Receipt,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type { AnnualReport } from '@/lib/types/report';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

const AnnualReportCharts = dynamic(
  () => import('./annual-report-charts').then(mod => mod.AnnualReportCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[360px] w-full animate-pulse rounded-2xl bg-slate-50" />
        <div className="h-[360px] w-full animate-pulse rounded-2xl bg-slate-50" />
        <div className="h-[320px] w-full animate-pulse rounded-2xl bg-slate-50 lg:col-span-2" />
      </div>
    ),
  }
);

export function AnnualReportClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 获取年度报表数据（默认查看模式，使用缓存）
  const { data: report, isLoading } = useQuery({
    queryKey: queryKeys.finance.annualReport({ year }),
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        includeYearOverYear: 'true',
      });

      const response = await fetch(
        `/api/finance/reports/annual?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取年度报表失败');
      }

      const result = await response.json();
      return result.data as AnnualReport;
    },
  });

  // 生成年份选项（最近5年）
  const yearOptions = React.useMemo(() => {
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  }, [currentYear]);

  // 手动生成年度报表（强制刷新，绕过缓存）
  const handleGenerateReport = React.useCallback(async () => {
    try {
      setIsGenerating(true);

      const params = new URLSearchParams({
        year: year.toString(),
        includeYearOverYear: 'true',
        forceRefresh: 'true',
      });

      const response = await fetch(
        `/api/finance/reports/annual?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('生成年度报表失败');
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: AnnualReport;
        error?: string;
      };

      if (!result.success || !result.data) {
        throw new Error(result.error || '生成年度报表失败');
      }

      // 更新 React Query 缓存中的报表数据
      queryClient.setQueryData(
        queryKeys.finance.annualReport({ year }),
        result.data
      );

      toast({
        title: '报表已生成',
        description: `${year} 年度报表数据已重新计算并刷新`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '生成年度报表失败';
      toast({
        variant: 'destructive',
        title: '生成失败',
        description: message,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient, toast, year]);

  // 导出报表图片：统一使用默认 DIY 模板
  const handleExportImage = React.useCallback(async () => {
    if (!report) {
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: '当前没有可导出的报表数据',
      });
      return;
    }

    try {
      setIsExporting(true);

      const filename = `年度报表-${year}`;
      const { PrintTemplateExportService } =
        await import('@/lib/services/print-template-export-service');

      await PrintTemplateExportService.exportDataToImage({
        templateType: 'finance-annual-report',
        data: {
          ...report,
          reportMeta: {
            title: '年度报表',
            exportDate: new Date().toISOString().split('T')[0],
            year,
          },
        },
        filename,
        format: 'png',
        scale: 2,
        backgroundColor: '#ffffff',
      });

      toast({
        title: '导出成功',
        description: `报表图片已生成并下载 (${filename}.png)`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '导出年度报表图片失败';
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: message,
      });
    } finally {
      setIsExporting(false);
    }
  }, [report, toast, year]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <AnnualReportSkeleton />
      </div>
    );
  }

  if (!report) {
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
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)] sm:h-12 sm:w-12">
                  <Calendar className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    年度报表
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    查看年度营业收入、营业成本、利润趋势与费用结构
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isGenerating ? '生成中...' : '生成报表'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出报表图片'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 年份选择器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              选择年份
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <select
                value={year.toString()}
                onChange={e => setYear(parseInt(e.target.value, 10))}
                className="border-input bg-background ring-offset-background focus:ring-ring h-10 w-32 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
                aria-label="年份"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y.toString()}>
                    {y}年
                  </option>
                ))}
              </select>

              <Button variant="outline" onClick={() => setYear(currentYear)}>
                当前年份
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 年度核心指标 - 顶部大卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="年度销售总收入"
            value={report.summary.totalRevenue}
            icon={<ChineseYuan className="h-4 w-4" />}
            variant="primary"
            size="lg"
            comparison={report.yearOverYear?.revenue}
            subtitle={`年成交单量: ${report.summary.orderCount.toLocaleString()} 单`}
          />
          <StatCard
            title="年度累计利润"
            value={report.summary.totalProfit}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="success"
            size="lg"
            comparison={report.yearOverYear?.profit}
            subtitle={`平均月利润: ${formatCurrency(report.summary.totalProfit / 12)}`}
          />
          <StatCard
            title="平均利润率"
            value={report.summary.profitMargin}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="info"
            isCurrency={false}
            subtitle="经营效益综合评估"
          />
          <StatCard
            title="异常/预警提醒"
            value={report.alerts?.length || 0}
            icon={<Receipt className="h-4 w-4" />}
            variant={(report.alerts?.length ?? 0) > 0 ? 'warning' : 'default'}
            isCurrency={false}
            subtitle="待审计经营风险"
          />
        </div>

        {/* 经营绩效与效率 - 高清晰分组区 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              年度经营效率看板
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                月均营收: {formatCurrency(report.summary.averageMonthlyRevenue)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="总成交订单"
              value={report.summary.orderCount}
              icon={<Receipt className="h-4 w-4" />}
              variant="default"
              isCurrency={false}
            />
            <StatCard
              title="营业总成本"
              value={report.summary.totalCost}
              icon={<MinusIcon className="h-4 w-4" />}
              variant="neutral"
            />
            {report.inventoryTurnover && (
              <>
                <StatCard
                  title="库存周转率"
                  value={report.inventoryTurnover.turnoverRate}
                  icon={<RefreshCw className="h-4 w-4" />}
                  variant="info"
                  isCurrency={false}
                  subtitle="年度周转频次"
                />
                <StatCard
                  title="周转天数"
                  value={report.inventoryTurnover.turnoverDays}
                  icon={<Calendar className="h-4 w-4" />}
                  variant="info"
                  isCurrency={false}
                  subtitle="资产变现周期"
                />
              </>
            )}
          </div>
        </div>

        <AnnualReportCharts report={report} />

      </div>
    </div>
  );
}

// 统计卡片组件 (v3: 高清晰专业版，同步自月度报表)
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
              {isCurrency ? formatCurrency(value) : value.toLocaleString()}
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
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm',
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
              <span className="text-[11px] font-medium text-slate-400">
                较上期
              </span>
            </div>
          )}
          {subtitle && (
            <p className="text-[11px] leading-relaxed font-medium text-slate-500/80">
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
function AnnualReportSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>

      <div>
        <Skeleton className="mb-4 h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
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

      {[1, 2].map(i => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
