'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, PackageX, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ReturnOrderListView } from '@/components/return-orders/return-order-list-view';
import { Button } from '@/components/ui/button';
import { getReturnOrders } from '@/lib/api/return-orders';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ReturnOrder,
  ReturnOrderQueryParams,
  ReturnOrderStatus,
  ReturnOrderType,
} from '@/lib/types/return-order';

interface ReturnOrdersPageClientProps {
  initialParams: ReturnOrderQueryParams;
}

/**
 * 退货订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function ReturnOrdersPageClient({
  initialParams,
}: ReturnOrdersPageClientProps) {
  const router = useRouter();

  // 构建查询参数
  const queryParams: ReturnOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || paginationConfig.defaultPageSize,
    search: initialParams?.search,
    status: initialParams?.status,
    type: initialParams?.type,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    startDate: initialParams?.startDate,
    endDate: initialParams?.endDate,
  };

  // 获取退货订单数据
  const {
    data: queryData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.returnOrders.list(queryParams),
    queryFn: () => getReturnOrders(queryParams),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
  });

  const orders = queryData?.data.returnOrders || [];
  const pagination = queryData?.data.pagination;
  const paginationInfo = pagination
    ? {
        page: pagination.page,
        limit: pagination.limit,
        totalCount: pagination.total,
        totalPages: pagination.totalPages,
      }
    : undefined;

  // 处理操作回调

  const handleDeleteRequest = React.useCallback((_order: ReturnOrder) => {
    // 删除操作逻辑已集成到 ReturnOrderListView 中
  }, []);

  const handleRetry = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // 导航相关处理
  const handleSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.push(`/return-orders?${params.toString()}`);
    },
    [router]
  );

  const handleStatusChange = React.useCallback(
    (value: ReturnOrderStatus | 'all') => {
      const params = new URLSearchParams(window.location.search);
      if (value && value !== 'all') {
        params.set('status', value);
      } else {
        params.delete('status');
      }
      params.delete('page');
      router.push(`/return-orders?${params.toString()}`);
    },
    [router]
  );

  const handleTypeChange = React.useCallback(
    (value: ReturnOrderType | 'all') => {
      const params = new URLSearchParams(window.location.search);
      if (value && value !== 'all') {
        params.set('type', value);
      } else {
        params.delete('type');
      }
      params.delete('page');
      router.push(`/return-orders?${params.toString()}`);
    },
    [router]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      const params = new URLSearchParams(window.location.search);
      if (range.startDate) {
        params.set('startDate', range.startDate);
      } else {
        params.delete('startDate');
      }
      if (range.endDate) {
        params.set('endDate', range.endDate);
      } else {
        params.delete('endDate');
      }
      params.delete('page');
      router.push(`/return-orders?${params.toString()}`);
    },
    [router]
  );

  const handleClearFilters = React.useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('status');
    params.delete('type');
    params.delete('startDate');
    params.delete('endDate');
    params.delete('page');
    router.push(`/return-orders?${params.toString()}`);
  }, [router]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      const params = new URLSearchParams(window.location.search);
      if (page > 1) {
        params.set('page', page.toString());
      } else {
        params.delete('page');
      }
      router.push(`/return-orders?${params.toString()}`);
    },
    [router]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="退货订单管理"
          description="管理客户退货订单，跟踪退货处理状态和退款情况"
          icon={<PackageX className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-error))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/return-orders/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/return-orders/create">
                  <Plus className="mr-2 h-4 w-4" />
                  新建退货单
                </Link>
              </Button>
            </>
          }
        />

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <ReturnOrderListView
            searchValue={initialParams?.search || ''}
            statusFilter={initialParams?.status || 'all'}
            typeFilter={initialParams?.type || 'all'}
            dateRange={{
              startDate: initialParams?.startDate,
              endDate: initialParams?.endDate,
            }}
            isSearching={isLoading}
            onSearch={handleSearch}
            onStatusChange={handleStatusChange}
            onTypeChange={handleTypeChange}
            onDateRangeChange={handleDateRangeChange}
            onClearFilters={handleClearFilters}
            orders={orders}
            isLoading={isLoading}
            error={error}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onDeleteRequest={handleDeleteRequest}
            onRetry={handleRetry}
          />
        </Suspense>
      </div>
    </div>
  );
}
