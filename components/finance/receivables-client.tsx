'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils';
import type {
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';

interface ReceivablesQueryParams {
  page: number;
  limit: number;
  search: string;
  status?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ReceivablesClientProps {
  initialData: ReceivablesResult;
  initialParams?: ReceivablesQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 应收账款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function ReceivablesClient({
  initialData,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onPageChange: externalOnPageChange,
}: ReceivablesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [queryParams, setQueryParams] = React.useState<ReceivablesQueryParams>(
    initialParams || {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(
        searchParams.get('limit') || `${paginationConfig.defaultPageSize}`,
        10
      ),
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || undefined,
      sortBy: searchParams.get('sortBy') || 'orderDate',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    }
  );

  // 获取应收账款数据
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.receivablesList(queryParams),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', queryParams.page.toString());
      params.set('limit', queryParams.limit.toString());
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      unpaid: { label: '未收款', variant: 'destructive' as const },
      partial: { label: '部分收款', variant: 'secondary' as const },
      paid: { label: '已收款', variant: 'default' as const },
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

  const handleSearch = React.useCallback(
    (value: string) => {
      if (externalOnSearch) {
        externalOnSearch(value);
      } else {
        setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
      }
    },
    [externalOnSearch]
  );

  // 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (externalOnFilter) {
        externalOnFilter(key, value);
      } else {
        if (key === 'status') {
          setQueryParams(prev => ({
            ...prev,
            status: value === 'all' || !value ? undefined : value,
            page: 1,
          }));
        } else if (key === 'sortBy') {
          setQueryParams(prev => ({
            ...prev,
            sortBy: value || 'orderDate',
            page: 1,
          }));
        } else if (key === 'sortOrder') {
          setQueryParams(prev => ({
            ...prev,
            sortOrder: (value as 'asc' | 'desc') || 'desc',
            page: 1,
          }));
        }
      }
    },
    [externalOnFilter]
  );

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      if (externalOnPageChange) {
        externalOnPageChange(newPage);
      } else {
        setQueryParams(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [externalOnPageChange]
  );

  const currentData = data?.data || initialData;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(currentData.summary?.totalReceivable || 0)}
            </div>
            <p className="text-muted-foreground text-xs">
              {currentData.summary?.receivableCount || 0} 个应收订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">收款率</CardTitle>
            <Calendar className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {(currentData.summary?.collectionRate || 0).toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-xs">较上月提升 5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均账期</CardTitle>
            <Calendar className="h-4 w-4 text-[hsl(var(--color-purple))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-purple))]">
              {currentData.summary?.averageAccountPeriod || 0}天
            </div>
            <p className="text-muted-foreground text-xs">较上月减少 3天</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <UnifiedSearchBar
            // 搜索配置
            searchValue={queryParams.search}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索订单号或客户名称..."
            debounceDelay={400}
            // 筛选器配置
            filters={[
              {
                key: 'status',
                label: '状态',
                options: [
                  { label: '未收款', value: 'unpaid' },
                  { label: '部分收款', value: 'partial' },
                  { label: '已收款', value: 'paid' },
                ],
                width: 'w-[140px]',
              },
              {
                key: 'sortBy',
                label: '排序字段',
                options: [
                  { label: '订单日期', value: 'orderDate' },
                  { label: '订单金额', value: 'totalAmount' },
                  { label: '客户名称', value: 'customerName' },
                  { label: '创建时间', value: 'createdAt' },
                ],
                width: 'w-[140px]',
              },
              {
                key: 'sortOrder',
                label: '排序方向',
                options: [
                  { label: '降序', value: 'desc' },
                  { label: '升序', value: 'asc' },
                ],
                width: 'w-[100px]',
              },
            ]}
            filterValues={{
              status: queryParams.status || 'all',
              sortBy: queryParams.sortBy,
              sortOrder: queryParams.sortOrder,
            }}
            onFilterChange={handleFilterChange}
          />

          {/* 应收账款列表 */}
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-[hsl(var(--color-error))]">
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
                  className="overflow-hidden transition-shadow hover:shadow-[var(--shadow-medium)]"
                >
                  <CardContent className="p-0">
                    {/* 顶部信息栏 - 订单号、客户、状态 */}
                    <div className="flex items-center justify-between border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-r from-[hsl(var(--color-bg-tertiary))] to-[hsl(var(--color-bg-secondary))] px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-[hsl(var(--color-text-primary))]">
                            {receivable.orderNumber}
                          </h3>
                          {getStatusBadge(receivable.paymentStatus)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                            客户:
                          </span>
                          <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                            {receivable.customerName}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                            className="shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
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
                    </div>

                    {/* 金额信息区域 - 更突出的视觉展示 */}
                    <div className="grid grid-cols-3 divide-x divide-[hsl(var(--color-border-secondary))] px-6 py-5">
                      <div className="flex flex-col items-center justify-center">
                        <span className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          订单金额
                        </span>
                        <span className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
                          {formatCurrency(receivable.totalAmount)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          已收金额
                        </span>
                        <span className="text-xl font-bold text-[hsl(var(--color-success))]">
                          {formatCurrency(receivable.paidAmount)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          待收金额
                        </span>
                        <span className="text-xl font-bold text-[hsl(var(--color-warning))]">
                          {formatCurrency(receivable.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    {/* 日期信息栏 */}
                    <div className="flex items-center gap-6 border-t border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] px-6 py-3 text-xs text-[hsl(var(--color-text-tertiary))]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>订单日期: {receivable.orderDate}</span>
                      </div>
                      {receivable.lastPaymentDate && (
                        <>
                          <span className="text-[hsl(var(--color-border-primary))]">
                            •
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>最后收款: {receivable.lastPaymentDate}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* 分页 */}
          {currentData.pagination && (
            <Pagination
              pagination={currentData.pagination}
              onPageChange={handlePageChange}
              showTotal
              disabled={isLoading}
              containerClassName="mt-6"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
