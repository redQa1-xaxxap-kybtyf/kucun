'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardUtils } from '@/lib/api/dashboard';
import type { SalesTrendData } from '@/lib/types/dashboard';

interface DashboardTrendChartProps {
  data: SalesTrendData;
  loading?: boolean;
}

export function DashboardTrendChart({
  data,
  loading = false,
}: DashboardTrendChartProps) {
  if (loading) {
    return (
      <div className="h-[280px] w-full animate-pulse rounded-md bg-card" />
    );
  }

  return (
    <div className="group relative flex flex-col rounded-md border border-border bg-card p-4 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
            <p className="text-xs font-semibold text-slate-500">
              Performance / 销售趋势
            </p>
          </div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">
            销售业绩分析
          </p>
        </div>

        <Tabs defaultValue="monthly" className="w-auto">
          <TabsList className="h-11 rounded-2xl border border-slate-200/50 bg-slate-100/50 p-1">
            <TabsTrigger
              value="weekly"
              className="rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              最近7天
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              className="rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              最近30天
            </TabsTrigger>
            <TabsTrigger
              value="yearly"
              className="rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              年度概览
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="weekly" className="m-0 outline-none">
              <div className="h-[320px] w-full">
                <ChartContainer
                  chartData={data.weekly}
                  color="hsl(var(--primary))"
                />
              </div>
            </TabsContent>
            <TabsContent value="monthly" className="m-0 outline-none">
              <div className="h-[320px] w-full">
                <ChartContainer chartData={data.monthly} color="#0f172a" />
              </div>
            </TabsContent>
            <TabsContent value="yearly" className="m-0 outline-none">
              <div className="h-[320px] w-full">
                <ChartContainer chartData={data.yearly} color="#6366f1" />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* 背景装饰轨迹 */}
      <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-slate-900 opacity-5 blur-3xl transition-all group-hover:opacity-10" />
    </div>
  );
}

function ChartContainer({
  chartData,
  color,
}: {
  chartData: any[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f1f5f9"
        />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tick={{ fontWeight: 800 }}
          dy={10}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={value => `$${value}`}
          tick={{ fontWeight: 800 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-2xl border border-slate-100 bg-card p-3 shadow-xl">
                  <p className="mb-1 text-xs font-semibold text-slate-500">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {dashboardUtils.formatCurrency(payload[0].value as number)}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={4}
          dot={false}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
