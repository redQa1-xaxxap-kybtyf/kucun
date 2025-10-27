'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ERPSalesOrderList } from '@/components/sales-orders/erp-sales-order-list';
import { SalesOrderPageHeader } from '@/components/sales-orders/sales-order-page-header';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { salesOrderParamsSchema } from '@/lib/schemas/sales-order-params';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';
import { logger } from '@/lib/utils/console-logger';

interface SalesOrdersPageClientProps {
  initialParams: SalesOrderQueryParams;
}

/**
 * 销售订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 重构：使用 useUrlSearchParams Hook 统一管理URL参数
 */
export function SalesOrdersPageClient({ initialParams }: SalesOrdersPageClientProps) {
  const ctrl = useSalesOrdersController(initialParams);
  return (
    <SalesOrdersContent
      params={ctrl.params}
      currentQueryParams={ctrl.currentQueryParams}
      onSearch={ctrl.handleSearch}
      onFilter={ctrl.handleFilter}
      onPageChange={ctrl.handlePageChange}
      onOrderSelect={ctrl.handleOrderSelect}
    />
  );
}

function useSalesOrdersController(initialParams: SalesOrderQueryParams) {
  const router = useRouter();
  const { params, updateParams, setParam } = useUrlSearchParams(
    salesOrderParamsSchema,
    {
      basePath: '/sales-orders',
      debounceMs: 300,
      shallow: true,
      initialParams,
    }
  );

  const handleSearch = React.useCallback(
    (value: string) => updateParams({ search: value, page: 1 }),
    [updateParams]
  );

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const updates: Partial<typeof params> = { page: 1 };
      if (key === 'status') {
        updates.status = value && value !== 'all' ? (value as SalesOrderQueryParams['status']) : undefined;
      } else if (key === 'customerId') {
        updates.customerId = value || '';
      } else if (key === 'sortBy') {
        updates.sortBy = (value as SalesOrderQueryParams['sortBy']) || 'createdAt';
      } else if (key === 'sortOrder') {
        updates.sortOrder = (value as 'asc' | 'desc') || 'desc';
      } else if (key === 'startDate') {
        updates.startDate = value;
      } else if (key === 'endDate') {
        updates.endDate = value;
      } else if (key === 'dateRange') {
        try {
          const { startDate, endDate } = JSON.parse(value || '{}');
          updates.startDate = startDate;
          updates.endDate = endDate;
        } catch (error) {
          logger.error('dashboard:sales-orders:page-client', '解析日期范围失败', error, { rawValue: value });
        }
      }
      updateParams(updates);
    },
    [updateParams]
  );

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      if (nextPage !== params.page) setParam('page', nextPage);
    },
    [setParam, params.page]
  );

  const currentQueryParams: SalesOrderQueryParams = React.useMemo(
    () => ({
      search: params.search,
      status: params.status,
      customerId: params.customerId,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      page: params.page,
      limit: params.limit,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    [
      params.search,
      params.status,
      params.customerId,
      params.sortBy,
      params.sortOrder,
      params.page,
      params.limit,
      params.startDate,
      params.endDate,
    ]
  );

  const handleOrderSelect = React.useCallback(
    (order: { id: string }) => router.push(`/sales-orders/${order.id}`),
    [router]
  );

  return { params, currentQueryParams, handleSearch, handleFilter, handlePageChange, handleOrderSelect } as const;
}

function SalesOrdersContent({
  params,
  currentQueryParams,
  onSearch,
  onFilter,
  onPageChange,
  onOrderSelect,
}: {
  params: { search: string; page: number } & Partial<SalesOrderQueryParams>;
  currentQueryParams: SalesOrderQueryParams;
  onSearch: (value: string) => void;
  onFilter: (key: string, value: string | undefined) => void;
  onPageChange: (page: number) => void;
  onOrderSelect: (order: { id: string }) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-6 flex-shrink-0">
        <SalesOrderPageHeader />
      </div>
      <div className="flex-1">
        <ERPSalesOrderList
          initialParams={currentQueryParams}
          searchValue={params.search}
          onSearch={onSearch}
          onFilter={onFilter}
          onPageChange={onPageChange}
          onOrderSelect={onOrderSelect}
        />
      </div>
    </div>
  );
}
