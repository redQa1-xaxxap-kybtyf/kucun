'use client';

import { AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryAlertStatsProps {
  alertStats: Record<string, number>;
  totalAlerts: number;
}

const ALERT_ICONS = {
  low_stock: AlertTriangle,
  out_of_stock: AlertCircle,
  overstock: TrendingUp,
} as const;

const ALERT_COLORS = {
  low_stock: 'text-yellow-600',
  out_of_stock: 'text-red-600',
  overstock: 'text-blue-600',
} as const;

const ALERT_LABELS = {
  low_stock: '库存不足',
  out_of_stock: '缺货',
  overstock: '库存过多',
} as const;

export function InventoryAlertStats({
  alertStats,
  totalAlerts,
}: InventoryAlertStatsProps) {
  if (totalAlerts === 0) {
    return null;
  }

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      {Object.entries(alertStats).map(([type, count]) => {
        const Icon =
          ALERT_ICONS[type as keyof typeof ALERT_ICONS] || AlertCircle;
        const colorClass =
          ALERT_COLORS[type as keyof typeof ALERT_COLORS] || 'text-gray-600';
        const label =
          ALERT_LABELS[type as keyof typeof ALERT_LABELS] || '未知类型';

        return (
          <Card key={type} className="border-l-4 border-l-current">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{count}</span>
                <Badge variant="secondary" className="text-xs">
                  {((count / totalAlerts) * 100).toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
