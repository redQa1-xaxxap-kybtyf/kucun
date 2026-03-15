'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Calendar,
  MinusIcon,
  Package,
  Receipt,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import * as React from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type { MonthlyReport } from '@/lib/types/report';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import { buildMonthlyExpenseBreakdown } from '@/lib/utils/monthly-report-ui';

export function MonthlyReportClient() {
  const currentDate = new Date();
  const [year, setYear] = React.useState(currentDate.getFullYear());
  const [month, setMonth] = React.useState(currentDate.getMonth() + 1);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 获取月度报表数据（默认查看模式，使用缓存）
  const { data: report, isLoading } = useQuery({
    queryKey: queryKeys.finance.monthlyReport({ year, month }),
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        includeComparison: 'true',
      });

      const response = await fetch(
        `/api/finance/reports/monthly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取月度报表失败');
      }

      const result = await response.json();
      return result.data as MonthlyReport;
    },
  });

  // 生成年份选项（最近5年）
  const yearOptions = React.useMemo(() => {
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentDate.getFullYear() - i);
    }
    return years;
  }, [currentDate]);

  // 生成月份选项
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const expenseBreakdownItems = React.useMemo(
    () => (report ? buildMonthlyExpenseBreakdown(report.expenses) : []),
    [report]
  );

  // 手动生成报表（强制刷新，绕过缓存）
  const handleGenerateReport = React.useCallback(async () => {
    try {
      setIsGenerating(true);

      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        includeComparison: 'true',
        forceRefresh: 'true',
      });

      const response = await fetch(
        `/api/finance/reports/monthly?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('生成月度报表失败');
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: MonthlyReport;
        error?: string;
      };

      if (!result.success || !result.data) {
        throw new Error(result.error || '生成月度报表失败');
      }

      // 更新 React Query 缓存中的报表数据
      queryClient.setQueryData(
        queryKeys.finance.monthlyReport({ year, month }),
        result.data
      );

      toast({
        title: '报表已生成',
        description: `${year} 年 ${month} 月的月度报表数据已重新计算并刷新`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '生成月度报表图片失败';
      toast({
        variant: 'destructive',
        title: '生成失败',
        description: message,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [month, queryClient, toast, year]);

  // 导出报表为图片：统一使用默认 DIY 模板
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

      const filename = `月度报表-${year}-${String(month).padStart(2, '0')}`;
      const { PrintTemplateExportService } = await import(
        '@/lib/services/print-template-export-service'
      );

      await PrintTemplateExportService.exportDataToImage({
        templateType: 'finance-monthly-report',
        data: {
          ...report,
          reportMeta: {
            title: '月度报表',
            exportDate: new Date().toISOString().split('T')[0],
            year,
            month,
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
        error instanceof Error ? error.message : '导出报表图片失败';
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: message,
      });
    } finally {
      setIsExporting(false);
    }
  }, [month, report, toast, year]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <MonthlyReportSkeleton />
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
                    月度报表
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    查看月度营业收入、营业成本、费用支出与净利润数据
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

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              选择月份
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

              <select
                value={month.toString()}
                onChange={e => setMonth(parseInt(e.target.value, 10))}
                className="border-input bg-background ring-offset-background focus:ring-ring h-10 w-32 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
                aria-label="月份"
              >
                {monthOptions.map(m => (
                  <option key={m} value={m.toString()}>
                    {m}月
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                onClick={() => {
                  setYear(currentDate.getFullYear());
                  setMonth(currentDate.getMonth() + 1);
                }}
              >
                当前月份
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 核心指标 - 顶部大卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="本月销售总收入"
            value={report.revenue.salesRevenue}
            icon={<ChineseYuan className="h-4 w-4" />}
            variant="primary"
            size="lg"
            comparison={report.comparison?.revenue}
            subtitle={`样品费: ${formatCurrency(report.sample.sampleRevenue)}`}
          />
          <StatCard
            title="本月净利润"
            value={report.profit.netProfit}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="success"
            size="lg"
            comparison={report.comparison?.profit}
            subtitle={`净利率: ${report.profit.profitMargin.toFixed(2)}%`}
          />
          <StatCard
            title="库存总价值"
            value={report.inventoryTurnover?.averageInventoryValue || 0}
            icon={<Package className="h-4 w-4" />}
            variant="info"
            subtitle="资产健康状况"
          />
          <StatCard
            title="异常提醒"
            value={report.alerts?.length || 0}
            icon={<Receipt className="h-4 w-4" />}
            variant={(report.alerts?.length ?? 0) > 0 ? 'warning' : 'default'}
            isCurrency={false}
            subtitle="待处理审计项"
          />
        </div>

        {/* 收入与支出明细 - 高清晰分组区 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              收支明细中心
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                毛利率: {(report.profit.grossProfitMargin || 0).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <StatCard
              title="日均销售"
              value={report.revenue.salesRevenue / 30}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="平均客单价"
              value={report.revenue.averageOrderValue}
              icon={<ChineseYuan className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="样品费"
              value={report.sample.sampleRevenue}
              icon={<ChineseYuan className="h-4 w-4" />}
              variant="warning"
              subtitle={`${report.sample.orderCount} 单`}
            />
            <StatCard
              title="样品数量"
              value={report.sample.sampleQuantity}
              icon={<Package className="h-4 w-4" />}
              variant="info"
              isCurrency={false}
              subtitle={`${report.sample.customerCount} 位客户`}
            />
            <StatCard
              title="样品成本"
              value={report.sample.sampleCost}
              icon={<ChineseYuan className="h-4 w-4" />}
              variant="neutral"
            />
            <div className="my-2 h-px bg-slate-200 sm:col-span-2 lg:col-span-4 xl:col-span-5" />
            {expenseBreakdownItems.map(item => (
              <StatCard
                key={item.key}
                title={item.label}
                value={item.value}
                icon={
                  item.key === 'shipping' ? (
                    <Package className="h-3 w-3" />
                  ) : (
                    <ChineseYuan className="h-3 w-3" />
                  )
                }
                variant="neutral"
                subtitle={`${report.expenses.totalExpenses > 0 ? ((item.value / report.expenses.totalExpenses) * 100).toFixed(1) : '0.0'}% 总支出`}
              />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-500">
            说明：月度报表仅统计已审核费用。关联采购订单的费用会计入口径计入库存/成本，不重复计入当期期间费用。
          </div>
        </div>

        {/* 资产回收与供应链 - 分组区 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 资金回收看板 */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
              <ChineseYuan className="h-4 w-4 text-blue-500" />
              资金回收看板
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4">
                <div className="text-[10px] font-bold text-blue-600 uppercase">
                  累计应收 (回款率)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-black text-slate-900">
                    {formatCurrency(report.receivables.totalReceivable)}
                  </div>
                  <div className="text-xs font-bold text-blue-700">
                    {report.receivables.totalReceivable > 0
                      ? (
                          (report.receivables.receivedAmount /
                            report.receivables.totalReceivable) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-blue-200/50">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${report.receivables.totalReceivable > 0 ? (report.receivables.receivedAmount / report.receivables.totalReceivable) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/50 bg-slate-50 p-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  业务应付 (结算进度)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-black text-slate-900">
                    {formatCurrency(report.receivables.totalPayable)}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {report.receivables.totalPayable > 0
                      ? (
                          (report.receivables.paidAmount /
                            report.receivables.totalPayable) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-500"
                    style={{
                      width: `${report.receivables.totalPayable > 0 ? (report.receivables.paidAmount / report.receivables.totalPayable) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <span className="text-xs font-bold text-red-700">
                待收余额 (欠款):
              </span>
              <span className="text-lg font-black text-red-700">
                {formatCurrency(report.receivables.receivableBalance)}
              </span>
            </div>
          </div>

          {/* 供应链与直发分析 */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
              效率与直发绩效
            </h2>
            <div className="grid gap-3">
              {[
                {
                  label: '库存周转周期',
                  value: `${report.inventoryTurnover?.turnoverDays?.toFixed(0) ?? 'N/A'} 天`,
                  icon: <RefreshCw className="h-3 w-3" />,
                  color: 'text-emerald-600',
                },
                {
                  label: '厂家直发利润率',
                  value: `${report.factoryShipmentProfit?.averageProfitMargin?.toFixed(2) ?? '0.00'}%`,
                  icon: <TrendingUp className="h-3 w-3" />,
                  color: 'text-blue-600',
                },
                {
                  label: '直发订单贡献',
                  value: `${report.factoryShipmentProfit?.totalOrders ?? 0} 笔`,
                  icon: <Package className="h-3 w-3" />,
                  color: 'text-slate-600',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 p-3"
                >
                  <div className="flex items-center gap-2 font-bold text-slate-600">
                    {item.icon}
                    {item.label}
                  </div>
                  <div className={cn('text-lg font-black', item.color)}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 异常审计 - v3 风格内容 */}
        {report.alerts && report.alerts.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black tracking-widest text-amber-800 uppercase">
              <Receipt className="h-4 w-4" />
              智能风险审计建议
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {report.alerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-xl border border-amber-200/50 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                        alert.type === 'danger'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {alert.type === 'danger' ? '高风险' : '建议关注'}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-800">
                    {alert.title}
                  </div>
                  <div className="text-xs leading-relaxed text-slate-500">
                    {alert.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 统计卡片组件 (v3: 高清晰专业版)
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
  // 高级配色方案：极淡的背景 + 饱和度适中的语义色
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
          <div
            className={cn(
              'font-black tracking-tight text-slate-900',
              size === 'lg' ? 'text-3xl' : 'text-2xl'
            )}
          >
            {isCurrency ? formatCurrency(value) : value.toLocaleString()}
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg p-2 transition-transform group-hover:scale-110',
            iconStyles[variant]
          )}
        >
          {icon}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4">
        <div className="flex flex-col gap-2">
          {comparison && (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold shadow-sm',
                  comparison.trend === 'up'
                    ? 'bg-emerald-500 text-white'
                    : comparison.trend === 'down'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-400 text-white'
                )}
              >
                {comparison.trend === 'up' && (
                  <ArrowUpIcon className="mr-0.5 h-3 w-3" />
                )}
                {comparison.trend === 'down' && (
                  <ArrowDownIcon className="mr-0.5 h-3 w-3" />
                )}
                {comparison.trend === 'stable' && (
                  <MinusIcon className="mr-0.5 h-3 w-3" />
                )}
                {Math.abs(comparison.changeRate).toFixed(1)}%
              </div>
              <span className="text-[10px] font-medium text-slate-500 italic">
                较上月
              </span>
            </div>
          )}
          {subtitle && (
            <p className="mt-1 line-clamp-1 border-t border-slate-200/50 pt-2 text-[11px] leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>

      {/* 底部装饰线条，增加专业感 */}
      <div
        className={cn(
          'h-1 w-full opacity-30',
          variant === 'primary'
            ? 'bg-blue-600'
            : variant === 'success'
              ? 'bg-emerald-600'
              : variant === 'error'
                ? 'bg-red-600'
                : variant === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-slate-300'
        )}
      />
    </Card>
  );
}

// 加载骨架屏
function MonthlyReportSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>

      {[1, 2, 3, 4].map(section => (
        <div key={section}>
          <Skeleton className="mb-4 h-6 w-24" />
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
        </div>
      ))}
    </div>
  );
}
