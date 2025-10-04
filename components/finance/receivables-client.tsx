'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, Filter, Search } from 'lucide-react';
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
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';

interface ReceivablesClientProps {
  initialData: ReceivablesResult;
}

/**
 * 应收账款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function ReceivablesClient({ initialData }: ReceivablesClientProps) {
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
    sortBy: searchParams.get('sortBy') || 'orderDate',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  });

  // 获取应收账款数据
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.receivablesList(queryParams),
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

      const response = await fetch(`/api/finance/receivables?${params}`);
      if (!response.ok) {
        throw new Error('获取应收账款失败');
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
      unpaid: { label: '未收款', variant: 'destructive' as const },
      partial: { label: '部分收款', variant: 'secondary' as const },
      paid: { label: '已收款', variant: 'default' as const },
      overdue: { label: '逾期', variant: 'destructive' as const },
      pending: { label: '待确认', variant: 'secondary' as const },
      confirmed: { label: '已确认', variant: 'default' as const },
      cancelled: { label: '已取消', variant: 'secondary' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>
        {config?.label || '未知状态'}
      </Badge>
    );
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

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentData.summary?.totalReceivable || 0)}
            </div>
            <p className="text-muted-foreground text-xs">
              {currentData.summary?.receivableCount || 0} 个应收订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(currentData.summary?.totalOverdue || 0)}
            </div>
            <p className="text-muted-foreground text-xs">
              {currentData.summary?.overdueCount || 0} 个逾期订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">收款率</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(currentData.summary?.collectionRate || 0).toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-xs">较上月提升 5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均账期</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {currentData.summary?.averageAccountPeriod || 0}天
            </div>
            <p className="text-muted-foreground text-xs">较上月减少 3天</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>应收账款列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="搜索订单号或客户名称..."
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
                  <SelectItem value="unpaid">未收款</SelectItem>
                  <SelectItem value="partial">部分收款</SelectItem>
                  <SelectItem value="paid">已收款</SelectItem>
                  <SelectItem value="overdue">逾期</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={queryParams.sortBy}
                onValueChange={value =>
                  setQueryParams(prev => ({ ...prev, sortBy: value, page: 1 }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orderDate">订单日期</SelectItem>
                  <SelectItem value="totalAmount">订单金额</SelectItem>
                  <SelectItem value="customerName">客户名称</SelectItem>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={queryParams.sortOrder}
                onValueChange={value =>
                  setQueryParams(prev => ({
                    ...prev,
                    sortOrder: value as 'asc' | 'desc',
                    page: 1,
                  }))
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">降序</SelectItem>
                  <SelectItem value="asc">升序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 应收账款列表 */}
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
            ) : !currentData.receivables?.length ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">暂无应收账款数据</div>
              </div>
            ) : (
              currentData.receivables.map((receivable: ReceivableItem) => (
                <Card
                  key={receivable.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {receivable.orderNumber}
                          </h3>
                          {getStatusBadge(receivable.paymentStatus)}
                          {receivable.overdueDays &&
                            receivable.overdueDays > 0 && (
                              <Badge variant="destructive">
                                逾期 {receivable.overdueDays} 天
                              </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          客户：{receivable.customerName}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <span>订单日期：{receivable.orderDate}</span>
                          {receivable.lastPaymentDate && (
                            <span>最后收款：{receivable.lastPaymentDate}</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <div>
                          <p className="text-muted-foreground text-sm">
                            订单金额
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(receivable.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            已收金额
                          </p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(receivable.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            待收金额
                          </p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(receivable.remainingAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/sales-orders/${receivable.id}`)
                        }
                      >
                        查看详情
                      </Button>
                      {receivable.remainingAmount > 0 && (
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/finance/payments/create?orderId=${receivable.id}`
                            )
                          }
                        >
                          收款
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
