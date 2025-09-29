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
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">{breakdown.totalBatches}</div>
            <div className="text-sm text-muted-foreground">总批次数</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">{breakdown.totalLocations}</div>
            <div className="text-sm text-muted-foreground">存储位置</div>
          </div>
        </div>

        {lastUpdated && (
          <div className="mt-4 border-t pt-4">
            <div className="text-center text-sm text-muted-foreground">
              最后更新: {new Date(lastUpdated).toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
