'use client';

import { Package } from 'lucide-react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function AnnualReportCharts({ report }: { report: AnnualReport }) {
  return (
    <>
      {/* 核心趋势分析图表 */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* 月度趋势图 */}
        <Card className="overflow-hidden border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6">
            <CardTitle className="text-sm font-semibold text-slate-700">
              第一部分：月度营业趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
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
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6">
            <CardTitle className="text-sm font-semibold text-slate-700">
              第二部分：季度经营对比
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
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
      <div className="grid gap-6 xl:grid-cols-5">
        {/* 厂家发货汇总 - 占据3栏 */}
        <div className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-6 xl:col-span-3">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Package className="h-4 w-4 text-blue-500" />
              厂家直发业务年度报告
            </h2>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-semibold text-blue-400">
                客户货利润
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(report.factoryShipmentProfit?.customerProfit)}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-semibold text-blue-400">
                平均利润率
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {report.factoryShipmentProfit?.averageProfitMargin.toFixed(2)}%
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
                  formatter={(value: number) => [formatCurrency(value), '利润']}
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
        <Card className="border-slate-100 shadow-sm xl:col-span-2">
          <CardHeader className="border-b border-slate-50 px-4 py-4 sm:px-6">
            <CardTitle className="text-xs font-semibold text-slate-500">
              费用支出结构
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
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
                        backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                      }}
                    />
                    <span className="font-bold text-slate-600">
                      {item.typeName}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-slate-400">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
