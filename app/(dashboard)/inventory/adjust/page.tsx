'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Edit,
  Package,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Icons
// Components

// API and Types
import { getInventories, inventoryQueryKeys } from '@/lib/api/inventory';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

/**
 * 库存调整页面
 * 显示所有库存调整操作的历史记录，并提供新增调整功能
 */
export default function InventoryAdjustPage() {
  const router = useRouter();
  const [showAdjustDialog, setShowAdjustDialog] = React.useState(false);

  // 获取库存数据 - 用于显示当前库存状态
  const queryParams: InventoryQueryParams = {
    page: 1,
    limit: 50,
    hasStock: true, // 只显示有库存的记录
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: inventoryQueryKeys.list(queryParams),
    queryFn: () => getInventories(queryParams),
  });

  const inventoryRecords = data?.data || [];

  // 格式化日期
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return null;
    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  };

  // 获取库存状态标签
  const getStockStatusLabel = (
    quantity: number,
    reservedQuantity: number = 0
  ) => {
    const availableQuantity = quantity - reservedQuantity;
    if (availableQuantity <= 0) {
      return '缺货';
    } else if (availableQuantity <= 10) {
      return '库存不足';
    } else {
      return '库存充足';
    }
  };

  // 获取库存状态颜色
  const getStockStatusColor = (
    quantity: number,
    reservedQuantity: number = 0
  ) => {
    const availableQuantity = quantity - reservedQuantity;
    if (availableQuantity <= 0) {
      return 'destructive';
    } else if (availableQuantity <= 10) {
      return 'secondary';
    } else {
      return 'default';
    }
  };

  // 获取库存数量显示
  const getStockDisplay = (record: Inventory) => {
    const availableQuantity = record.quantity - (record.reservedQuantity || 0);
    return (
      <div className="flex flex-col">
        <span className="font-medium">
          {record.product?.piecesPerUnit
            ? formatInventoryQuantity(availableQuantity, record.product, true)
            : `${availableQuantity} ${
                record.product?.unit
                  ? PRODUCT_UNIT_LABELS[
                      record.product.unit as keyof typeof PRODUCT_UNIT_LABELS
                    ] || record.product.unit
                  : '件'
              }`}
        </span>
        {record.reservedQuantity > 0 && (
          <span className="text-xs text-muted-foreground">
            预留:{' '}
            {record.product?.piecesPerUnit
              ? formatInventoryQuantity(
                  record.reservedQuantity,
                  record.product,
                  false
                )
              : record.reservedQuantity}
          </span>
        )}
      </div>
    );
  };

  // 处理调整成功
  const handleAdjustSuccess = () => {
    setShowAdjustDialog(false);
    refetch();
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-20" />
            <div>
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">库存调整</h1>
              <p className="text-muted-foreground">
                管理库存调整操作和查看历史记录
              </p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">加载失败</h3>
              <p className="mb-4 text-muted-foreground">
                无法加载库存调整记录数据
              </p>
              <Button onClick={() => window.location.reload()}>重试</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">库存调整</h1>
            <p className="text-muted-foreground">
              管理库存调整操作和查看历史记录
            </p>
          </div>
        </div>
        <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增调整
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>库存调整</DialogTitle>
            </DialogHeader>
            <InventoryOperationForm
              mode="adjust"
              onSuccess={handleAdjustSuccess}
              onCancel={() => setShowAdjustDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">库存充足</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {
                inventoryRecords.filter((record: Inventory) => {
                  const availableQuantity =
                    record.quantity - (record.reservedQuantity || 0);
                  return availableQuantity > 10;
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">个产品库存充足</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">库存不足</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {
                inventoryRecords.filter((record: Inventory) => {
                  const availableQuantity =
                    record.quantity - (record.reservedQuantity || 0);
                  return availableQuantity > 0 && availableQuantity <= 10;
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">个产品库存不足</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">缺货产品</CardTitle>
            <Package className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {
                inventoryRecords.filter((record: Inventory) => {
                  const availableQuantity =
                    record.quantity - (record.reservedQuantity || 0);
                  return availableQuantity <= 0;
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">个产品缺货</p>
          </CardContent>
        </Card>
      </div>

      {/* 当前库存列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            当前库存状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inventoryRecords.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">暂无库存记录</h3>
              <p className="mb-4 text-muted-foreground">还没有任何库存数据</p>
              <Button onClick={() => setShowAdjustDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加库存
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品信息</TableHead>
                  <TableHead>产品详情</TableHead>
                  <TableHead>库存状态</TableHead>
                  <TableHead>当前库存</TableHead>
                  <TableHead>最后更新</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryRecords.map((record: Inventory) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {record.product?.name || '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            编码: {record.product?.code || '-'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {/* 显示产品规格 */}
                        {record.product?.specification && (
                          <div className="text-sm text-muted-foreground">
                            {record.product.specification}
                          </div>
                        )}
                        {/* 显示批次号（如果有） */}
                        {record.batchNumber && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              批次:{' '}
                            </span>
                            <span>{record.batchNumber}</span>
                          </div>
                        )}
                        {/* 显示库存位置（如果有） */}
                        {record.location && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              位置:{' '}
                            </span>
                            <span>{record.location}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          getStockStatusColor(
                            record.quantity,
                            record.reservedQuantity
                          ) as
                            | 'default'
                            | 'secondary'
                            | 'destructive'
                            | 'outline'
                        }
                      >
                        {getStockStatusLabel(
                          record.quantity,
                          record.reservedQuantity
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStockDisplay(record)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(record.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdjustDialog(true)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        调整
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
