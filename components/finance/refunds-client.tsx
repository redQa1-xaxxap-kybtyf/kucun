'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Filter,
  Search,
  TrendingDown,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

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
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type {
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';

/**
 * 服务器组件传递的退款记录类型（Date 已序列化为 Date 对象）
 */
type RefundRecordFromServer = {
  id: string;
  refundNumber: string;
  returnOrderId: string | null;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  refundDate: Date;
  processedDate: Date | null;
  status: RefundStatus;
  reason: string;
  remarks: string | null;
  bankInfo: string | null;
  receiptNumber: string | null;
  returnOrderNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface RefundsClientProps {
  initialData: {
    refunds: RefundRecordFromServer[];
    statistics: {
      totalRefundable: number;
      totalProcessed: number;
      totalRemaining: number;
      pendingCount: number;
      processingCount: number;
      completedCount: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * 退款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function RefundsClient({ initialData }: RefundsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [queryParams, setQueryParams] = React.useState({
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(
      searchParams.get('limit') || `${paginationConfig.defaultPageSize}`,
      10
    ),
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || undefined,
    sortBy: searchParams.get('sortBy') || 'refundDate',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  });

  // 获取退款记录数据
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.refundsList(queryParams),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', queryParams.page.toString());
      params.set('pageSize', queryParams.limit.toString());
      if (queryParams.search) {
        params.set('search', queryParams.search);
      }
      if (queryParams.status) {
        params.set('status', queryParams.status);
      }
      params.set('sortBy', queryParams.sortBy);
      params.set('sortOrder', queryParams.sortOrder);

      const response = await fetch(`/api/finance/refunds?${params}`);
      if (!response.ok) {
        throw new Error('获取退款记录失败');
      }
      return response.json();
    },
    initialData: { data: initialData },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '待处理', variant: 'secondary' as const },
      processing: { label: '处理中', variant: 'default' as const },
      completed: { label: '已完成', variant: 'default' as const },
      rejected: { label: '已拒绝', variant: 'destructive' as const },
      cancelled: { label: '已取消', variant: 'secondary' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>
        {config?.label || '未知状态'}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = {
      refund: '退款',
      exchange: '换货',
      return: '退货',
      partial_refund: '部分退款',
      full_refund: '全额退款',
      exchange_refund: '换货退款',
    };
    return typeConfig[type as keyof typeof typeConfig] || '其他类型';
  };

  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleStatusFilter = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      status: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setQueryParams(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentData = data?.data || initialData;
  const statistics = initialData.statistics;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(statistics.totalRefundable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.pendingCount} 个待处理
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已处理金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(statistics.totalProcessed)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.completedCount} 个已完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">处理率</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.totalRefundable > 0
                ? (
                    (statistics.totalProcessed / statistics.totalRefundable) *
                    100
                  ).toFixed(1)
                : '0.0'}
              %
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.processingCount} 个处理中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理金额</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(statistics.totalRemaining)}
            </div>
            <p className="text-muted-foreground text-xs">需要处理的退款</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>退款申请列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="搜索退货单号或客户名称..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={queryParams.status || 'all'}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 退款申请列表 */}
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-red-600">
                  加载失败: {(error as Error).message}
                </div>
              </div>
            ) : currentData.refunds.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">暂无退款记录</p>
              </div>
            ) : (
              currentData.refunds.map((refund: RefundRecord) => (
                <Card
                  key={refund.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {refund.refundNumber}
                          </h3>
                          {getStatusBadge(refund.status)}
                          <Badge variant="outline">
                            {getTypeLabel(refund.refundType || 'refund')}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          客户ID：{refund.customerId}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          原订单ID：{refund.salesOrderId}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <span>
                            退款日期：
                            {typeof refund.refundDate === 'string'
                              ? refund.refundDate
                              : refund.refundDate.toLocaleDateString()}
                          </span>
                          <span>退款原因：{refund.reason}</span>
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <div>
                          <p className="text-muted-foreground text-sm">
                            退款金额
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(refund.refundAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            已处理
                          </p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(refund.processedAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            待处理
                          </p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(refund.remainingAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/return-orders/${refund.returnOrderId}`)
                        }
                      >
                        查看详情
                      </Button>
                      {refund.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(`/finance/refunds/${refund.id}/process`)
                          }
                        >
                          处理退款
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              共 {currentData.pagination?.total || 0} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={queryParams.page <= 1 || isLoading}
                onClick={() => handlePageChange(queryParams.page - 1)}
              >
                上一页
              </Button>
              <span className="text-muted-foreground text-sm">
                第 {queryParams.page} /{' '}
                {currentData.pagination?.totalPages || 1} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  queryParams.page >=
                    (currentData.pagination?.totalPages || 1) || isLoading
                }
                onClick={() => handlePageChange(queryParams.page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
