'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Calendar,
  MinusIcon,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import * as React from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { ExportService } from '@/lib/services/export-service';
import type { MonthlyReport } from '@/lib/types/report';
import { formatCurrency } from '@/lib/utils/format';

export function MonthlyReportClient() {
  const currentDate = new Date();
  const [year, setYear] = React.useState(currentDate.getFullYear());
  const [month, setMonth] = React.useState(currentDate.getMonth() + 1);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const exportRef = React.useRef<HTMLDivElement | null>(null);

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

  // 导出报表为图片（只导出报表预览区域，而不是整个页面）
  const handleExportImage = React.useCallback(async () => {
    if (!report) {
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: '当前没有可导出的报表数据',
      });
      return;
    }

    if (!exportRef.current) {
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: '找不到报表预览区域，请刷新页面后重试',
      });
      return;
    }

    try {
      setIsExporting(true);

      const filename = `月度报表-${year}-${String(month).padStart(2, '0')}`;

      await ExportService.exportToImage(exportRef.current, {
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
      <div className="flex h-full flex-col overflow-auto p-6">
        <MonthlyReportSkeleton />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            暂无数据
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    月度报表
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    查看月度收入、支出、利润等财务数据统计
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
              <Select
                value={year.toString()}
                onValueChange={value => setYear(parseInt(value, 10))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={month.toString()}
                onValueChange={value => setMonth(parseInt(value, 10))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

        {/* 收入统计 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">收入统计</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="销售收入"
              value={report.revenue.salesRevenue}
              icon={<ChineseYuan className="h-4 w-4" />}
              comparison={report.comparison?.revenue}
            />
            <StatCard
              title="订单数量"
              value={report.revenue.orderCount}
              icon={<TrendingUp className="h-4 w-4" />}
              isCurrency={false}
            />
            <StatCard
              title="平均订单金额"
              value={report.revenue.averageOrderValue}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* 支出统计 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">支出统计</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="总费用"
              value={report.expenses.totalExpenses}
              icon={<TrendingDown className="h-4 w-4" />}
              comparison={report.comparison?.expenses}
            />
            <StatCard
              title="运费"
              value={report.expenses.byType.shipping}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="仓储费"
              value={report.expenses.byType.storage}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="人工费"
              value={report.expenses.byType.labor}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="差旅费"
              value={report.expenses.byType.travel}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="生活费"
              value={report.expenses.byType.living}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="装卸费"
              value={report.expenses.byType.loading_unloading}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* 利润统计 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">利润统计</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="毛利润"
              value={report.profit.grossProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`毛利率: ${report.profit.grossProfitMargin.toFixed(2)}%`}
            />
            <StatCard
              title="营业利润"
              value={report.profit.operatingProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="净利润"
              value={report.profit.netProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`利润率: ${report.profit.profitMargin.toFixed(2)}%`}
              comparison={report.comparison?.profit}
            />
          </div>
        </div>

        {/* 库存周转率 */}
        {report.inventoryTurnover && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">库存周转率</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                title="周转率"
                value={report.inventoryTurnover.turnoverRate}
                icon={<RefreshCw className="h-4 w-4" />}
                isCurrency={false}
                subtitle={`${report.inventoryTurnover.turnoverRate.toFixed(2)} 次/月`}
              />
              <StatCard
                title="周转天数"
                value={report.inventoryTurnover.turnoverDays}
                icon={<Calendar className="h-4 w-4" />}
                isCurrency={false}
                subtitle={`${report.inventoryTurnover.turnoverDays.toFixed(0)} 天`}
              />
              <StatCard
                title="平均库存价值"
                value={report.inventoryTurnover.averageInventoryValue}
                icon={<Package className="h-4 w-4" />}
              />
            </div>
          </div>
        )}

        {/* 应收应付 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">应收应付</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="应收款总额"
              value={report.receivables.totalReceivable}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="实收金额"
              value={report.receivables.receivedAmount}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="应付款总额"
              value={report.receivables.totalPayable}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <StatCard
              title="实付金额"
              value={report.receivables.paidAmount}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* 厂家发货利润 */}
        {report.factoryShipmentProfit && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">厂家发货利润</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <StatCard
                title="订单总数"
                value={report.factoryShipmentProfit.totalOrders}
                icon={<Package className="h-4 w-4" />}
                isCurrency={false}
              />
              <StatCard
                title="订单总金额"
                value={report.factoryShipmentProfit.totalAmount}
                icon={<ChineseYuan className="h-4 w-4" />}
              />
              <StatCard
                title="总收入"
                value={report.factoryShipmentProfit.totalRevenue}
                icon={<ChineseYuan className="h-4 w-4" />}
                subtitle="应收金额"
              />
              <StatCard
                title="客户货利润"
                value={report.factoryShipmentProfit.customerProfit}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                title="自有货成本"
                value={report.factoryShipmentProfit.selfCostAmount}
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <StatCard
                title="总费用"
                value={report.factoryShipmentProfit.totalExpenses}
                icon={<ChineseYuan className="h-4 w-4" />}
              />
              <StatCard
                title="平均利润率"
                value={report.factoryShipmentProfit.averageProfitMargin}
                icon={<TrendingUp className="h-4 w-4" />}
                isCurrency={false}
                subtitle={`${report.factoryShipmentProfit.averageProfitMargin.toFixed(2)}%`}
              />
            </div>
          </div>
        )}

        {/* 预警信息 */}
        {report.alerts && report.alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>预警信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 ${
                      alert.type === 'danger'
                        ? 'border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))]'
                        : alert.type === 'warning'
                          ? 'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))]'
                          : 'border-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))]'
                    }`}
                  >
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-muted-foreground text-sm">
                      {alert.message}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 报表导出区域（专用于图片导出，格式化为单页报表） */}
        <Card
          ref={exportRef}
          className="border border-[hsl(var(--color-border-primary))] bg-white shadow-[var(--shadow-light)]"
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              <span>
                {year} 年 {month} 月度财务报表
              </span>
              <span className="text-xs font-normal text-[hsl(var(--color-text-secondary))]">
                统计区间：{report.period.startDate} ~ {report.period.endDate}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-[13px] text-[hsl(var(--color-text-primary))]">
              {/* 核心汇总 */}
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    销售收入
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.revenue.salesRevenue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    总成本
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.costs.totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    总费用
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.expenses.totalExpenses)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    净利润 / 利润率
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.profit.netProfit)} （
                    {report.profit.profitMargin.toFixed(2)}%）
                  </div>
                </div>
              </div>

              {/* 收入与订单 */}
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    订单数量
                  </div>
                  <div className="text-base">
                    {report.revenue.orderCount.toLocaleString()} 单
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    平均订单金额
                  </div>
                  <div className="text-base">
                    {formatCurrency(report.revenue.averageOrderValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    完成 / 待处理订单
                  </div>
                  <div className="text-base">
                    {report.revenue.completedOrders} /{' '}
                    {report.revenue.pendingOrders}
                  </div>
                </div>
              </div>

              {/* 应收应付简表 */}
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  应收 / 应付概览
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      应收总额
                    </div>
                    <div className="text-base">
                      {formatCurrency(report.receivables.totalReceivable)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      应付总额
                    </div>
                    <div className="text-base">
                      {formatCurrency(report.receivables.totalPayable)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      应收余额 / 应付余额
                    </div>
                    <div className="text-base">
                      {formatCurrency(report.receivables.receivableBalance)} /{' '}
                      {formatCurrency(report.receivables.payableBalance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 厂家直发与库存（简要） */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                    厂家直发汇总
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>直发订单数</span>
                      <span>
                        {report.factoryShipmentProfit.totalOrders.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>直发收入</span>
                      <span>
                        {formatCurrency(
                          report.factoryShipmentProfit.totalRevenue
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>平均利润率</span>
                      <span>
                        {report.factoryShipmentProfit.averageProfitMargin.toFixed(
                          2
                        )}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {report.inventoryTurnover && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      库存周转概览
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>周转率</span>
                        <span>
                          {report.inventoryTurnover.turnoverRate.toFixed(2)} 次
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>周转天数</span>
                        <span>
                          {report.inventoryTurnover.turnoverDays.toFixed(0)} 天
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 简要预警列表 */}
              {report.alerts && report.alerts.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                    预警摘要
                  </div>
                  <ul className="space-y-1 text-xs">
                    {report.alerts.slice(0, 4).map((alert, index) => (
                      <li key={index} className="leading-snug">
                        {index + 1}. {alert.title}：{alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
  comparison,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isCurrency ? formatCurrency(value) : value.toLocaleString()}
        </div>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
        )}
        {comparison && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {comparison.trend === 'up' && (
              <ArrowUpIcon className="h-3 w-3 text-[hsl(var(--color-success))]" />
            )}
            {comparison.trend === 'down' && (
              <ArrowDownIcon className="h-3 w-3 text-[hsl(var(--color-error))]" />
            )}
            {comparison.trend === 'stable' && (
              <MinusIcon className="h-3 w-3 text-[hsl(var(--color-text-secondary))]" />
            )}
            <span
              className={
                comparison.trend === 'up'
                  ? 'text-[hsl(var(--color-success))]'
                  : comparison.trend === 'down'
                    ? 'text-[hsl(var(--color-error))]'
                    : 'text-[hsl(var(--color-text-secondary))]'
              }
            >
              {comparison.changeRate > 0 ? '+' : ''}
              {comparison.changeRate.toFixed(2)}%
            </span>
            <span className="text-muted-foreground">环比</span>
          </div>
        )}
      </CardContent>
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
