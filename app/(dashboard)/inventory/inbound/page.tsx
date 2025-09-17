'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
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
    Plus,
    TrendingUp,
    User
} from 'lucide-react';

// API and Types
import { useInboundRecords, useInboundStats } from '@/lib/api/inbound';

// 入库原因标签映射
const INBOUND_REASON_LABELS = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
} as const;

/**
 * 入库记录页面
 * 显示所有入库操作的历史记录
 */
export default function InboundRecordsPage() {
  const router = useRouter();

  // 获取入库记录数据
  const { data, isLoading, error } = useInboundRecords({
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取统计数据
  const { data: stats } = useInboundStats();

  const inboundRecords = data?.data || [];

  // 格式化日期
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  };

  // 格式化操作类型
  const getOperationTypeLabel = (reason: string) => {
    return INBOUND_REASON_LABELS[reason as keyof typeof INBOUND_REASON_LABELS] || reason;
  };

  // 获取操作类型样式
  const getOperationTypeVariant = (reason: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      purchase: 'default',
      return: 'secondary',
      transfer: 'outline',
      surplus: 'default',
      other: 'destructive',
    };
    return variants[reason] || 'default';
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">入库记录</h1>
            <p className="text-muted-foreground">查看所有入库操作的历史记录</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              加载入库记录失败，请稍后重试
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
            <h1 className="text-3xl font-bold tracking-tight">入库记录</h1>
            <p className="text-muted-foreground">查看所有入库操作的历史记录</p>
          </div>
        </div>

        <Button onClick={() => router.push('/inventory/inbound/create')}>
          <Plus className="mr-2 h-4 w-4" />
          产品入库
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日入库</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.todayCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">笔入库记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月入库</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.monthCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">笔入库记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总入库量</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalQuantity || 0}
            </div>
            <p className="text-xs text-muted-foreground">件商品</p>
          </CardContent>
        </Card>
      </div>

      {/* 入库记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>入库记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : inboundRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无入库记录
            </div>
          ) : (
            <div className="space-y-4">
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品信息</TableHead>
                      <TableHead>操作类型</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>操作人</TableHead>
                      <TableHead>操作时间</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboundRecords.map((record) => (
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
                          <Badge variant={getOperationTypeVariant(record.reason)}>
                            {getOperationTypeLabel(record.reason)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          +{record.quantity}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {record.user?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(record.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {record.remarks || '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {inboundRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {record.product?.name || '-'}
                            </span>
                          </div>
                          <Badge variant={getOperationTypeVariant(record.reason)}>
                            {getOperationTypeLabel(record.reason)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">数量：</span>
                            <span className="font-medium">+{record.quantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">操作人：</span>
                            <span>{record.user?.name || '-'}</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">时间：</span>
                          <span>{formatDate(record.createdAt)}</span>
                        </div>
                        {record.remarks && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">备注：</span>
                            <span>{record.remarks}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
