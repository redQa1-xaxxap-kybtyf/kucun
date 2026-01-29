'use client';

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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function ProfitLossTrendChart({
  trend,
}: {
  trend: ProfitLossAnalysis['trend'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>盈亏趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend}>
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
  );
}

