'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Filter,
  Package,
  Plus,
  RotateCcw,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// API and Types
import { useInboundRecords } from '@/lib/api/inbound';
import type { InboundQueryParams, InboundReason } from '@/lib/types/inbound';

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
 * 显示所有入库操作的历史记录，支持日期和类型筛选
 */
export default function InboundRecordsPage() {
  const router = useRouter();

  // 筛选状态
  const [queryParams, setQueryParams] = React.useState<InboundQueryParams>({
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取入库记录数据
  const { data, isLoading, error } = useInboundRecords(queryParams);

  const inboundRecords = data?.data || [];

  // 处理筛选条件变化
  const handleFilter = (key: keyof InboundQueryParams, value: any) => {
    setQueryParams(prev => ({
      ...prev,
      [key]: value,
      page: 1, // 重置到第一页
    }));
  };

  // 重置筛选条件
  const handleResetFilters = () => {
    setQueryParams({
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  // 格式化日期
  const formatDate = (dateString: string) =>
    format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

  // 格式化操作类型
  const getOperationTypeLabel = (reason: string) =>
    INBOUND_REASON_LABELS[reason as keyof typeof INBOUND_REASON_LABELS] ||
    reason;

  // 获取操作类型样式
  const getOperationTypeVariant = (reason: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
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

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            {/* 日期筛选器 */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始日期</label>
                <Input
                  type="date"
                  value={queryParams.startDate || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFilter('startDate', e.target.value || undefined)
                  }
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束日期</label>
                <Input
                  type="date"
                  value={queryParams.endDate || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFilter('endDate', e.target.value || undefined)
                  }
                  className="w-40"
                />
              </div>
            </div>

            {/* 入库类型筛选器 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">入库类型</label>
              <Select
                value={queryParams.reason || 'all'}
                onValueChange={value =>
                  handleFilter(
                    'reason',
                    value === 'all' ? undefined : (value as InboundReason)
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="入库类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="purchase">采购入库</SelectItem>
                  <SelectItem value="return">退货入库</SelectItem>
                  <SelectItem value="transfer">调拨入库</SelectItem>
                  <SelectItem value="surplus">盘盈入库</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 重置按钮 */}
            <Button variant="outline" onClick={handleResetFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <div className="py-8 text-center text-muted-foreground">
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
                    {inboundRecords.map(record => (
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
                          <Badge
                            variant={getOperationTypeVariant(record.reason)}
                          >
                            {getOperationTypeLabel(record.reason)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          +{record.quantity}片
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
              <div className="space-y-4 md:hidden">
                {inboundRecords.map(record => (
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
                          <Badge
                            variant={getOperationTypeVariant(record.reason)}
                          >
                            {getOperationTypeLabel(record.reason)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              数量：
                            </span>
                            <span className="font-medium">
                              +{record.quantity}片
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              操作人：
                            </span>
                            <span>{record.user?.name || '-'}</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">时间：</span>
                          <span>{formatDate(record.createdAt)}</span>
                        </div>
                        {record.remarks && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              备注：
                            </span>
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
