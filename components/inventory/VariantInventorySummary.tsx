'use client';

import { Package } from 'lucide-react';
import React from 'react';

import { InventoryAlertCard } from '@/components/inventory/variant/inventory-alert-card';
import { InventoryOverviewCard } from '@/components/inventory/variant/inventory-overview-card';
import { InventoryStatsCard } from '@/components/inventory/variant/inventory-stats-card';
import { InventorySummarySkeleton } from '@/components/inventory/variant/inventory-summary-skeleton';
import { LocationDistributionCard } from '@/components/inventory/variant/location-distribution-card';
import { Card, CardContent } from '@/components/ui/card';
import { useVariantInventorySummary } from '@/hooks/use-variant-inventory-summary';

interface VariantInventorySummaryProps {
  variantId: string;
  showDetails?: boolean;
}

function ErrorState() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">加载库存汇总失败</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function VariantInventorySummary({
  variantId,
  showDetails = true,
}: VariantInventorySummaryProps) {
  const {
    summaryData,
    isLoading,
    error,
    stockPercentage,
    getStockStatusColor,
    getStockStatusText,
  } = useVariantInventorySummary(variantId);

  if (isLoading) {
    return <InventorySummarySkeleton />;
  }

  if (error || !summaryData) {
    return <ErrorState />;
  }

  const { variant, inventory, breakdown } = summaryData;

  return (
    <div className="space-y-4">
      {/* 库存概览 */}
      <InventoryOverviewCard
        variant={variant}
        inventory={inventory}
        stockPercentage={stockPercentage}
        getStockStatusColor={getStockStatusColor}
        getStockStatusText={getStockStatusText}
      />

      {showDetails && (
        <>
          {/* 存储位置分布 */}
          <LocationDistributionCard locations={breakdown.locations} />

          {/* 统计信息 */}
          <InventoryStatsCard
            breakdown={breakdown}
            lastUpdated={inventory.lastUpdated}
          />

          {/* 库存预警 */}
          <InventoryAlertCard stockStatus={inventory.stockStatus} />
        </>
      )}
    </div>
  );
}
