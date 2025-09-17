'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import {
    ArrowLeft,
    Calendar,
    Edit,
    FileText,
    Package,
    Plus,
    TrendingDown,
    TrendingUp,
    User
} from 'lucide-react';

// Components
import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';

// API and Types
import type { InboundRecord, OutboundRecord } from '@/lib/types/inventory';

// 定义调整记录类型
type AdjustRecord = InboundRecord | OutboundRecord;

/**
 * 库存调整页面
 * 显示所有库存调整操作的历史记录，并提供新增调整功能
 */
export default function InventoryAdjustPage() {
  const router = useRouter();
  const [showAdjustDialog, setShowAdjustDialog] = React.useState(false);

  // 获取库存调整记录数据 - 暂时使用模拟数据
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-records', { type: 'adjust' }],
    queryFn: async () => {
      // 模拟调整记录数据
      return {
        data: [] as AdjustRecord[],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      };
    },
  });

  const adjustRecords = data?.data || [];

  // 格式化日期
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  };

  // 格式化调整类型
  const getAdjustmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      adjust: '库存调整',
      inventory_check: '盘点调整',
      damage: '损耗调整',
      loss: '丢失调整',
      found: '盘盈调整',
    };
    return labels[type] || type;
  };

  // 获取调整类型颜色
  const getAdjustmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      adjust: 'default',
      inventory_check: 'secondary',
      damage: 'destructive',
      loss: 'destructive',
      found: 'default',
    };
    return colors[type] || 'default';
  };

  // 获取数量变化显示
  const getQuantityChange = (record: AdjustRecord) => {
    const quantity = record.quantity || 0;
    if (quantity > 0) {
      return (
        <span className="text-green-600 font-medium">
          <TrendingUp className="inline h-4 w-4 mr-1" />
          +{quantity}
        </span>
      );
    } else if (quantity < 0) {
      return (
        <span className="text-red-600 font-medium">
          <TrendingDown className="inline h-4 w-4 mr-1" />
          {quantity}
        </span>
      );
    }
    return <span className="text-muted-foreground">0</span>;
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
              <Skeleton className="h-8 w-32 mb-2" />
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
              <p className="text-muted-foreground">管理库存调整操作和查看历史记录</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">加载失败</h3>
              <p className="text-muted-foreground mb-4">无法加载库存调整记录数据</p>
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
            <p className="text-muted-foreground">管理库存调整操作和查看历史记录</p>
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
            <CardTitle className="text-sm font-medium">今日调整</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adjustRecords.filter(record => {
                const today = new Date().toDateString();
                return new Date(record.createdAt).toDateString() === today;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">笔调整记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月调整</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adjustRecords.filter(record => {
                const thisMonth = new Date().getMonth();
                const thisYear = new Date().getFullYear();
                const recordDate = new Date(record.createdAt);
                return recordDate.getMonth() === thisMonth && recordDate.getFullYear() === thisYear;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">笔调整记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总调整记录</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adjustRecords.length}</div>
            <p className="text-xs text-muted-foreground">笔调整记录</p>
          </CardContent>
        </Card>
      </div>

      {/* 库存调整记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            库存调整记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adjustRecords.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无调整记录</h3>
              <p className="text-muted-foreground mb-4">还没有任何库存调整操作记录</p>
              <Button onClick={() => setShowAdjustDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                立即调整
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品信息</TableHead>
                  <TableHead>调整类型</TableHead>
                  <TableHead>数量变化</TableHead>
                  <TableHead>操作人员</TableHead>
                  <TableHead>操作时间</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {record.product?.name || '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {record.product?.code || '-'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getAdjustmentTypeColor(record.type) as any}>
                        {getAdjustmentTypeLabel(record.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getQuantityChange(record)}
                      <span className="ml-1 text-muted-foreground">
                        {record.product?.unit || '件'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {record.user?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(record.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {record.remarks || '-'}
                      </div>
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
