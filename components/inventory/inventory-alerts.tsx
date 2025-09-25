'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  BellOff,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

// UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getInventoryAlerts, inventoryQueryKeys } from '@/lib/api/inventory';
import {
  INVENTORY_ALERT_TYPE_LABELS,
  INVENTORY_ALERT_TYPE_VARIANTS,
  type InventoryAlert,
} from '@/lib/types/inventory';

interface InventoryAlertsProps {
  className?: string;
  showTitle?: boolean;
  maxItems?: number;
}

export function InventoryAlerts({
  className = '',
  showTitle = true,
  maxItems,
}: InventoryAlertsProps) {
  const [showAll, setShowAll] = useState(false);

  // 获取库存预警
  const {
    data: alertsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: inventoryQueryKeys.alerts(),
    queryFn: () => getInventoryAlerts(),
    refetchInterval: 5 * 60 * 1000, // 5分钟自动刷新
  });

  if (isLoading) {
    return <InventoryAlertsSkeleton showTitle={showTitle} />;
  }

  if (error) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />
              库存预警
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : '获取库存预警失败'}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const alerts = alertsData || [];
  const displayAlerts =
    maxItems && !showAll ? alerts.slice(0, maxItems) : alerts;

  // 按类型分组统计
  const alertStats = alerts.reduce(
    (acc: Record<string, number>, alert: { type: string }) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                库存预警
              </CardTitle>
              <CardDescription>
                {alerts.length > 0
                  ? `发现 ${alerts.length} 个库存预警`
                  : '暂无库存预警'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent>
        {alerts.length === 0 ? (
          <div className="py-8 text-center">
            <BellOff className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">暂无库存预警</h3>
            <p className="text-muted-foreground">所有产品库存状态正常</p>
          </div>
        ) : (
          <>
            {/* 预警统计 */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(alertStats).map(([type, count]) => (
                <div key={type} className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {count as React.ReactNode}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {
                      INVENTORY_ALERT_TYPE_LABELS[
                        type as keyof typeof INVENTORY_ALERT_TYPE_LABELS
                      ]
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* 预警列表 */}
            {/* 桌面端表格 */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>预警类型</TableHead>
                    <TableHead>产品</TableHead>
                    <TableHead>色号</TableHead>
                    <TableHead>生产日期</TableHead>
                    <TableHead>当前库存</TableHead>
                    <TableHead>安全库存</TableHead>
                    <TableHead>预警时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayAlerts.map((alert: InventoryAlert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Badge
                          variant={INVENTORY_ALERT_TYPE_VARIANTS[alert.type]}
                        >
                          {INVENTORY_ALERT_TYPE_LABELS[alert.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">
                            {alert.inventory?.product?.name || '未知产品'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {alert.inventory?.product?.code}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-orange-600">
                          {alert.currentStock || alert.inventory?.quantity || 0}{' '}
                          {alert.inventory?.product?.unit || '件'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {alert.safetyStock ||
                            alert.inventory?.product?.safetyStock ||
                            0}{' '}
                          {alert.inventory?.product?.unit || '件'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(
                            alert.lastUpdated || alert.createdAt || new Date()
                          ).toLocaleString('zh-CN')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // 跳转到入库页面，预填产品信息
                            window.location.href = `/inventory/inbound?productId=${alert.inventory?.productId}`;
                          }}
                        >
                          <TrendingUp className="mr-1 h-4 w-4" />
                          入库
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 移动端卡片 */}
            <div className="space-y-4 md:hidden">
              {displayAlerts.map((alert: InventoryAlert) => (
                <Card
                  key={alert.id}
                  className="border-orange-200 bg-orange-50/50"
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge
                        variant={INVENTORY_ALERT_TYPE_VARIANTS[alert.type]}
                        className="text-xs"
                      >
                        {INVENTORY_ALERT_TYPE_LABELS[alert.type]}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.location.href = `/inventory/inbound?productId=${alert.inventory?.productId}`;
                        }}
                      >
                        <TrendingUp className="mr-1 h-4 w-4" />
                        入库
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">产品:</span>
                        <span className="font-medium">
                          {alert.inventory?.product?.name || '未知产品'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">产品编码:</span>
                        <span>{alert.inventory?.product?.code || '无'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">当前库存:</span>
                        <span className="font-medium text-orange-600">
                          {alert.currentStock || alert.inventory?.quantity || 0}{' '}
                          {alert.inventory?.product?.unit || '件'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">安全库存:</span>
                        <span className="font-medium">
                          {alert.safetyStock ||
                            alert.inventory?.product?.safetyStock ||
                            0}{' '}
                          {alert.inventory?.product?.unit || '件'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">预警时间:</span>
                        <span>
                          {new Date(
                            alert.lastUpdated || alert.createdAt || new Date()
                          ).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 显示更多按钮 */}
            {maxItems && alerts.length > maxItems && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                  {showAll ? '收起' : `显示全部 ${alerts.length} 个预警`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// 加载骨架屏
function InventoryAlertsSkeleton({ showTitle }: { showTitle: boolean }) {
  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-16" />
          </div>
        </CardHeader>
      )}

      <CardContent>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 text-center">
              <Skeleton className="mx-auto h-8 w-8" />
              <Skeleton className="mx-auto h-4 w-16" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
