'use client';

import { useQuery } from '@tanstack/react-query';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    Calendar,
    MinusIcon,
    Package,
    RefreshCw,
    TrendingDown,
    TrendingUp
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
import { queryKeys } from '@/lib/queryKeys';
import type { MonthlyReport } from '@/lib/types/report';
import { formatCurrency } from '@/lib/utils/format';

export function MonthlyReportClient() {
  const currentDate = new Date();
  const [year, setYear] = React.useState(currentDate.getFullYear());
  const [month, setMonth] = React.useState(currentDate.getMonth() + 1);

  // 获取月度报表数据
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
