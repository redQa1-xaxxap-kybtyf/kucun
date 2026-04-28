'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardUtils } from '@/lib/api/dashboard';
import type { SalesTrendData } from '@/lib/types/dashboard';

interface DashboardTrendChartProps {
  data: SalesTrendData;
  loading?: boolean;
}

type TrendRange = 'weekly' | 'monthly' | 'yearly';

export function DashboardTrendChart({
  data,
  loading = false,
}: DashboardTrendChartProps) {
  const [activeRange, setActiveRange] = useState<TrendRange>('monthly');

  if (loading) {
    return (
      <div className="h-[280px] w-full animate-pulse rounded-md bg-card" />
    );
  }

  const activeChart = {
    weekly: { data: data.weekly, color: 'hsl(var(--primary))' },
    monthly: { data: data.monthly, color: '#0f172a' },
    yearly: { data: data.yearly, color: '#6366f1' },
  }[activeRange];

  return (
    <div className="relative flex flex-col rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
            <p className="text-xs font-semibold text-slate-500">
              销售趋势
            </p>
          </div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">
            销售业绩分析
          </p>
        </div>

        <Tabs
          value={activeRange}
          onValueChange={value => setActiveRange(value as TrendRange)}
          className="w-auto"
        >
          <TabsList className="h-10 rounded-md border bg-slate-100 p-1">
            <TabsTrigger
              value="weekly"
              className="rounded px-4 text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              最近7天
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              className="rounded px-4 text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              最近30天
            </TabsTrigger>
            <TabsTrigger
              value="yearly"
              className="rounded px-4 text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              年度概览
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="h-[320px] w-full min-w-0">
        <ChartContainer
          chartData={activeChart.data}
          color={activeChart.color}
        />
      </div>
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width);
      setWidth(current => (current === nextWidth ? current : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="h-full w-full min-w-0">
      {width > 0 ? (
        <LineChart
          width={width}
          height={320}
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
            tickFormatter={value =>
              `¥${Number(value).toLocaleString('zh-CN')}`
            }
            tick={{ fontWeight: 800 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-md border border-slate-100 bg-card p-3 shadow-md">
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      {label}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {dashboardUtils.formatCurrency(
                        payload[0].value as number
                      )}
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
      ) : null}
    </div>
  );
}
