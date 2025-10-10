'use client';

import { TrendingUp } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryStatsCardProps {
  breakdown: {
    totalBatches: number;
    totalLocations: number;
  };
  lastUpdated?: string;
}

export function InventoryStatsCard({
  breakdown,
  lastUpdated,
}: InventoryStatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          统计信息
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] p-3 text-center shadow-[var(--shadow-light)]">
            <div className="text-lg font-bold text-[hsl(var(--color-primary))]">
              {breakdown.totalBatches}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              总批次数
            </div>
          </div>
          <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] p-3 text-center shadow-[var(--shadow-light)]">
            <div className="text-lg font-bold text-[hsl(var(--color-primary))]">
              {breakdown.totalLocations}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              存储位置
            </div>
          </div>
        </div>

        {lastUpdated && (
          <div className="mt-4 border-t border-[hsl(var(--color-divider))] pt-4">
            <div className="text-center text-sm text-[hsl(var(--color-text-tertiary))]">
              最后更新: {new Date(lastUpdated).toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
