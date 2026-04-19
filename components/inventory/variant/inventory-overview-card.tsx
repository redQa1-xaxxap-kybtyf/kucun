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
import { formatCostPrice } from '@/lib/utils/cost-price';
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
  const piecesPerUnit = variant.product.piecesPerUnit ?? 0;
  const formatInventoryQuantity = (quantity: number) =>
    piecesPerUnit > 0
      ? formatPieceSummary(quantity, piecesPerUnit, {
          fallbackUnit: '片',
          zeroDisplay: '0片',
        })
      : `${quantity}片`;

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
              {formatInventoryQuantity(inventory.totalQuantity)}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              库存总量
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatInventoryQuantity(inventory.availableQuantity)}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              可用数量
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatInventoryQuantity(inventory.reservedQuantity)}
            </div>
            <div className="text-sm text-[hsl(var(--color-text-secondary))]">
              预留数量
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--color-info))]">
              {formatCostPrice(inventory.averageUnitCost)}
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--color-text-tertiary))]">
            <span>可用：{formatInventoryQuantity(inventory.availableQuantity)}</span>
            <span>库存总量：{formatInventoryQuantity(inventory.totalQuantity)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
