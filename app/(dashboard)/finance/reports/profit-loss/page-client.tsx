'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  Package,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import * as React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import type { ProfitLossAnalysis } from '@/lib/types/report';
import { formatCurrency } from '@/lib/utils/format';

// ✅ 使用CSS变量统一图表颜色
// 遵循项目颜色规范，使用语义化的颜色变量
const CHART_COLORS = {
  revenue: 'hsl(var(--color-info))', // 收入 - 蓝色
  cost: 'hsl(var(--color-error))', // 成本 - 红色
  expense: 'hsl(var(--color-warning))', // 费用 - 橙色
  profit: 'hsl(var(--color-success))', // 利润 - 绿色
};

export function ProfitLossClient() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [startDate, setStartDate] = React.useState(
    firstDayOfMonth.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = React.useState(now.toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = React.useState<'day' | 'week' | 'month'>('day');

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
      <div className="flex h-full flex-col overflow-auto p-6">
        <ProfitLossSkeleton />
      </div>
    );
  }

  if (!analysis) {
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
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    盈亏分析
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    实时分析盈亏状态,查看收入、成本、费用明细及趋势
                  </p>
                </div>
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
                  <Select
                    value={groupBy}
                    onValueChange={value =>
                      setGroupBy(value as 'day' | 'week' | 'month')
                    }
                  >
                    <SelectTrigger id="groupBy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">按天</SelectItem>
                      <SelectItem value="week">按周</SelectItem>
                      <SelectItem value="month">按月</SelectItem>
                    </SelectContent>
                  </Select>
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

        {/* 盈亏状态 */}
        <Card>
          <CardHeader>
            <CardTitle>盈亏状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`rounded-lg p-6 text-center ${
                analysis.status === 'profit'
                  ? 'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]'
                  : analysis.status === 'loss'
                    ? 'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]'
                    : 'bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]'
              }`}
            >
              <div className="text-4xl font-bold">
                {analysis.status === 'profit'
                  ? '盈利'
                  : analysis.status === 'loss'
                    ? '亏损'
                    : '盈亏平衡'}
              </div>
              <div className="mt-2 text-2xl">
                {formatCurrency(Math.abs(analysis.profit.netProfit))}
              </div>
              <div className="mt-1 text-sm">
                净利率: {analysis.profit.netProfitMargin.toFixed(2)}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 收入明细 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">收入明细</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <DetailCard
              title="销售收入"
              value={analysis.revenue.salesRevenue}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="直发收入"
              value={analysis.revenue.factoryShipmentRevenue}
              icon={<Package className="h-4 w-4" />}
            />
            <DetailCard
              title="其他收入"
              value={analysis.revenue.otherRevenue}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="总收入"
              value={analysis.revenue.totalRevenue}
              icon={<TrendingUp className="h-4 w-4" />}
              subtitle={`订单数: ${analysis.revenue.orderCount}`}
            />
          </div>
        </div>

        {/* 成本明细 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">成本明细</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <DetailCard
              title="销售成本"
              value={analysis.costs.salesCost}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="库存成本变化"
              value={analysis.costs.inventoryCost}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="总成本"
              value={analysis.costs.totalCost}
              icon={<TrendingDown className="h-4 w-4" />}
              subtitle={`成本率: ${analysis.costs.costRate.toFixed(2)}%`}
            />
          </div>
        </div>

        {/* 费用明细 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">费用明细</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <DetailCard
              title="运费"
              value={analysis.expenses.shipping}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="仓储费"
              value={analysis.expenses.storage}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="人工费"
              value={analysis.expenses.labor}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="差旅费"
              value={analysis.expenses.travel}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="生活费"
              value={analysis.expenses.living}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="装卸费"
              value={analysis.expenses.loading_unloading}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="其他费用"
              value={analysis.expenses.other}
              icon={<ChineseYuan className="h-4 w-4" />}
            />
            <DetailCard
              title="总费用"
              value={analysis.expenses.totalExpenses}
              icon={<TrendingDown className="h-4 w-4" />}
              subtitle={`费用率: ${analysis.expenses.expenseRate.toFixed(2)}%`}
            />
          </div>
        </div>

        {/* 利润计算 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">利润计算</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <DetailCard
              title="毛利润"
              value={analysis.profit.grossProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`毛利率: ${analysis.profit.grossProfitMargin.toFixed(2)}%`}
            />
            <DetailCard
              title="营业利润"
              value={analysis.profit.operatingProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`营业利润率: ${analysis.profit.operatingProfitMargin.toFixed(2)}%`}
            />
            <DetailCard
              title="净利润"
              value={analysis.profit.netProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`净利率: ${analysis.profit.netProfitMargin.toFixed(2)}%`}
            />
            <DetailCard
              title="直发净利润"
              value={analysis.factoryShipmentProfit.customerProfit}
              icon={<ChineseYuan className="h-4 w-4" />}
              subtitle={`占总净利润: ${analysis.factoryShipmentProfit.percentageOfTotal.toFixed(2)}%`}
            />
          </div>
        </div>

        {/* 厂家发货利润明细 */}
        {analysis.factoryShipmentProfit && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">厂家发货利润明细</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <DetailCard
                title="客户货利润"
                value={analysis.factoryShipmentProfit.customerProfit}
                icon={<Package className="h-4 w-4" />}
              />
              <DetailCard
                title="自有货成本"
                value={analysis.factoryShipmentProfit.selfCostAmount}
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <DetailCard
                title="总费用"
                value={analysis.factoryShipmentProfit.totalExpenses}
                icon={<ChineseYuan className="h-4 w-4" />}
              />
              <DetailCard
                title="利润率"
                value={analysis.factoryShipmentProfit.profitMargin}
                icon={<TrendingUp className="h-4 w-4" />}
                isCurrency={false}
                subtitle={`${analysis.factoryShipmentProfit.profitMargin.toFixed(2)}%`}
              />
              <DetailCard
                title="占总利润比例"
                value={analysis.factoryShipmentProfit.percentageOfTotal}
                icon={<TrendingUp className="h-4 w-4" />}
                isCurrency={false}
                subtitle={`${analysis.factoryShipmentProfit.percentageOfTotal.toFixed(2)}%`}
              />
            </div>
          </div>
        )}

        {/* 趋势图表 */}
        <Card>
          <CardHeader>
            <CardTitle>盈亏趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysis.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" />
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
                  dataKey="cost"
                  stroke={CHART_COLORS.cost}
                  name="成本"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke={CHART_COLORS.expense}
                  name="费用"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={CHART_COLORS.profit}
                  name="利润"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 预警信息 */}
        {analysis.alerts && analysis.alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                预警信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.alerts.map((alert, index) => (
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
      </div>
    </div>
  );
}

// 明细卡片组件
interface DetailCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  isCurrency?: boolean;
}

function DetailCard({
  title,
  value,
  icon,
  subtitle,
  isCurrency = true,
}: DetailCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isCurrency ? formatCurrency(value) : value.toFixed(2)}
        </div>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
        )}
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
