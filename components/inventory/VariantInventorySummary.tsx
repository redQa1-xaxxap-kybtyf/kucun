'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MapPin, Package, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { getVariantInventorySummary } from '@/lib/api/product-variants';

interface VariantInventorySummaryProps {
  variantId: string;
  showDetails?: boolean;
}

export function VariantInventorySummary({
  variantId,
  showDetails = true,
}: VariantInventorySummaryProps) {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['variant-inventory-summary', variantId],
    queryFn: () => getVariantInventorySummary(variantId),
    enabled: !!variantId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Package className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">加载库存汇总失败</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { variant, inventory, breakdown } = summary as any;
  const stockPercentage = inventory.totalQuantity > 0
    ? (inventory.availableQuantity / inventory.totalQuantity) * 100
    : 0;

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

  return (
    <div className="space-y-4">
      {/* 库存概览 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            库存概览
          </CardTitle>
          <CardDescription>
            {variant.product.name} ({variant.sku})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {inventory.totalQuantity}
              </div>
              <div className="text-sm text-muted-foreground">总库存</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {inventory.availableQuantity}
              </div>
              <div className="text-sm text-muted-foreground">可用库存</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {inventory.reservedQuantity}
              </div>
              <div className="text-sm text-muted-foreground">预留库存</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ¥{inventory.averageUnitCost?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-muted-foreground">平均成本</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">库存状态</span>
              <Badge
                variant="outline"
                className={`${getStockStatusColor(inventory.stockStatus)} text-white border-0`}
              >
                {getStockStatusText(inventory.stockStatus)}
              </Badge>
            </div>
            <Progress value={stockPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>可用: {inventory.availableQuantity}</span>
              <span>总计: {inventory.totalQuantity}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {showDetails && (
        <>
          {/* 存储位置分布 */}
          {breakdown.locations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  存储位置分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {breakdown.locations.map((location: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="font-medium">{location.location}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{location.quantity}</div>
                        <div className="text-xs text-muted-foreground">
                          {location.batches} 批次
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}



          {/* 统计信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                统计信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">{breakdown.totalBatches}</div>
                  <div className="text-sm text-muted-foreground">总批次数</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">{breakdown.totalLocations}</div>
                  <div className="text-sm text-muted-foreground">存储位置</div>
                </div>
              </div>

              {inventory.lastUpdated && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground text-center">
                    最后更新: {new Date(inventory.lastUpdated).toLocaleString('zh-CN')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 库存预警 */}
          {inventory.stockStatus !== 'in_stock' && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="font-medium text-orange-800">
                      {inventory.stockStatus === 'low_stock' ? '库存预警' : '缺货警告'}
                    </div>
                    <div className="text-sm text-orange-700">
                      {inventory.stockStatus === 'low_stock'
                        ? '当前库存偏低，建议及时补货'
                        : '当前已无可用库存，请尽快补货'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
