'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { InventoryListSkeleton } from '@/components/inventory/inventory-list-skeleton';
import { Button } from '@/components/ui/button';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { paginationConfig } from '@/lib/env';
import { inventoryParamsSchema } from '@/lib/schemas/inventory-params';
import type { CategoryOption } from '@/lib/types/category';
import type {
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';

interface InventoryPageClientProps {
  initialParams: InventoryQueryParams;
  categoryOptions: CategoryOption[];
}

/**
 * 库存管理页面客户端组件
 *
 * ✅ 重构：使用 useUrlSearchParams Hook 统一管理URL参数
 * ✅ Next.js 15.4 + React 19 最佳实践：
 * 1. Suspense Boundary - 支持 Streaming SSR
 * 2. useTransition - 非阻塞状态更新
 * 3. HydrationBoundary - 避免重复请求
 * 4. 业务逻辑提取到自定义 Hook
 */
export function InventoryPageClient({
  initialParams,
  categoryOptions,
}: InventoryPageClientProps) {
  const ctrl = useInventoryController(initialParams);

  return (
    <InventoryContent
      categoryOptions={categoryOptions}
      listData={ctrl.listData}
      currentQueryParams={ctrl.currentQueryParams}
      searchValue={ctrl.searchInput}
      onSearch={ctrl.handleSearch}
      onFilter={ctrl.handleFilter}
      onClearFilters={ctrl.handleClearFilters}
      onPageChange={ctrl.handlePageChange}
      onNextPageHover={ctrl.handleNextPageHover}
      onPrevPageHover={ctrl.handlePrevPageHover}
      isLoading={ctrl.isLoading}
      isFetching={ctrl.isFetching || ctrl.isSearching}
      error={ctrl.error}
    />
  );
}

function useInventoryController(initialParams: InventoryQueryParams) {
  const { params, updateParams } = useUrlSearchParams(inventoryParamsSchema, {
    basePath: '/inventory',
    debounceMs: 0,
    shallow: true,
    initialParams,
  });

  const { searchInput, isSearching, handleSearch } = useInventorySearch(
    params.search || '',
    updateParams
  );
  const {
    data,
    isLoading,
    isFetching,
    error,
    listData,
    handleNextPageHover,
    handlePrevPageHover,
  } = useInventoryData(params);
  const { handleFilter, handleClearFilters, handlePageChange } =
    useInventoryFilters(updateParams, params.page);

  const currentQueryParams: InventoryQueryParams = React.useMemo(
    () => ({
      search: params.search,
      categoryId: params.categoryId,
      lowStock: params.lowStock,
      hasStock: params.hasStock,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      startDate: params.startDate,
      endDate: params.endDate,
      page: params.page,
      limit: params.limit,
    }),
    [
      params.search,
      params.categoryId,
      params.lowStock,
      params.hasStock,
      params.sortBy,
      params.sortOrder,
      params.startDate,
      params.endDate,
      params.page,
      params.limit,
    ]
  );

  return {
    params,
    searchInput,
    isSearching,
    data,
    isLoading,
    isFetching,
    error,
    listData,
    currentQueryParams,
    handleSearch,
    handleFilter,
    handleClearFilters,
    handlePageChange,
    handleNextPageHover,
    handlePrevPageHover,
  } as const;
}

function useInventorySearch(
  paramsSearch: string,
  updateParams: (updates: Partial<InventoryQueryParams>) => void
) {
  const [searchInput, setSearchInput] = React.useState(paramsSearch);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    []
  );

  React.useEffect(() => {
    // ✅ 修复BUG: 只在URL参数变化时同步本地状态,不在本地输入时触发
    // 之前的问题: 单字符输入时,因为不创建定时器,useEffect会把输入重置为空
    // 现在: 只有当paramsSearch变化且与当前输入不同时才更新
    if ((paramsSearch || '') !== (searchInput || '')) {
      setSearchInput(paramsSearch || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only listen to paramsSearch, not searchInput, to prevent input reset bug
  }, [paramsSearch]); // ✅ 只监听paramsSearch,不监听searchInput

  const handleSearch = React.useCallback(
    (raw: string) => {
      const value = raw.trimStart();
      setSearchInput(value);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        setIsSearching(false);
      }
      if (value === '') {
        setIsSearching(false);
        updateParams({ search: '', page: 1 });
        return;
      }
      if (value.length < 2) {
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchTimerRef.current = setTimeout(() => {
        updateParams({ search: value, page: 1 });
        setIsSearching(false);
      }, 180);
    },
    [updateParams]
  );

  return { searchInput, isSearching, handleSearch } as const;
}

function useInventoryData(params: InventoryQueryParams) {
  const {
    data,
    isLoading,
    isFetching,
    error,
    prefetchNextPage,
    prefetchPrevPage,
  } = useOptimizedInventoryQuery({ params });

  const normalizedData = React.useMemo<
    InventoryListResponse['data'] | undefined
  >(() => {
    const payload = data?.data;
    if (!payload) return undefined;
    if (
      typeof (payload as InventoryListResponse['data']).inventories !==
        'undefined' &&
      Array.isArray((payload as InventoryListResponse['data']).inventories)
    ) {
      return payload as InventoryListResponse['data'];
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, 'data') ||
      Object.prototype.hasOwnProperty.call(payload, 'pagination')
    ) {
      const legacy = payload as {
        data?: InventoryListResponse['data']['inventories'];
        pagination?: InventoryListResponse['data']['pagination'];
      };
      const resolvedLimit =
        params.limit && params.limit > 0
          ? params.limit
          : paginationConfig.defaultPageSize;
      const resolvedPage = params.page && params.page > 0 ? params.page : 1;
      const fallbackTotal = Array.isArray(legacy.data) ? legacy.data.length : 0;
      const fallbackTotalPages = Math.max(
        1,
        Math.ceil(fallbackTotal / resolvedLimit)
      );
      const normalizedPagination =
        legacy.pagination && legacy.pagination.totalPages >= 1
          ? legacy.pagination
          : {
              page: resolvedPage,
              limit: resolvedLimit,
              total: fallbackTotal,
              totalPages: fallbackTotalPages,
            };
      return {
        inventories: Array.isArray(legacy.data) ? legacy.data : [],
        pagination: normalizedPagination,
      };
    }
    return undefined;
  }, [data, params.limit, params.page]);

  const listData = React.useMemo(
    () => ({
      data: normalizedData?.inventories ?? [],
      pagination: normalizedData?.pagination,
    }),
    [normalizedData]
  );

  const handleNextPageHover = React.useCallback(
    () => prefetchNextPage(),
    [prefetchNextPage]
  );
  const handlePrevPageHover = React.useCallback(
    () => prefetchPrevPage(),
    [prefetchPrevPage]
  );

  return {
    data,
    isLoading,
    isFetching,
    error,
    listData,
    handleNextPageHover,
    handlePrevPageHover,
  } as const;
}

function useInventoryFilters(
  updateParams: (updates: Partial<InventoryQueryParams>) => void,
  currentPage: number
) {
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      if (key === 'lowStock' && value) {
        updateParams({ page: 1, lowStock: true, hasStock: false });
        return;
      }
      if (key === 'hasStock' && value) {
        updateParams({ page: 1, hasStock: true, lowStock: false });
        return;
      }
      const patch = {
        [key]: value,
      } as unknown as Partial<InventoryQueryParams>;
      updateParams({ page: 1, ...patch });
    },
    [updateParams]
  );

  const handleClearFilters = React.useCallback(() => {
    updateParams({
      categoryId: undefined,
      lowStock: false,
      hasStock: false,
      startDate: undefined,
      endDate: undefined,
      page: 1,
    });
  }, [updateParams]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      if (page === currentPage) return;
      updateParams({ page });
    },
    [updateParams, currentPage]
  );

  return { handleFilter, handleClearFilters, handlePageChange } as const;
}

function InventoryContent(props: {
  categoryOptions: CategoryOption[];
  listData: {
    data: InventoryListResponse['data']['inventories'];
    pagination?: InventoryListResponse['data']['pagination'];
  };
  currentQueryParams: InventoryQueryParams;
  searchValue: string;
  onSearch: (raw: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onNextPageHover: () => void;
  onPrevPageHover: () => void;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}) {
  const {
    categoryOptions,
    listData,
    currentQueryParams,
    searchValue,
    onSearch,
    onFilter,
    onClearFilters,
    onPageChange,
    onNextPageHover,
    onPrevPageHover,
    isLoading,
    isFetching,
    error,
  } = props;
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <PageHeader
          title="库存管理"
          description="实时监控库存水平和库存变动"
          icon={<Package className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-blue))"
          actions={
            <Button
              size="lg"
              asChild
              className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
            >
              <Link href="/inventory/adjust">
                <Plus className="mr-2 h-4 w-4" />
                库存调整
              </Link>
            </Button>
          }
        />
        <Suspense fallback={<InventoryListSkeleton />}>
          {error ? (
            <div className="rounded-lg border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] p-6 text-center shadow-sm">
              <p className="text-[hsl(var(--color-error))]">
                加载失败: {error instanceof Error ? error.message : '未知错误'}
              </p>
              <Button
                variant="destructive"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                重新加载
              </Button>
            </div>
          ) : (
            <ERPInventoryList
              data={listData}
              categoryOptions={categoryOptions}
              queryParams={currentQueryParams}
              searchValue={searchValue}
              onSearch={onSearch}
              onFilter={onFilter}
              onClearFilters={onClearFilters}
              onPageChange={onPageChange}
              onNextPageHover={onNextPageHover}
              onPrevPageHover={onPrevPageHover}
              isLoading={isLoading}
              isFetching={isFetching}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
