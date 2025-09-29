'use client';

import { AlertCircle, BellOff, RefreshCw } from 'lucide-react';

import { InventoryAlertStats } from '@/components/inventory/alerts/inventory-alert-stats';
import { InventoryAlertTable } from '@/components/inventory/alerts/inventory-alert-table';
import { InventoryAlertsSkeleton } from '@/components/inventory/alerts/inventory-alerts-skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useInventoryAlerts } from '@/hooks/use-inventory-alerts';

interface InventoryAlertsProps {
  className?: string;
  showTitle?: boolean;
  maxItems?: number;
}

function renderErrorState(
  className: string,
  showTitle: boolean,
  refetch: () => void
) {
  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            库存预警
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            加载库存预警失败，请稍后重试
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="ml-2"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function renderEmptyState() {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <BellOff className="mx-auto mb-2 h-12 w-12" />
      <p className="text-lg font-medium">暂无库存预警</p>
      <p className="text-sm">所有产品库存状态正常</p>
    </div>
  );
}

/**
 * 库存预警组件
 * 显示库存不足、缺货、库存过多等预警信息
 */
export function InventoryAlerts({
  className = '',
  showTitle = true,
  maxItems,
}: InventoryAlertsProps) {
  const {
    alerts,
    displayAlerts,
    alertStats,
    isLoading,
    error,
    refetch,
    showAll,
    toggleShowAll,
    hasMore,
  } = useInventoryAlerts(maxItems);

  if (isLoading) {
    return <InventoryAlertsSkeleton showTitle={showTitle} />;
  }

  if (error) {
    return renderErrorState(className, showTitle, refetch);
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {alerts.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            ) : (
              <BellOff className="h-5 w-5 text-green-500" />
            )}
            库存预警
            {alerts.length > 0 && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                {alerts.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {alerts.length > 0
              ? `发现 ${alerts.length} 个库存预警，请及时处理`
              : '当前没有库存预警'}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {alerts.length > 0 ? (
          <>
            <InventoryAlertStats
              alertStats={alertStats}
              totalAlerts={alerts.length}
            />
            <InventoryAlertTable
              alerts={displayAlerts}
              showAll={showAll}
              hasMore={hasMore}
              onToggleShowAll={toggleShowAll}
            />
          </>
        ) : (
          renderEmptyState()
        )}
      </CardContent>
    </Card>
  );
}
