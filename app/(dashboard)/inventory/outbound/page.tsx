'use client';

import { formatDateTime } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    FileText,
    Package,
    TrendingDown,
    User
} from 'lucide-react';

// API and Types
import type { OutboundRecord } from '@/lib/types/inventory';

/**
 * 出库记录页面
 * 显示所有出库操作的历史记录
 */
export default function OutboundRecordsPage() {
  const router = useRouter();

  // 获取出库记录数据 - 暂时使用模拟数据
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-records', { type: 'outbound' }],
    queryFn: async () => {
      // 模拟出库记录数据
      return {
        data: [] as OutboundRecord[],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      };
    },
  });

  const outboundRecords = data?.data || [];

  // 使用统一的日期格式化函数

  // 格式化操作类型
  const getOperationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      outbound: '出库',
      sale: '销售出库',
      transfer: '调拨出库',
      return: '退货出库',
      adjustment: '盘点调整',
    };
    return labels[type] || type;
  };

  // 获取操作类型颜色
  const getOperationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      outbound: 'default',
      sale: 'destructive',
      transfer: 'secondary',
      return: 'outline',
      adjustment: 'default',
    };
    return colors[type] || 'default';
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
              <h1 className="text-3xl font-bold tracking-tight">出库记录</h1>
              <p className="text-muted-foreground">查看所有出库操作的历史记录</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">加载失败</h3>
              <p className="text-muted-foreground mb-4">无法加载出库记录数据</p>
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
            <h1 className="text-3xl font-bold tracking-tight">出库记录</h1>
            <p className="text-muted-foreground">查看所有出库操作的历史记录</p>
          </div>
        </div>

      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日出库</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outboundRecords.filter(record => {
                const today = new Date().toDateString();
                return new Date(record.createdAt).toDateString() === today;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">笔出库记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月出库</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outboundRecords.filter(record => {
                const thisMonth = new Date().getMonth();
                const thisYear = new Date().getFullYear();
                const recordDate = new Date(record.createdAt);
                return recordDate.getMonth() === thisMonth && recordDate.getFullYear() === thisYear;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">笔出库记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总出库记录</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outboundRecords.length}</div>
            <p className="text-xs text-muted-foreground">笔出库记录</p>
          </CardContent>
        </Card>
      </div>

      {/* 出库记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            出库记录列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outboundRecords.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无出库记录</h3>
              <p className="text-muted-foreground">还没有任何出库操作记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品信息</TableHead>
                  <TableHead>操作类型</TableHead>
                  <TableHead>出库数量</TableHead>
                  <TableHead>操作人员</TableHead>
                  <TableHead>操作时间</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outboundRecords.map((record) => (
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
                      <Badge variant={getOperationTypeColor(record.type) as any}>
                        {getOperationTypeLabel(record.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      -{record.quantity} {record.product?.unit || '件'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {record.user?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(record.createdAt)}
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
