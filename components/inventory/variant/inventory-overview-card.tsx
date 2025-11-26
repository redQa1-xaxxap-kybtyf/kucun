'use client';

import { Package } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryOverviewCardProps {
  variant: {
    id: string;
    colorCode: string;
    sku: string;
    product: {
      id: string;
      code: string;
      name: string;
      piecesPerUnit?: number;
    };
  };
  inventory: {
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    averageUnitCost: number;
    stockStatus: string;
    lastUpdated: string;
  };
  stockPercentage: number;
  getStockStatusColor: (status: string) => string;
  getStockStatusText: (status: string) => string;
}

export function InventoryOverviewCard({
  variant,
  inventory,
  stockPercentage,
  getStockStatusColor,
  getStockStatusText,
}: InventoryOverviewCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          库存概览
        </CardTitle>
        <CardDescription>
          {variant.product.name} ({variant.sku})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {(() => {
                const ppu = variant.product.piecesPerUnit ?? 0;
                return ppu > 0
                  ? formatPieceSummary(inventory.totalQuantity, ppu, {
                      fallbackUnit: '片',
                    })
                  : `${inventory.totalQuantity}片`;
              })()}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              总库存
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {(() => {
                const ppu = variant.product.piecesPerUnit ?? 0;
                return ppu > 0
                  ? formatPieceSummary(inventory.availableQuantity, ppu, {
                      fallbackUnit: '片',
                    })
                  : `${inventory.availableQuantity}片`;
              })()}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              可用库存
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {(() => {
                const ppu = variant.product.piecesPerUnit ?? 0;
                return ppu > 0
                  ? formatPieceSummary(inventory.reservedQuantity, ppu, {
                      fallbackUnit: '片',
                    })
                  : `${inventory.reservedQuantity}片`;
              })()}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              预留库存
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-info))]">
              ￥{inventory.averageUnitCost?.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              平均成本
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">库存状态</span>
            <Badge
              variant={
                (getStockStatusColor(
                  inventory.stockStatus
                ) as BadgeProps['variant']) ?? 'secondary'
              }
            >
              {getStockStatusText(inventory.stockStatus)}
            </Badge>
          </div>
          <Progress value={stockPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-[hsl(var(--color-text-tertiary))]">
            <span>可用: {inventory.availableQuantity}</span>
            <span>总计: {inventory.totalQuantity}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
