'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Suspense } from 'react';

import { ErrorBoundaryFallback } from '@/components/common/error-boundary-fallback';
import { PageHeader } from '@/components/common/page-header';
import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { InventoryListSkeleton } from '@/components/inventory/inventory-list-skeleton';
import { InventoryStatisticsCards } from '@/components/inventory/inventory-statistics-cards';
import { Button } from '@/components/ui/button';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { useInventoryStatistics } from '@/hooks/use-inventory-statistics';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { inventoryParamsSchema } from '@/lib/schemas/inventory-params';
import type { CategoryOption } from '@/lib/types/category';
import type {
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';

interface InventoryPageClientProps {
  initialParams: Partial<InventoryQueryParams>;
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
  const [density, setDensity] = React.useState<'compact' | 'comfortable'>(
    'comfortable'
  );

  const handleExport = React.useCallback(() => {
    // TODO: Implement export logic
    console.log('Exporting...');
  }, []);

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
      isFetching={ctrl.isFetching}
      isSearching={ctrl.isSearching} // ✅ 传递搜索状态
      error={ctrl.error}
      density={density}
      onDensityChange={setDensity}
      onExport={handleExport}
    />
  );
}

function useInventoryController(initialParams: Partial<InventoryQueryParams>) {
  const { params, updateParams } = useUrlSearchParams(inventoryParamsSchema, {
    basePath: '/inventory',
    debounceMs: 0, // ✅ 禁用这里的防抖,使用自定义防抖
    shallow: true,
    initialParams,
  });

  // ✅ 本地搜索输入状态,用于即时UI反馈
  const [searchInput, setSearchInput] = React.useState(params.search || '');
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // ✅ 同步URL参数到本地输入框(浏览器前进/后退、清空筛选等)
  React.useEffect(() => {
    setSearchInput(params.search || '');
  }, [params.search]);

  const {
    isLoading,
    isFetching,
    error,
    listData,
    handleNextPageHover,
    handlePrevPageHover,
  } = useInventoryData(params, !!params.search); // ✅ 搜索模式：当有搜索词时启用

  // ✅ 优化搜索状态管理:使用useTransition的isPending状态
  const shouldShowSearchingIndicator = React.useMemo(
    () => isPending || isFetching,
    [isPending, isFetching]
  );
  const { handleFilter, handleClearFilters, handlePageChange } =
    useInventoryFilters(updateParams, params.page);

  // ✅ 优化：简化防抖逻辑，固定300ms延迟
  // 移除复杂的自适应算法，提升性能和可维护性
  const SEARCH_DEBOUNCE_DELAY = 300; // 固定防抖延迟

  const handleSearch = React.useCallback(
    (value: string) => {
      const trimmed = value.trimStart();

      // 1. 立即更新输入框显示（0ms延迟）
      setSearchInput(trimmed);

      // 2. 清除之前的定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      // 3. 处理清空搜索
      if (trimmed === '') {
        // 使用 startTransition 包裹状态更新，避免阻塞UI
        startTransition(() => {
          updateParams({ search: undefined, page: 1 });
        });
        return;
      }

      // 4. 使用固定延迟更新URL和触发查询
      searchTimerRef.current = setTimeout(() => {
        // 使用 startTransition 包裹状态更新，避免阻塞UI
        startTransition(() => {
          updateParams({ search: trimmed, page: 1 });
        });
      }, SEARCH_DEBOUNCE_DELAY);
    },
    [updateParams, startTransition]
  );

  // 清理定时器
  React.useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    },
    []
  );

  // ✅ 优化 useMemo 依赖：使用原始值而非对象引用
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
    searchInput, // ✅ 使用本地searchInput,即时UI反馈
    isSearching: shouldShowSearchingIndicator, // ✅ 优化后的搜索状态指示
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

function useInventoryData(params: InventoryQueryParams, searchMode = false) {
  const {
    data,
    isLoading,
    isFetching,
    error,
    prefetchNextPage,
    prefetchPrevPage,
  } = useOptimizedInventoryQuery({ params, searchMode });

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

  // ✅ Bug修复：清空筛选时也要清空搜索词
  const handleClearFilters = React.useCallback(() => {
    updateParams({
      search: undefined, // ✅ 新增：清空搜索词
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
  isSearching: boolean; // ✅ 新增：搜索中状态
  error: unknown;
  density: 'compact' | 'comfortable';
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onExport: () => void;
}) {
  const queryClient = useQueryClient();
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
    isSearching,
    error,
    density,
    onDensityChange,
    onExport,
  } = props;
  // 获取库存统计数据
  const { data: statistics, isLoading: isLoadingStats } =
    useInventoryStatistics({
      categoryId: currentQueryParams.categoryId,
    });

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <PageHeader
          title="库存管理"
          description="实时监控库存水平和库存变动"
          icon={<Package className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
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

        {/* 库存统计卡片 */}
        <InventoryStatisticsCards
          statistics={statistics ?? null}
          isLoading={isLoadingStats}
        />

        <Suspense fallback={<InventoryListSkeleton />}>
          {error ? (
            <ErrorBoundaryFallback
              error={error}
              onRetry={() => {
                queryClient.refetchQueries({
                  queryKey: queryKeys.inventory.lists(),
                });
              }}
              onClearFilters={onClearFilters}
            />
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
              isSearching={isSearching}
              density={density}
              onDensityChange={onDensityChange}
              onExport={onExport}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
