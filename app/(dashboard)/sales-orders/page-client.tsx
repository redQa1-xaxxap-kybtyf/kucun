'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SalesOrderPageHeader } from '@/components/sales-orders/sales-order-page-header';
import { SalesOrdersSkeleton } from '@/components/ui/skeleton-compositions';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import { salesOrderParamsConfig } from '@/lib/schemas/sales-order-params-config';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';
import { logger } from '@/lib/utils/console-logger';
import {
  getCurrentPathWithSearch,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

const ERPSalesOrderList = dynamic(
  () =>
    import('@/components/sales-orders/erp-sales-order-list').then(
      mod => mod.ERPSalesOrderList
    ),
  {
    ssr: false,
    loading: () => <SalesOrdersSkeleton />,
  }
);

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
export function SalesOrdersPageClient({
  initialParams,
}: SalesOrdersPageClientProps) {
  const {
    searchInput,
    isSearching,
    currentQueryParams,
    handleSearch,
    handleFilter,
    handlePageChange,
    handleOrderSelect,
    handleClearFilters,
    handleRecordScopeChange,
  } = useSalesOrdersController(initialParams);
  return (
    <SalesOrdersContent
      searchInput={searchInput}
      isSearching={isSearching}
      currentQueryParams={currentQueryParams}
      onSearch={handleSearch}
      onFilter={handleFilter}
      onPageChange={handlePageChange}
      onOrderSelect={handleOrderSelect}
      onClearFilters={handleClearFilters}
      onRecordScopeChange={handleRecordScopeChange}
    />
  );
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function buildFilterUpdates(
  key: string,
  value: string | undefined
): Partial<SalesOrderQueryParams> {
  const base: Partial<SalesOrderQueryParams> = { page: 1 };

  switch (key) {
    case 'status':
      return {
        ...base,
        status:
          value && value !== 'all'
            ? (value as SalesOrderQueryParams['status'])
            : undefined,
      };
    case 'customerId':
      return { ...base, customerId: value ?? '' };
    case 'sortBy':
      return {
        ...base,
        sortBy: (value as SalesOrderQueryParams['sortBy']) || 'orderDate',
      };
    case 'sortOrder':
      return {
        ...base,
        sortOrder: (value as 'asc' | 'desc') || 'desc',
      };
    case 'startDate':
    case 'endDate':
      return { ...base, [key]: value } as Partial<SalesOrderQueryParams>;
    case 'dateRange':
      if (!value) {
        return { ...base, startDate: undefined, endDate: undefined };
      }
      try {
        const { startDate, endDate } = JSON.parse(value) as {
          startDate?: string;
          endDate?: string;
        };
        return { ...base, startDate, endDate };
      } catch (error) {
        logger.error(
          'dashboard:sales-orders:page-client',
          '解析日期范围失败',
          error,
          { rawValue: value }
        );
        return base;
      }
    case 'orderType':
      return {
        ...base,
        orderType: value as SalesOrderQueryParams['orderType'],
      };
    case 'isSampleOrder':
      return {
        ...base,
        isSampleOrder: value === 'true' ? true : undefined,
      };
    case 'hasReturns':
      return { ...base, hasReturns: value === 'true' ? true : undefined };
    case 'recordScope':
      return {
        ...base,
        recordScope: value === 'history' ? 'history' : undefined,
        includeTest: undefined,
      };
    case 'includeTest':
      return { ...base, includeTest: value === 'true' ? true : undefined };
    case 'includeVoided':
      return { ...base, includeVoided: value === 'true' ? true : undefined };
    default:
      return base;
  }
}

function useSalesOrdersController(initialParams: SalesOrderQueryParams) {
  const router = useRouter();
  const { params, updateParams } = useUrlSearchParams(
    salesOrderParamsConfig,
    {
      basePath: '/sales-orders',
      debounceMs: 0, // ✅ 禁用这里的防抖,使用自定义防抖
      shallow: true,
      initialParams,
    }
  );

  const {
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: params.search,
    onCommit: search => {
      updateParams({ search: search ?? '', page: 1 });
    },
  });

  const getPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    return normalizeSearch(searchInput);
  }, [cancelPendingCommit, searchInput]);

  const handleSearch = React.useCallback(
    (value: string) => {
      handleSearchChange(value);
    },
    [handleSearchChange]
  );

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = getPendingSearch();
      updateParams({
        ...buildFilterUpdates(key, value),
        search: nextSearch ?? '',
      });
    },
    [getPendingSearch, updateParams]
  );

  const handleRecordScopeChange = React.useCallback(
    (recordScope: SalesOrderQueryParams['recordScope']) => {
      const nextSearch = getPendingSearch();
      updateParams({
        ...buildFilterUpdates('recordScope', recordScope),
        search: nextSearch ?? '',
      });
    },
    [getPendingSearch, updateParams]
  );

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      if (nextPage === params.page) {
        return;
      }

      const nextSearch = getPendingSearch();
      updateParams({
        search: nextSearch ?? '',
        page: nextPage,
      });
    },
    [getPendingSearch, params.page, updateParams]
  );

  const currentQueryParams: SalesOrderQueryParams = React.useMemo(
    () => ({ ...params }),
    [params]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    updateParams({
      search: '',
      status: undefined,
      customerId: '',
      startDate: undefined,
      endDate: undefined,
      orderType: undefined,
      isSampleOrder: undefined,
      hasReturns: undefined,
      recordScope: params.recordScope,
      includeTest: undefined,
      includeVoided: undefined,
      page: 1,
    });
  }, [cancelPendingCommit, params.recordScope, setSearchInput, updateParams]);

  const handleOrderSelect = React.useCallback(
    (order: { id: string }) => {
      router.push(
        withReturnTo(
          `/sales-orders/${order.id}`,
          getCurrentPathWithSearch() ?? '/sales-orders'
        )
      );
    },
    [router]
  );

  return {
    searchInput, // ✅ 使用本地searchInput,即时UI反馈
    isSearching, // ✅ 使用本地isSearching状态
    currentQueryParams,
    handleSearch,
    handleFilter,
    handlePageChange,
    handleOrderSelect,
    handleClearFilters,
    handleRecordScopeChange,
  } as const;
}

function SalesOrdersContent({
  searchInput,
  isSearching,
  currentQueryParams,
  onSearch,
  onFilter,
  onPageChange,
  onOrderSelect,
  onClearFilters,
  onRecordScopeChange,
}: {
  searchInput: string;
  isSearching: boolean;
  currentQueryParams: SalesOrderQueryParams;
  onSearch: (value: string) => void;
  onFilter: (key: string, value: string | undefined) => void;
  onPageChange: (page: number) => void;
  onOrderSelect: (order: { id: string }) => void;
  onClearFilters: () => void;
  onRecordScopeChange: (
    recordScope: SalesOrderQueryParams['recordScope']
  ) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex-shrink-0 sm:mb-6">
        <SalesOrderPageHeader
          recordScope={currentQueryParams.recordScope}
          onRecordScopeChange={onRecordScopeChange}
        />
      </div>
      <div className="flex-1">
        <ERPSalesOrderList
          initialParams={currentQueryParams}
          searchValue={searchInput}
          isSearching={isSearching}
          onSearch={onSearch}
          onFilter={onFilter}
          onPageChange={onPageChange}
          onOrderSelect={onOrderSelect}
          onClearFilters={onClearFilters}
        />
      </div>
    </div>
  );
}
