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
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <div>
            <div className="font-medium text-orange-800">
              {stockStatus === 'low_stock' ? '库存预警' : '缺货警告'}
            </div>
            <div className="text-sm text-orange-700">
              {stockStatus === 'low_stock'
                ? '当前库存偏低，建议及时补货'
                : '当前已无可用库存，请尽快补货'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
