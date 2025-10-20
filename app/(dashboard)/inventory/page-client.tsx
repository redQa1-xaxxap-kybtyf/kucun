'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { InventoryListSkeleton } from '@/components/inventory/inventory-list-skeleton';
import { Button } from '@/components/ui/button';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { paginationConfig } from '@/lib/env';
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
  const router = useRouter();
  const replace = router.replace;

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [categoryId, setCategoryId] = React.useState(
    initialParams.categoryId || ''
  );
  const [lowStock, setLowStock] = React.useState(
    initialParams.lowStock || false
  );
  const [hasStock, setHasStock] = React.useState(
    initialParams.hasStock || false
  );
  const [sortBy, setSortBy] = React.useState<InventoryQueryParams['sortBy']>(
    initialParams.sortBy || 'updatedAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );
  const [limit, setLimit] = React.useState<number>(
    typeof initialParams.limit === 'number' &&
      Number.isFinite(initialParams.limit)
      ? initialParams.limit
      : 50
  );
  const searchRef = React.useRef(search);
  const limitRef = React.useRef(limit);

  React.useEffect(() => {
    setSearch(initialParams.search || '');
    setCategoryId(initialParams.categoryId || '');
    setLowStock(Boolean(initialParams.lowStock));
    setHasStock(Boolean(initialParams.hasStock));
    setSortBy(initialParams.sortBy || 'updatedAt');
    setSortOrder(initialParams.sortOrder === 'asc' ? 'asc' : 'desc');
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
    setLimit(current =>
      typeof initialParams.limit === 'number' &&
      Number.isFinite(initialParams.limit)
        ? initialParams.limit
        : current
    );
  }, [initialParams]);
  React.useEffect(() => {
    searchRef.current = search;
  }, [search]);
  React.useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  // ✅ 使用 ref 存储最新的筛选状态，避免闭包问题
  const filtersRef = React.useRef({
    categoryId,
    lowStock,
    hasStock,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  });

  // ✅ 每次状态变化时更新 ref
  React.useEffect(() => {
    filtersRef.current = {
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    };
  }, [categoryId, lowStock, hasStock, sortBy, sortOrder, startDate, endDate]);

  // ✅ 获取库存列表数据（从 HydrationBoundary 自动获取服务端预取的数据，无需重复请求）
  // ✅ 暴露预取方法供分页按钮使用
  const { data, isLoading, error, prefetchNextPage, prefetchPrevPage } =
    useOptimizedInventoryQuery({
      params: initialParams,
    });

  const normalizedData = React.useMemo<
    InventoryListResponse['data'] | undefined
  >(() => {
    const payload = data?.data;
    if (!payload) {
      return undefined;
    }

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
        typeof initialParams.limit === 'number' && initialParams.limit > 0
          ? initialParams.limit
          : limit > 0
            ? limit
            : paginationConfig.defaultPageSize;
      const resolvedPage =
        typeof initialParams.page === 'number' && initialParams.page > 0
          ? initialParams.page
          : 1;
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
  }, [data, initialParams.limit, initialParams.page, limit]);

  const inventories = normalizedData?.inventories ?? [];
  const pagination = normalizedData?.pagination;
  const listData = React.useMemo(
    () => ({
      data: inventories,
      pagination,
    }),
    [inventories, pagination]
  );

  // ✅ 防抖更新URL - 只在用户停止输入后才更新URL和触发数据请求
  const updateURL = React.useCallback(
    (searchValue: string) => {
      const filters = filtersRef.current;
      const params = new URLSearchParams();
      const trimmedSearch = searchValue.trim();

      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (filters.categoryId) {
        params.set('categoryId', filters.categoryId);
      }
      if (filters.lowStock) {
        params.set('lowStock', 'true');
      }
      if (filters.hasStock) {
        params.set('hasStock', 'true');
      }
      if (filters.sortBy) {
        params.set('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.set('sortOrder', filters.sortOrder);
      }
      if (filters.startDate) {
        params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.set('endDate', filters.endDate);
      }

      params.set('page', '1');

      const currentLimit = limitRef.current;
      if (Number.isFinite(currentLimit) && currentLimit > 0) {
        params.set('limit', currentLimit.toString());
      }

      replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    [replace]
  );

  const debouncedUpdateURL = useDebouncedCallback(updateURL, 500);
  const debouncedUpdateURLRef = React.useRef(debouncedUpdateURL);

  React.useEffect(() => {
    debouncedUpdateURLRef.current = debouncedUpdateURL;
  }, [debouncedUpdateURL]);

  // ✅ 搜索处理 - 立即更新本地状态（不触发重渲染），防抖更新URL
  const handleSearch = React.useCallback((value: string) => {
    setSearch(value);
    searchRef.current = value;
    debouncedUpdateURLRef.current(value);
  }, []);

  // 筛选处理
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      const nextFilters = { ...filtersRef.current };
      let nextLimit = limitRef.current;

      const stringValue = typeof value === 'string' ? value.trim() : value;

      if (key === 'categoryId') {
        const categoryValue =
          typeof stringValue === 'string' ? stringValue : '';
        nextFilters.categoryId = categoryValue;
        setCategoryId(categoryValue);
      } else if (key === 'lowStock') {
        const lowStockValue = Boolean(stringValue);
        nextFilters.lowStock = lowStockValue;
        setLowStock(lowStockValue);
        if (lowStockValue) {
          nextFilters.hasStock = false;
          setHasStock(false);
        }
      } else if (key === 'hasStock') {
        const hasStockValue = Boolean(stringValue);
        nextFilters.hasStock = hasStockValue;
        setHasStock(hasStockValue);
        if (hasStockValue) {
          nextFilters.lowStock = false;
          setLowStock(false);
        }
      } else if (key === 'sortBy') {
        const sortByValue =
          (stringValue as InventoryQueryParams['sortBy']) || 'updatedAt';
        nextFilters.sortBy = sortByValue;
        setSortBy(sortByValue);
      } else if (key === 'sortOrder') {
        const sortOrderValue = stringValue === 'asc' ? 'asc' : 'desc';
        nextFilters.sortOrder = sortOrderValue;
        setSortOrder(sortOrderValue);
      } else if (key === 'startDate') {
        const dateValue =
          typeof stringValue === 'string' && stringValue.length > 0
            ? stringValue
            : undefined;
        nextFilters.startDate = dateValue;
        setStartDate(dateValue);
      } else if (key === 'endDate') {
        const dateValue =
          typeof stringValue === 'string' && stringValue.length > 0
            ? stringValue
            : undefined;
        nextFilters.endDate = dateValue;
        setEndDate(dateValue);
      } else if (key === 'limit') {
        const parsed = Number(stringValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          nextLimit = parsed;
        }
        setLimit(nextLimit);
      }

      const params = new URLSearchParams();

      const searchValue = searchRef.current.trim();
      if (searchValue) {
        params.set('search', searchValue);
      }
      if (nextFilters.categoryId) {
        params.set('categoryId', nextFilters.categoryId);
      }
      if (nextFilters.lowStock) {
        params.set('lowStock', 'true');
      }
      if (nextFilters.hasStock) {
        params.set('hasStock', 'true');
      }
      if (nextFilters.sortBy) {
        params.set('sortBy', nextFilters.sortBy);
      }
      if (nextFilters.sortOrder) {
        params.set('sortOrder', nextFilters.sortOrder);
      }
      if (nextFilters.startDate) {
        params.set('startDate', nextFilters.startDate);
      }
      if (nextFilters.endDate) {
        params.set('endDate', nextFilters.endDate);
      }

      params.set('page', '1');

      if (Number.isFinite(nextLimit) && nextLimit > 0) {
        params.set('limit', nextLimit.toString());
      }

      filtersRef.current = nextFilters;
      limitRef.current = nextLimit;

      replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    [replace]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      const searchValue = searchRef.current.trim();
      const currentFilters = filtersRef.current;
      const currentLimit = limitRef.current;

      if (searchValue) {
        params.set('search', searchValue);
      }
      if (currentFilters.categoryId) {
        params.set('categoryId', currentFilters.categoryId);
      }
      if (currentFilters.lowStock) {
        params.set('lowStock', 'true');
      }
      if (currentFilters.hasStock) {
        params.set('hasStock', 'true');
      }
      if (currentFilters.sortBy) {
        params.set('sortBy', currentFilters.sortBy);
      }
      if (currentFilters.sortOrder) {
        params.set('sortOrder', currentFilters.sortOrder);
      }
      if (currentFilters.startDate) {
        params.set('startDate', currentFilters.startDate);
      }
      if (currentFilters.endDate) {
        params.set('endDate', currentFilters.endDate);
      }
      if (page > 1) {
        params.set('page', page.toString());
      }
      if (Number.isFinite(currentLimit) && currentLimit > 0) {
        params.set('limit', currentLimit.toString());
      }

      // ✅ 使用 replace 而不是 push，避免输入框失去焦点
      replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    [replace]
  );

  // ✅ hover 预取处理 - 提升用户体验
  const handleNextPageHover = React.useCallback(() => {
    prefetchNextPage();
  }, [prefetchNextPage]);

  const handlePrevPageHover = React.useCallback(() => {
    prefetchPrevPage();
  }, [prefetchPrevPage]);

  // ✅ 构建当前查询参数（包含本地状态）
  const currentQueryParams: InventoryQueryParams = React.useMemo(
    () => ({
      search,
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      page: initialParams.page,
      limit,
    }),
    [
      search,
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      limit,
      initialParams,
    ]
  );

  // ✅ 使用 Suspense 包装，支持 Streaming 和更好的加载体验
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
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

        {/* 库存列表 */}
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
              onSearch={handleSearch}
              onFilter={handleFilter}
              onPageChange={handlePageChange}
              onNextPageHover={handleNextPageHover}
              onPrevPageHover={handlePrevPageHover}
              isLoading={isLoading}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
