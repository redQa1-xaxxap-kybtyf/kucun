'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import * as React from 'react';
import { Suspense } from 'react';

import { ErrorBoundaryFallback } from '@/components/common/error-boundary-fallback';
import { InventoryPageOverviewHeader } from '@/components/inventory/inventory-page-overview-header';
import {
  InventoryListSkeleton,
  StatsCardsSkeleton,
} from '@/components/ui/skeleton-compositions';
import { useToast } from '@/components/ui/use-toast';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { useInventoryStatistics } from '@/hooks/use-inventory-statistics';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { can } from '@/lib/auth/permissions';
import { paginationConfig } from '@/lib/config/pagination';
import { queryKeys } from '@/lib/queryKeys';
import { inventoryParamsConfig } from '@/lib/schemas/inventory-params-config';
import { ExportService } from '@/lib/services/export-service';
import type { CategoryOption } from '@/lib/types/category';
import type {
  Inventory,
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';
import {
  buildInventoryExportFilename,
  buildInventoryExportRows,
  INVENTORY_EXPORT_PAGE_SIZE,
} from '@/lib/utils/inventory-export';

const InventoryStatisticsCards = dynamic(
  () =>
    import('@/components/inventory/inventory-statistics-cards').then(
      mod => mod.InventoryStatisticsCards
    ),
  { ssr: false, loading: () => <StatsCardsSkeleton count={4} /> }
);

const ERPInventoryList = dynamic(
  () =>
    import('@/components/inventory/erp-inventory-list').then(
      mod => mod.ERPInventoryList
    ),
  { ssr: false, loading: () => <InventoryListSkeleton /> }
);

interface InventoryPageClientProps {
  initialParams: Partial<InventoryQueryParams>;
  categoryOptions: CategoryOption[];
}

interface InventoryApiResponse {
  success?: boolean;
  data?: InventoryListResponse['data'];
}

async function fetchInventoryExportData(
  queryParams: InventoryQueryParams
): Promise<Inventory[]> {
  const inventories: Inventory[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const searchParams = new URLSearchParams();
    const requestParams: InventoryQueryParams = {
      ...queryParams,
      page: currentPage,
      limit: INVENTORY_EXPORT_PAGE_SIZE,
    };

    Object.entries(requestParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`/api/inventory?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(
        `库存导出查询失败: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as InventoryApiResponse;
    if (!payload.success || !payload.data) {
      throw new Error('库存导出查询返回格式不正确');
    }

    const pageRows = Array.isArray(payload.data.inventories)
      ? payload.data.inventories
      : [];

    inventories.push(...pageRows);
    totalPages = payload.data.pagination?.totalPages ?? 1;
    currentPage += 1;
  } while (currentPage <= totalPages);

  return inventories;
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
  const { data: session } = useSession();
  const { toast } = useToast();
  const [density, setDensity] = React.useState<'compact' | 'comfortable'>(
    'comfortable'
  );
  const [isExporting, setIsExporting] = React.useState(false);

  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  const handleExport = React.useCallback(() => {
    if (isExporting) {
      return;
    }

    void (async () => {
      setIsExporting(true);

      try {
        const inventories = await fetchInventoryExportData(
          ctrl.currentQueryParams
        );
        const categoryPathById = new Map(
          categoryOptions.map(category => [
            category.id,
            category.fullPath ?? category.name,
          ])
        );

        if (inventories.length === 0) {
          toast({
            variant: 'destructive',
            title: '导出失败',
            description: '当前筛选条件下没有可导出的库存数据',
          });
          return;
        }

        await ExportService.exportToExcel(
          buildInventoryExportRows(inventories, {
            includeFinance: hasFinancePermission,
            categoryPathById,
          }),
          {
            filename: buildInventoryExportFilename(),
            sheetName: '库存总览',
            includeHeaders: true,
          }
        );

        toast({
          title: '导出成功',
          description: `已导出 ${inventories.length} 条库存批次记录`,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '导出失败',
          description: error instanceof Error ? error.message : '库存导出失败',
        });
      } finally {
        setIsExporting(false);
      }
    })();
  }, [
    categoryOptions,
    ctrl.currentQueryParams,
    hasFinancePermission,
    isExporting,
    toast,
  ]);

  return (
    <InventoryContent
      categoryOptions={categoryOptions}
      listData={ctrl.listData}
      currentQueryParams={ctrl.currentQueryParams}
      searchValue={ctrl.searchInput}
      onSearch={ctrl.handleSearch}
      onFilter={ctrl.handleFilter}
      onFilterPatch={ctrl.handleFilterPatch}
      onClearFilters={ctrl.handleClearFilters}
      onPageChange={ctrl.handlePageChange}
      onNextPageHover={ctrl.handleNextPageHover}
      onPrevPageHover={ctrl.handlePrevPageHover}
      isLoading={ctrl.isLoading}
      isFetching={ctrl.isFetching}
      isSearching={ctrl.isSearching} // ✅ 传递搜索状态
      isExporting={isExporting}
      error={ctrl.error}
      density={density}
      onDensityChange={setDensity}
      onExport={handleExport}
    />
  );
}

function useInventoryController(initialParams: Partial<InventoryQueryParams>) {
  const { params, updateParams } = useUrlSearchParams(inventoryParamsConfig, {
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
  const {
    handleFilter,
    handleFilterPatch,
    handleClearFilters,
    handlePageChange,
  } = useInventoryFilters(updateParams, params.page ?? 1);

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
    handleFilterPatch,
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
  const handleFilterPatch = React.useCallback(
    (updates: Partial<InventoryQueryParams>) => {
      if (updates.lowStock) {
        updateParams({ page: 1, lowStock: true, hasStock: false, ...updates });
        return;
      }

      if (updates.hasStock) {
        updateParams({ page: 1, hasStock: true, lowStock: false, ...updates });
        return;
      }

      updateParams({ page: 1, ...updates });
    },
    [updateParams]
  );

  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      const patch = {
        [key]: value,
      } as unknown as Partial<InventoryQueryParams>;
      handleFilterPatch(patch);
    },
    [handleFilterPatch]
  );

  // ✅ Bug修复：清空筛选时也要清空搜索词
  const handleClearFilters = React.useCallback(() => {
    updateParams({
      search: undefined, // ✅ 新增：清空搜索词
      categoryId: undefined,
      lowStock: false,
      hasStock: false,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
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

  return {
    handleFilter,
    handleFilterPatch,
    handleClearFilters,
    handlePageChange,
  } as const;
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
  onFilterPatch: (updates: Partial<InventoryQueryParams>) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onNextPageHover: () => void;
  onPrevPageHover: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isSearching: boolean; // ✅ 新增：搜索中状态
  isExporting: boolean;
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
    onFilterPatch,
    onClearFilters,
    onPageChange,
    onNextPageHover,
    onPrevPageHover,
    isLoading,
    isFetching,
    isSearching,
    isExporting,
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
  const [showMobileStats, setShowMobileStats] = React.useState(false);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="flex flex-col gap-6">
        {/* 统一标题区域，所有端都在最上方 */}
        {/* 旗舰级头部区域 */}
        <div className="order-1">
          <InventoryPageOverviewHeader />
        </div>

        {/* 统计概览：PC 端紧跟标题，移动端排在列表之后 */}
        <div className="order-3 md:order-2">
          {/* PC 端：始终展示统计卡片 */}
          <div className="hidden md:block">
            <InventoryStatisticsCards
              statistics={statistics ?? null}
              isLoading={isLoadingStats}
            />
          </div>

          {/* 移动端：折叠展示统计概览，默认收起 */}
          <div className="space-y-2 md:hidden">
            <button
              type="button"
              onClick={() => setShowMobileStats(prev => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-primary-light))]">
                  <BarChart3 className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    库存统计概览
                  </span>
                  <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                    查看库存总金额、总数量等统计数据
                  </span>
                </div>
              </div>
              {showMobileStats ? (
                <ChevronDown className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
              )}
            </button>

            {showMobileStats && (
              <div>
                <InventoryStatisticsCards
                  statistics={statistics ?? null}
                  isLoading={isLoadingStats}
                />
              </div>
            )}
          </div>
        </div>

        {/* 搜索 + 列表：移动端在统计前，PC 端在统计后 */}
        <div className="order-2 md:order-3">
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
                onFilterPatch={onFilterPatch}
                onClearFilters={onClearFilters}
                onPageChange={onPageChange}
                onNextPageHover={onNextPageHover}
                onPrevPageHover={onPrevPageHover}
                isLoading={isLoading}
                isFetching={isFetching}
                isSearching={isSearching}
                isExporting={isExporting}
                density={density}
                onDensityChange={onDensityChange}
                onExport={onExport}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
