'use client';

import { useQuery } from '@tanstack/react-query';

import { getVariantInventorySummary } from '@/lib/api/product-variants';

interface VariantInventorySummaryData {
  variant: {
    id: string;
    colorCode: string;
    sku: string;
    product: {
      id: string;
      code: string;
      name: string;
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
  breakdown: {
    locations: Array<{
      location: string;
      quantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      batches: number;
    }>;
    productionDates: Array<{
      productionDate: string;
      quantity: number;
      batches: number;
    }>;
    totalBatches: number;
    totalLocations: number;
  };
}

export function useVariantInventorySummary(variantId: string) {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['variant-inventory-summary', variantId],
    queryFn: () => getVariantInventorySummary(variantId),
    enabled: !!variantId,
  });

  // 类型安全的数据转换
  const summaryData = summary as unknown as
    | VariantInventorySummaryData
    | undefined;

  // 计算库存百分比
  const stockPercentage = summaryData?.inventory
    ? summaryData.inventory.totalQuantity > 0
      ? (summaryData.inventory.availableQuantity /
          summaryData.inventory.totalQuantity) *
        100
      : 0
    : 0;

  // 获取库存状态颜色
  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-500';
      case 'low_stock':
        return 'bg-yellow-500';
      case 'out_of_stock':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 获取库存状态文本
  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'in_stock':
        return '库存充足';
      case 'low_stock':
        return '库存偏低';
      case 'out_of_stock':
        return '缺货';
      default:
        return '未知状态';
    }
  };

  return {
    summaryData,
    isLoading,
    error,
    stockPercentage,
    getStockStatusColor,
    getStockStatusText,
  };
}
