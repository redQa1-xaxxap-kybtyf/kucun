'use client';

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
import { useInboundRecords } from '@/lib/api/inbound';
import type { InboundQueryParams, InboundReason } from '@/lib/types/inbound';
import { formatDate } from '@/lib/utils/datetime';

// 入库原因标签映射
const INBOUND_REASON_LABELS = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
} as const;

interface ERPInboundRecordsProps {
  onCreateNew?: () => void;
}

/**
 * ERP风格入库记录组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 */
export function ERPInboundRecords({ onCreateNew }: ERPInboundRecordsProps) {
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
  const handleFilter = (
    key: keyof InboundQueryParams,
    value: string | number | boolean
  ) => {
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

  // 格式化日期 - 使用统一的时间格式化函数
  const formatInboundDate = (dateString: string) =>
    formatDate(dateString, 'yyyy年MM月dd日 HH:mm');

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

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/inventory/inbound/create');
    }
  };

  if (error) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">入库记录</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            加载入库记录失败，请稍后重试
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">入库记录</h3>
            <div className="text-xs text-muted-foreground">
              {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
            </div>
          </div>
        </div>

        {/* 工具栏操作区 */}
        <div className="border-b bg-muted/10 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7" onClick={handleCreateNew}>
                <Plus className="mr-1 h-3 w-3" />
                产品入库
              </Button>
            </div>
          </div>
        </div>

        {/* 筛选条件区域 */}
        <div className="border-b bg-muted/5 px-3 py-2">
          <div className="mb-2 flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">筛选条件</span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">开始日期</label>
              <Input
                type="date"
                value={queryParams.startDate || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleFilter('startDate', e.target.value || undefined)
                }
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">结束日期</label>
              <Input
                type="date"
                value={queryParams.endDate || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleFilter('endDate', e.target.value || undefined)
                }
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">入库类型</label>
              <Select
                value={queryParams.reason || 'all'}
                onValueChange={value =>
                  handleFilter(
                    'reason',
                    value === 'all' ? undefined : (value as InboundReason)
                  )
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="全部类型" />
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
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleResetFilters}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重置
              </Button>
            </div>
          </div>
        </div>

        {/* 数据表格区域 */}
        <div className="p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            入库记录列表
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-6 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : inboundRecords.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              暂无入库记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="text-xs">产品信息</TableHead>
                  <TableHead className="text-xs">操作类型</TableHead>
                  <TableHead className="text-xs">数量</TableHead>
                  <TableHead className="text-xs">操作人</TableHead>
                  <TableHead className="text-xs">操作时间</TableHead>
                  <TableHead className="text-xs">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboundRecords.map(record => (
                  <TableRow key={record.id} className="h-10">
                    <TableCell className="py-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <div className="text-xs font-medium">
                            {record.product?.name || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            编码: {record.product?.code || '-'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge
                        variant={getOperationTypeVariant(record.reason)}
                        className="text-xs"
                      >
                        {getOperationTypeLabel(record.reason)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 text-xs font-medium">
                      +{record.quantity}片
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {record.user?.name || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {formatInboundDate(record.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <span className="text-xs text-muted-foreground">
                        {record.remarks || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
