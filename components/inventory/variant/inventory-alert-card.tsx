'use client';

import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { Card, CardContent } from '@/components/ui/card';

interface InventoryAlertCardProps {
  stockStatus: string;
}

export function InventoryAlertCard({ stockStatus }: InventoryAlertCardProps) {
  if (stockStatus === 'in_stock') {
    return null;
  }

  return (
    <Card className="border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))]">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[hsl(var(--color-warning))]" />
          <div>
            <div className="font-medium text-[hsl(var(--color-warning))]">
              {stockStatus === 'low_stock' ? '库存预警' : '缺货警告'}
            </div>
            <div className="text-sm text-[hsl(var(--color-warning-hover))]">
              {stockStatus === 'low_stock' ? '当前库存偏低' : '暂无可用库存'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
