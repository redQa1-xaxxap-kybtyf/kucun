'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon, Calendar, Package } from 'lucide-react';
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
import { queryKeys } from '@/lib/queryKeys';
import type { AnnualReport } from '@/lib/types/report';
import { formatCurrency } from '@/lib/utils/format';

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
];

export function AnnualReportClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);

  // 获取年度报表数据
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
                  stroke="#0088FE"
                  name="收入"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#FF8042"
                  name="支出"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#00C49F"
                  name="利润"
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
                <Bar dataKey="revenue" fill="#0088FE" name="收入" />
                <Bar dataKey="expenses" fill="#FF8042" name="支出" />
                <Bar dataKey="profit" fill="#00C49F" name="利润" />
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
                      stroke="#00C49F"
                      name="利润"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="profitMargin"
                      stroke="#FF8042"
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
                        fill={COLORS[index % COLORS.length]}
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
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
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
              <ArrowUpIcon className="h-3 w-3 text-green-600" />
            )}
            {comparison.trend === 'down' && (
              <ArrowDownIcon className="h-3 w-3 text-red-600" />
            )}
            <span
              className={
                comparison.trend === 'up'
                  ? 'text-green-600'
                  : comparison.trend === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
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
