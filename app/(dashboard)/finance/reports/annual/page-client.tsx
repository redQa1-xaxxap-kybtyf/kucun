'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Calendar,
  Package,
  Receipt,
} from 'lucide-react';
import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
import type { AnnualReport } from '@/lib/types/report';
import { formatCurrency } from '@/lib/utils/format';

// ✅ 使用CSS变量统一图表颜色
// 遵循项目颜色规范，使用语义化的颜色变量
const CHART_COLORS = {
  revenue: 'hsl(var(--color-info))', // 收入 - 蓝色
  expenses: 'hsl(var(--color-error))', // 支出 - 红色
  profit: 'hsl(var(--color-success))', // 利润 - 绿色
  cost: 'hsl(var(--color-warning))', // 成本 - 橙色
  primary: 'hsl(var(--color-primary))', // 主要 - 主题色
  secondary: 'hsl(var(--color-purple))', // 次要 - 紫色
};

// 饼图颜色数组（用于费用分布等多类别数据）
const PIE_COLORS = [
  'hsl(var(--color-info))',
  'hsl(var(--color-success))',
  'hsl(var(--color-warning))',
  'hsl(var(--color-error))',
  'hsl(var(--color-purple))',
  'hsl(var(--color-primary))',
];

export function AnnualReportClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const exportRef = React.useRef<HTMLDivElement | null>(null);

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

  // 导出报表图片（仅导出报表主体区域）
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
        description: '找不到报表区域，请刷新页面后重试',
      });
      return;
    }

    try {
      setIsExporting(true);

      const filename = `年度报表-${year}`;

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
      <div className="flex h-full flex-col overflow-auto p-6">
        <AnnualReportSkeleton />
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
                    年度报表
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    查看年度收入、支出、利润趋势及费用分布
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

              <Button variant="outline" onClick={() => setYear(currentYear)}>
                当前年份
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 年度汇总 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">年度汇总</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              title="总收入"
              value={report.summary.totalRevenue}
              comparison={report.yearOverYear?.revenue}
            />
            <SummaryCard
              title="总支出"
              value={report.summary.totalExpenses}
              comparison={report.yearOverYear?.expenses}
            />
            <SummaryCard
              title="总利润"
              value={report.summary.totalProfit}
              comparison={report.yearOverYear?.profit}
            />
            <SummaryCard
              title="利润率"
              value={report.summary.profitMargin}
              isCurrency={false}
              suffix="%"
            />
          </div>
        </div>

        {/* 库存周转率 */}
        {report.inventoryTurnover && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">库存周转率</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                title="周转率（年度）"
                value={report.inventoryTurnover.turnoverRate}
                isCurrency={false}
                suffix=" 次/年"
              />
              <SummaryCard
                title="周转天数"
                value={report.inventoryTurnover.turnoverDays}
                isCurrency={false}
                suffix=" 天"
              />
              <SummaryCard
                title="平均库存价值"
                value={report.inventoryTurnover.averageInventoryValue}
              />
            </div>
          </div>
        )}

        {/* 月度趋势图 */}
        <Card>
          <CardHeader>
            <CardTitle>月度趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={report.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.revenue}
                  name="收入"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={CHART_COLORS.expenses}
                  name="支出"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={CHART_COLORS.profit}
                  name="利润"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 季度对比 */}
        <Card>
          <CardHeader>
            <CardTitle>季度对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.quarterlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarterLabel" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar
                  dataKey="revenue"
                  fill={CHART_COLORS.revenue}
                  name="收入"
                />
                <Bar
                  dataKey="expenses"
                  fill={CHART_COLORS.expenses}
                  name="支出"
                />
                <Bar dataKey="profit" fill={CHART_COLORS.profit} name="利润" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 厂家发货利润 */}
        {report.factoryShipmentProfit && (
          <>
            {/* 厂家发货利润汇总 */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">厂家发货利润</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard
                  title="订单总数"
                  value={report.factoryShipmentProfit.totalOrders}
                  isCurrency={false}
                />
                <SummaryCard
                  title="客户货利润"
                  value={report.factoryShipmentProfit.customerProfit}
                />
                <SummaryCard
                  title="自有货成本"
                  value={report.factoryShipmentProfit.selfCostAmount}
                />
                <SummaryCard
                  title="平均利润率"
                  value={report.factoryShipmentProfit.averageProfitMargin}
                  isCurrency={false}
                  suffix="%"
                />
              </div>
            </div>

            {/* 厂家发货月度利润趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  厂家发货月度利润趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report.factoryShipmentProfit.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={month => `${month}月`}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === '利润率') {
                          return `${value.toFixed(2)}%`;
                        }
                        return formatCurrency(value);
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="profit"
                      stroke={CHART_COLORS.profit}
                      name="利润"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="profitMargin"
                      stroke={CHART_COLORS.expenses}
                      name="利润率"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* 费用分布 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>费用分布（饼图）</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data={report.expenseDistribution as any}
                    dataKey="amount"
                    nameKey="typeName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {report.expenseDistribution.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>费用明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.expenseDistribution.map((item, index) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded"
                      style={{
                        backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.typeName}</span>
                        <span className="text-muted-foreground text-sm">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {formatCurrency(item.amount)} ({item.count}条记录)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 报表导出区域（专用于图片导出，格式化为单页年度报表） */}
        <Card
          ref={exportRef}
          className="border border-[hsl(var(--color-border-primary))] bg-white shadow-[var(--shadow-light)]"
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              <span>{year} 年度财务报表</span>
              <span className="text-xs font-normal text-[hsl(var(--color-text-secondary))]">
                统计区间：{report.period.startDate} ~ {report.period.endDate}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-[13px] text-[hsl(var(--color-text-primary))]">
              {/* 年度核心汇总 */}
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    年度总收入
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.summary.totalRevenue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    年度总成本
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.summary.totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    年度总费用
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.summary.totalExpenses)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    净利润 / 利润率
                  </div>
                  <div className="text-base font-semibold">
                    {formatCurrency(report.summary.totalProfit)} （
                    {report.summary.profitMargin.toFixed(2)}%）
                  </div>
                </div>
              </div>

              {/* 订单与收入概览 */}
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    订单总数
                  </div>
                  <div className="text-base">
                    {report.summary.orderCount.toLocaleString()} 单
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    月均收入
                  </div>
                  <div className="text-base">
                    {formatCurrency(report.summary.averageMonthlyRevenue)}
                  </div>
                </div>
                {report.inventoryTurnover && (
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      库存周转率 / 周转天数
                    </div>
                    <div className="text-base">
                      {report.inventoryTurnover.turnoverRate.toFixed(2)} 次 /{' '}
                      {report.inventoryTurnover.turnoverDays.toFixed(0)} 天
                    </div>
                  </div>
                )}
              </div>

              {/* 厂家发货汇总（如有） */}
              {report.factoryShipmentProfit && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                    厂家发货概览
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        直发订单数
                      </div>
                      <div className="text-base">
                        {report.factoryShipmentProfit.totalOrders.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        客户货利润
                      </div>
                      <div className="text-base">
                        {formatCurrency(
                          report.factoryShipmentProfit.customerProfit
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        平均利润率
                      </div>
                      <div className="text-base">
                        {report.factoryShipmentProfit.averageProfitMargin.toFixed(
                          2
                        )}
                        %
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

// 汇总卡片组件
interface SummaryCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  suffix?: string;
  comparison?: {
    current: number;
    previous: number;
    change: number;
    changeRate: number;
    trend: 'up' | 'down' | 'stable';
  };
}

function SummaryCard({
  title,
  value,
  isCurrency = true,
  suffix = '',
  comparison,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <ChineseYuan className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isCurrency ? formatCurrency(value) : value.toFixed(2)}
          {suffix}
        </div>
        {comparison && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {comparison.trend === 'up' && (
              <ArrowUpIcon className="h-3 w-3 text-[hsl(var(--color-success))]" />
            )}
            {comparison.trend === 'down' && (
              <ArrowDownIcon className="h-3 w-3 text-[hsl(var(--color-error))]" />
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
            <span className="text-muted-foreground">同比</span>
          </div>
        )}
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
