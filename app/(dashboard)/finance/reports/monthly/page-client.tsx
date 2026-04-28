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
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

export function MonthlyReportClient() {
  const currentDate = React.useMemo(() => new Date(), []);
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
        title: '报表已刷新',
        description: `${year} 年 ${month} 月的报表已经更新`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '刷新失败',
        description: getFriendlyErrorMessage(
          error,
          '月度报表暂时无法刷新，请稍后重试'
        ),
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
            当前月份还没有报表数据
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
        <Card className="border-border overflow-hidden rounded-md border shadow-sm">
          <CardContent className="bg-card p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between xl:items-center">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--color-primary))] sm:h-12 sm:w-12">
                  <Calendar className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    月度报表
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    查看月度收入、成本、费用和净利润
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="h-11 justify-center shadow-sm sm:min-w-[140px]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isGenerating ? '刷新中...' : '刷新报表'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="h-11 justify-center shadow-sm sm:min-w-[140px]"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出图片'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 筛选器 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              选择月份
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

              <select
                value={month.toString()}
                onChange={e => setMonth(parseInt(e.target.value, 10))}
                className="border-input bg-background ring-offset-background focus:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:w-40"
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
                className="w-full sm:w-auto"
              >
                当前月份
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 核心指标 - 顶部大卡片 */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
            title="本月破损片数"
            value={purchaseDamage.totalQuantity}
            icon={<Package className="h-4 w-4" />}
            variant="warning"
            isCurrency={false}
            subtitle="含到货破损和手工报损"
          />
          <StatCard
            title="本月破损金额"
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
            subtitle="待处理"
          />
        </div>

        <details className="group rounded-md border border-slate-200 bg-white px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            <span>破损明细</span>
            <span className="text-xs font-medium text-slate-400 group-open:hidden">
              展开查看
            </span>
            <span className="hidden text-xs font-medium text-slate-400 group-open:inline">
              收起
            </span>
          </summary>
          <div className="mt-3 space-y-3 border-t pt-3 text-xs leading-5 text-[hsl(var(--color-text-secondary))]">
            <p>
              本月到货破损{' '}
              {purchaseDamage.purchaseInbound.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.purchaseInbound.amount)}，手工报损{' '}
              {purchaseDamage.manualDamage.quantity.toLocaleString()} 片 /
              {formatCurrency(purchaseDamage.manualDamage.amount)}
              。到货破损里，报工厂{' '}
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
            <p>金额按采购成本折算。</p>
          </div>
        </details>

        {/* 收入与支出明细 */}
        <div className="rounded-md border border-slate-100 bg-slate-50/80 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              收支明细
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                毛利率: {(report.profit.grossProfitMargin || 0).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
              subtitle={sampleSourceSummary}
            />
            <StatCard
              title="样品数量"
              value={report.sample.sampleQuantity}
              icon={<Package className="h-4 w-4" />}
              variant="info"
              isCurrency={false}
              subtitle={`${report.sample.customerCount} 位客户领取`}
            />
            <StatCard
              title="样品成本"
              value={report.sample.sampleCost}
              icon={<ChineseYuan className="h-4 w-4" />}
              variant="neutral"
            />
            <div className="my-2 h-px bg-slate-200 sm:col-span-2 xl:col-span-3 2xl:col-span-5" />
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
          <details className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
            <summary className="cursor-pointer list-none font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
              费用统计口径
            </summary>
            <p className="mt-2 border-t pt-2">
              只统计已确认费用；关联采购的费用不重复计入当期费用。
            </p>
          </details>
        </div>

        {/* 资产回收与供应链 - 分组区 */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* 资金回收 */}
          <div className="rounded-md border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ChineseYuan className="h-4 w-4 text-blue-500" />
              资金回收
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-blue-100/50 bg-blue-50/50 p-4">
                <div className="text-[10px] font-bold text-blue-600">
                  累计应收 (回款率)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-semibold text-slate-900">
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
              <div className="rounded-md border border-slate-200/50 bg-slate-50 p-4">
                <div className="text-[10px] font-bold text-slate-500">
                  业务应付 (结算进度)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-semibold text-slate-900">
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
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold text-red-700">
                待收余额 (欠款):
              </span>
              <span className="text-lg font-semibold text-red-700">
                {formatCurrency(report.receivables.receivableBalance)}
              </span>
            </div>
          </div>

          {/* 供应链与直发分析 */}
          <div className="rounded-md border border-slate-100 bg-white p-4 text-sm shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
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
                  className="flex items-center justify-between rounded-md border border-dashed border-slate-200 p-3"
                >
                  <div className="flex items-center gap-2 font-bold text-slate-600">
                    {item.icon}
                    {item.label}
                  </div>
                  <div className={cn('text-lg font-semibold', item.color)}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 经营提醒 */}
        {report.alerts && report.alerts.length > 0 && (
          <div className="rounded-md border border-amber-100 bg-amber-50 p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Receipt className="h-4 w-4" />
              经营提醒
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {report.alerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-md border border-amber-200/50 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-semibold',
                        alert.type === 'danger'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {alert.type === 'danger' ? '高风险' : '建议关注'}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
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

// 统计卡片组件
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
        'group hover:border-opacity-50 relative overflow-hidden rounded-md border shadow-sm',
        themeStyles[variant],
        size === 'lg' ? 'md:col-span-2 xl:col-span-1' : ''
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <div className="space-y-1">
          <CardTitle className="text-xs font-bold opacity-80">
            {title}
          </CardTitle>
          <div
            className={cn(
              'font-semibold tracking-tight text-slate-900',
              size === 'lg' ? 'text-2xl lg:text-3xl' : 'text-xl sm:text-2xl'
            )}
          >
            {isCurrency ? formatCurrency(value) : value.toLocaleString()}
          </div>
        </div>
        <div className={cn('rounded-md p-2', iconStyles[variant])}>{icon}</div>
      </CardHeader>

      <CardContent className="px-4 pb-4 sm:px-5">
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
            <p className="mt-1 line-clamp-2 border-t border-slate-200/50 pt-2 text-[11px] leading-relaxed text-slate-500 sm:line-clamp-1">
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
