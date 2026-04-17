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
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

const AnnualReportCharts = dynamic(
  () => import('./annual-report-charts').then(mod => mod.AnnualReportCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[360px] w-full animate-pulse rounded-2xl bg-slate-50" />
        <div className="h-[360px] w-full animate-pulse rounded-2xl bg-slate-50" />
        <div className="h-[320px] w-full animate-pulse rounded-2xl bg-slate-50 xl:col-span-2" />
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
        title: '报表已刷新',
        description: `${year} 年的报表已经更新`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '刷新失败',
        description: getFriendlyErrorMessage(
          error,
          '年度报表暂时无法刷新，请稍后重试'
        ),
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
      const { PrintTemplateExportService } = await import(
        '@/lib/services/print-template-export-service'
      );

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
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: getFriendlyErrorMessage(
          error,
          '报表图片暂时无法导出，请稍后重试'
        ),
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
            当前年份还没有报表数据
          </CardContent>
        </Card>
      </div>
    );
  }

  const purchaseDamage = report.purchaseDamage ?? {
    totalQuantity: 0,
    totalAmount: 0,
    purchaseInbound: { quantity: 0, amount: 0 },
    manualDamage: { quantity: 0, amount: 0 },
    supplierClaim: { quantity: 0, amount: 0 },
    internalLoss: { quantity: 0, amount: 0 },
    manualDamageByCategory: {
      damage: { quantity: 0, amount: 0 },
      scrap: { quantity: 0, amount: 0 },
      loss: { quantity: 0, amount: 0 },
      other: { quantity: 0, amount: 0 },
    },
    manualDamageByHandling: {
      pendingConfirm: { quantity: 0, amount: 0 },
      supplierClaim: { quantity: 0, amount: 0 },
      internalLoss: { quantity: 0, amount: 0 },
    },
  };
  const sampleSourceSummary = `样品单 ${report.sample.sources.sampleOrder.recordCount} 条，手工样品出库 ${report.sample.sources.manualOutbound.recordCount} 条`;
  const manualDamageCategoryItems = [
    { label: '破损', value: purchaseDamage.manualDamageByCategory.damage },
    { label: '报废', value: purchaseDamage.manualDamageByCategory.scrap },
    { label: '丢失', value: purchaseDamage.manualDamageByCategory.loss },
    { label: '其他', value: purchaseDamage.manualDamageByCategory.other },
  ];
  const manualDamageHandlingItems = [
    {
      label: '待确认',
      value: purchaseDamage.manualDamageByHandling.pendingConfirm,
    },
    {
      label: '找工厂赔付',
      value: purchaseDamage.manualDamageByHandling.supplierClaim,
    },
    {
      label: '内部承担',
      value: purchaseDamage.manualDamageByHandling.internalLoss,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between xl:items-center">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)] sm:h-12 sm:w-12">
                  <Calendar className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    年度报表
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    查看年度收入、成本、费用结构和利润趋势
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="h-11 justify-center shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)] sm:min-w-[140px]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isGenerating ? '刷新中...' : '刷新报表'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="h-11 justify-center shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)] sm:min-w-[140px]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出图片'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 年份选择器 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              选择年份
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
              <select
                value={year.toString()}
                onChange={e => setYear(parseInt(e.target.value, 10))}
                className="border-input bg-background ring-offset-background focus:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:w-40"
                aria-label="年份"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y.toString()}>
                    {y}年
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                onClick={() => setYear(currentYear)}
                className="w-full sm:w-auto"
              >
                当前年份
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 py-3 text-xs leading-5 text-[hsl(var(--color-text-secondary))]">
            说明：年度报表只统计已经审核入账的费用；关联采购的费用已经计入库存或成本，不会重复记到期间费用。
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 px-4 py-3 text-xs leading-5 text-[hsl(var(--color-text-secondary))]">
            <p>
              破损统计说明：本年到货破损{' '}
              {purchaseDamage.purchaseInbound.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.purchaseInbound.amount)}，手工报损{' '}
              {purchaseDamage.manualDamage.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.manualDamage.amount)}。到货破损里，报工厂{' '}
              {purchaseDamage.supplierClaim.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.supplierClaim.amount)}，内部承担{' '}
              {purchaseDamage.internalLoss.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.internalLoss.amount)}。
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-2 text-[11px] font-medium text-slate-700">
                  手工报损按类型
                </div>
                <div className="flex flex-wrap gap-2">
                  {manualDamageCategoryItems.map(item => (
                    <span
                      key={item.label}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                    >
                      {item.label} {item.value.quantity.toLocaleString()} 片 /{' '}
                      {formatCurrency(item.value.amount)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-2 text-[11px] font-medium text-slate-700">
                  手工报损按处理方式
                </div>
                <div className="flex flex-wrap gap-2">
                  {manualDamageHandlingItems.map(item => (
                    <span
                      key={item.label}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                    >
                      {item.label} {item.value.quantity.toLocaleString()} 片 /{' '}
                      {formatCurrency(item.value.amount)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p>
              金额按采购入库时的元/片成本折算，用于经营追踪和责任核对。
            </p>
          </CardContent>
        </Card>

        {/* 年度核心指标 - 顶部大卡片 */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
            title="年度破损片数"
            value={purchaseDamage.totalQuantity}
            icon={<Receipt className="h-4 w-4" />}
            variant="warning"
            isCurrency={false}
            subtitle="含到货破损和手工报损"
          />
          <StatCard
            title="年度破损金额"
            value={purchaseDamage.totalAmount}
            icon={<ChineseYuan className="h-4 w-4" />}
            variant="error"
            subtitle="按采购元/片成本折算"
          />
          <StatCard
            title="待处理提醒"
            value={report.alerts?.length || 0}
            icon={<Receipt className="h-4 w-4" />}
            variant={(report.alerts?.length ?? 0) > 0 ? 'warning' : 'default'}
            isCurrency={false}
            subtitle="建议尽快处理"
          />
        </div>

        {/* 经营绩效与效率 - 高清晰分组区 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              年度经营效率看板
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                月均营收: {formatCurrency(report.summary.averageMonthlyRevenue)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                年度样品分析
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                title="样品费"
                value={report.sample.sampleRevenue}
                icon={<ChineseYuan className="h-4 w-4" />}
                variant="warning"
                subtitle={sampleSourceSummary}
              />
              <StatCard
                title="样品成本"
                value={report.sample.sampleCost}
                icon={<Receipt className="h-4 w-4" />}
                variant="neutral"
              />
              <StatCard
                title="样品数量"
                value={report.sample.sampleQuantity}
                icon={<Receipt className="h-4 w-4" />}
                variant="info"
                isCurrency={false}
              />
              <StatCard
                title="领取客户数"
                value={report.sample.customerCount}
                icon={<Calendar className="h-4 w-4" />}
                variant="default"
                isCurrency={false}
                subtitle={`共 ${report.sample.orderCount} 条样品记录`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                样品客户排行
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                按样品数量排序
              </span>
            </div>
            {report.sample.topCustomers.length > 0 ? (
              <div className="space-y-3">
                {report.sample.topCustomers.map((customer, index) => (
                  <div
                    key={customer.customerId}
                    className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-100 px-3 py-3 sm:grid-cols-[40px_minmax(0,1fr)_auto_auto] sm:items-center"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {customer.customerName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {customer.orderCount} 条样品记录
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                      <div className="text-xs text-slate-400">样品数量</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {customer.sampleQuantity}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                      <div className="text-xs text-slate-400">样品费</div>
                      <div className="text-sm font-semibold text-amber-700">
                        {formatCurrency(customer.sampleRevenue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                本年度暂无样品记录
              </div>
            )}
          </div>
        </section>

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
        size === 'lg' ? 'md:col-span-2 xl:col-span-1' : ''
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <div className="space-y-1">
          <CardTitle className="text-xs font-bold opacity-80">
            {title}
          </CardTitle>
          <div className="flex flex-col">
            <div
              className={cn(
                'font-semibold tracking-tight',
                size === 'lg' ? 'text-2xl lg:text-3xl' : 'text-xl sm:text-2xl'
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
      <CardContent className="px-4 pt-0 pb-4 sm:px-5 sm:pb-5">
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
