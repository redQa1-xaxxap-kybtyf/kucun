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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>销售趋势</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[350px] items-center justify-center">
          <p className="text-muted-foreground text-sm">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  // 默认显示最近30天数据（如果没有数据则显示空状态）
  const _hasData = data?.monthly?.length > 0;

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>销售趋势</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <Tabs defaultValue="monthly" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="weekly">最近7天</TabsTrigger>
              <TabsTrigger value="monthly">最近30天</TabsTrigger>
              <TabsTrigger value="yearly">最近1年</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="weekly" className="space-y-4">
            <div className="h-[350px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <LineChart
                  data={data.weekly}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={value => `¥${value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      dashboardUtils.formatCurrency(value),
                      '销售额',
                    ]}
                    labelStyle={{ color: '#666' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <div className="h-[350px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <LineChart
                  data={data.monthly}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={value => `¥${value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      dashboardUtils.formatCurrency(value),
                      '销售额',
                    ]}
                    labelStyle={{ color: '#666' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="yearly" className="space-y-4">
            <div className="h-[350px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <LineChart
                  data={data.yearly}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={value => `¥${value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      dashboardUtils.formatCurrency(value),
                      '销售额',
                    ]}
                    labelStyle={{ color: '#666' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
