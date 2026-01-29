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
import { cn } from '@/lib/utils';
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

        {/* 核心趋势分析图表 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 月度趋势图 */}
          <Card className="overflow-hidden border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <CardTitle className="text-sm font-black tracking-wider text-slate-700 uppercase">
                第一部分：月度营业趋势
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={report.monthlyTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                    tickFormatter={val => `¥${val / 10000}w`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS.revenue}
                    name="收入"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={CHART_COLORS.profit}
                    name="利润"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 季度对比分析 */}
          <Card className="overflow-hidden border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <CardTitle className="text-sm font-black tracking-wider text-slate-700 uppercase">
                第二部分：季度经营对比
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={report.quarterlyData} barGap={8}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="quarterLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill={CHART_COLORS.revenue}
                    name="收入"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Bar
                    dataKey="profit"
                    fill={CHART_COLORS.profit}
                    name="利润"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 厂家发货与费用分布看板 */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* 厂家发货汇总 - 占据3栏 */}
          <div className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50/50 p-6 lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
                <Package className="h-4 w-4 text-blue-500" />
                厂家直发业务年度报告
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black tracking-wider text-blue-400 uppercase">
                  客户货利润
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  {formatCurrency(report.factoryShipmentProfit?.customerProfit)}
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black tracking-wider text-blue-400 uppercase">
                  平均利润率
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  {report.factoryShipmentProfit?.averageProfitMargin.toFixed(2)}
                  %
                </div>
              </div>
            </div>

            <div className="min-h-[240px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.factoryShipmentProfit?.monthlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#dbeafe"
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={month => `${month}月`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [
                      formatCurrency(value),
                      '利润',
                    ]}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="profit"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 费用分布 - 占据2栏 */}
          <Card className="border-slate-100 shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-50 px-6 py-4">
              <CardTitle className="text-xs font-black tracking-widest text-slate-500 uppercase">
                费用支出结构
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.expenseDistribution as any}
                      dataKey="amount"
                      nameKey="typeName"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
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
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 space-y-2">
                {report.expenseDistribution.map((item, index) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                      />
                      <span className="font-bold text-slate-600">
                        {item.typeName}
                      </span>
                    </div>
                    <span className="font-mono font-black text-slate-400">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 年度报表导出区域 (v3 PRO: 专用于图片导出，格式化为专业年度经营报告) */}
        <div className="pointer-events-none h-0 w-0 overflow-hidden opacity-0">
          <Card
            ref={exportRef}
            className="w-[1000px] border-none bg-white p-12 text-slate-900 shadow-none"
          >
            {/* 页眉 - 年度报告风格 */}
            <div className="mb-10 border-b-4 border-slate-900 pb-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900 text-xl font-black text-white italic">
                      反
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                      反重力{' '}
                      <span className="font-light text-slate-500">系统</span>
                    </h1>
                  </div>
                  <div className="text-xs font-bold tracking-[0.3em] text-slate-500">
                    集团财务报告中心
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    状态：内部机密 / 终稿
                  </div>
                  <div className="text-4xl font-black tracking-tighter text-slate-900 italic">
                    {year}
                  </div>
                </div>
              </div>
              <div className="mt-8 flex items-baseline justify-between">
                <h2 className="text-2xl font-black tracking-tight uppercase">
                  年度经营业绩分析
                </h2>
                <div className="text-xs leading-none font-bold tracking-widest text-slate-500 uppercase">
                  年度财务汇总报表
                </div>
              </div>
            </div>

            {/* A. 年度核心经营数据汇总 */}
            <div className="mb-10">
              <div className="grid grid-cols-4 gap-px border border-slate-200 bg-slate-200">
                {[
                  {
                    label: '年度销售总收入',
                    value: report.summary.totalRevenue,
                    sub: `成交单量: ${report.summary.orderCount}`,
                  },
                  {
                    label: '年度经营总利润',
                    value: report.summary.totalProfit,
                    sub: `利润率: ${report.summary.profitMargin.toFixed(2)}%`,
                    highlight: true,
                  },
                  {
                    label: '营业总成本',
                    value: report.summary.totalCost,
                    sub: `成本率: ${report.summary.totalRevenue > 0 ? ((report.summary.totalCost / report.summary.totalRevenue) * 100).toFixed(1) : '0.0'}%`,
                  },
                  {
                    label: '年度库存周转率',
                    value: report.inventoryTurnover?.turnoverRate || 0,
                    sub: `周转天数: ${report.inventoryTurnover?.turnoverDays.toFixed(0)} 天`,
                    isCurrency: false,
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className={cn(
                      'bg-white p-6',
                      item.highlight && 'bg-slate-50'
                    )}
                  >
                    <div className="mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      {item.label}
                    </div>
                    <div className="mb-2 border-b-2 border-slate-100 pb-2 font-mono text-2xl font-black text-slate-900">
                      {item.isCurrency !== false
                        ? formatCurrency(item.value)
                        : item.value.toFixed(2)}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 italic">
                      {item.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* B. 细分分析看板 */}
            <div className="mb-10 grid grid-cols-2 gap-12">
              <div>
                <div className="mb-4 flex items-center gap-2 border-l-4 border-slate-900 pl-3">
                  <h3 className="text-xs font-black tracking-widest text-slate-900 uppercase italic">
                    子报表：费用支出结构
                  </h3>
                </div>
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-3 py-2.5 font-black">费用类别</th>
                      <th className="px-3 py-2.5 text-right font-black">
                        金额 (元)
                      </th>
                      <th className="px-3 py-2.5 text-right font-black">
                        占比
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100 italic">
                    {report.expenseDistribution.map(row => (
                      <tr key={row.type}>
                        <td className="px-3 py-3 font-bold text-slate-600">
                          {row.typeName}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-400">
                          {row.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-8">
                <div>
                  <div className="mb-4 flex items-center gap-2 border-l-4 border-slate-900 pl-3">
                    <h3 className="text-xs font-black tracking-widest text-slate-900 uppercase italic">
                      子报表：厂家直发业务
                    </h3>
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-slate-200 bg-blue-50/20 p-5">
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <div className="mb-1 text-[10px] font-black text-blue-500 uppercase">
                          年度直发净利润
                        </div>
                        <div className="font-mono text-3xl font-black text-slate-900">
                          {formatCurrency(
                            report.factoryShipmentProfit?.customerProfit
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase">
                          利润率
                        </div>
                        <div className="text-base font-black text-slate-600">
                          {report.factoryShipmentProfit?.averageProfitMargin.toFixed(
                            2
                          )}
                          %
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3 text-[9px] leading-relaxed font-bold text-slate-400 uppercase">
                      厂家直发业务在年度整体增长中占据重要战略地位，保持高效运营。
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 text-[10px] font-black text-slate-400 uppercase">
                    审计摘要说明
                  </div>
                  <div className="text-[11px] leading-relaxed font-bold text-slate-700 italic">
                    &quot;本年度报表确认了稳定的增长轨迹。资产周转率保持在最优范围内，多元化的费用管理成功降低了经营风险。&quot;
                  </div>
                </div>
              </div>
            </div>
            {/* 页脚 - 报表鉴真 */}
            <div className="mt-16 flex items-end justify-between border-t border-slate-200 pt-6">
              <div className="space-y-1">
                <div className="font-mono text-[10px] font-black tracking-widest text-slate-900 uppercase">
                  已验证财务数据资产
                </div>
                <div className="text-[9px] leading-none font-bold tracking-widest text-slate-400 uppercase">
                  数字签名：反重力-安全-{year}-财报-
                  {new Date().getTime().toString()}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] font-black tracking-widest text-slate-900 uppercase">
                  © 2026 反重力系统
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase italic">
                  第 01 页 / 年度经营分析
                </div>
              </div>
            </div>
          </Card>
        </div>
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
