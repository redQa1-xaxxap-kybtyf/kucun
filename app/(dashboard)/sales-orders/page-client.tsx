'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { ERPSalesOrderList } from '@/components/sales-orders/erp-sales-order-list';
import { SalesOrderPageHeader } from '@/components/sales-orders/sales-order-page-header';
import type { PaginatedResponse } from '@/lib/types/api';
import type {
  SalesOrder,
  SalesOrderQueryParams,
} from '@/lib/types/sales-order';

interface SalesOrdersPageClientProps {
  initialData: PaginatedResponse<SalesOrder>;
  initialParams: SalesOrderQueryParams;
}

/**
 * 销售订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function SalesOrdersPageClient({
  initialData,
  initialParams,
}: SalesOrdersPageClientProps) {
  const router = useRouter();
  const [_isPending, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [customerId, setCustomerId] = React.useState(
    initialParams.customerId || ''
  );
  const [sortBy, setSortBy] = React.useState<SalesOrderQueryParams['sortBy']>(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: SalesOrderQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.customerId) {
          params.set('customerId', filters.customerId);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/sales-orders?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        status,
        customerId,
        sortBy,
        sortOrder,
        page: 1,
      });
    },
    [debouncedUpdateURL, initialParams, status, customerId, sortBy, sortOrder]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const newFilters = { ...initialParams, [key]: value, page: 1 };

      // 更新本地状态
      if (key === 'status') {
        setStatus(value as SalesOrderQueryParams['status']);
      } else if (key === 'customerId') {
        setCustomerId(value || '');
      } else if (key === 'sortBy') {
        setSortBy(value as SalesOrderQueryParams['sortBy']);
      } else if (key === 'sortOrder') {
        setSortOrder(value as 'asc' | 'desc');
      }

      // 立即更新URL（筛选不需要防抖）
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (newFilters.status) {
          params.set('status', newFilters.status);
        }
        if (newFilters.customerId) {
          params.set('customerId', newFilters.customerId);
        }
        if (newFilters.sortBy) {
          params.set('sortBy', newFilters.sortBy);
        }
        if (newFilters.sortOrder) {
          params.set('sortOrder', newFilters.sortOrder);
        }
        if (newFilters.limit) {
          params.set('limit', newFilters.limit.toString());
        }

        router.push(`/sales-orders?${params.toString()}`);
      });
    },
    [router, search, initialParams]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
        }
        if (customerId) {
          params.set('customerId', customerId);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/sales-orders?${params.toString()}`);
      });
    },
    [router, search, status, customerId, sortBy, sortOrder, initialParams.limit]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        <SalesOrderPageHeader />
        <ERPSalesOrderList
          _initialData={initialData}
          initialParams={initialParams}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
