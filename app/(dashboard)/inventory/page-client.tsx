'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { InventoryListSkeleton } from '@/components/inventory/inventory-list-skeleton';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import type { CategoryOption } from '@/lib/types/category';
import type { InventoryQueryParams } from '@/lib/types/inventory';

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
  const [_isPending, startTransition] = React.useTransition();

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

  // ✅ 获取库存列表数据（从 HydrationBoundary 自动获取服务端预取的数据，无需重复请求）
  // ✅ 暴露预取方法供分页按钮使用
  const { data, isLoading, error, prefetchNextPage, prefetchPrevPage } =
    useOptimizedInventoryQuery({
      params: initialParams,
    });

  // ✅ 统一数据格式后，直接使用，无需复杂的 normalizedData 映射
  const inventories = data?.inventories ?? [];
  const pagination = data?.pagination;

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: InventoryQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
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
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/inventory?${params.toString()}`);
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
        categoryId,
        lowStock,
        hasStock,
        sortBy,
        sortOrder,
        page: 1,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      const newFilters = { ...initialParams, [key]: value, page: 1 };

      // 更新本地状态
      if (key === 'categoryId') {
        setCategoryId(value as string);
      } else if (key === 'lowStock') {
        setLowStock(value as boolean);
      } else if (key === 'hasStock') {
        setHasStock(value as boolean);
      } else if (key === 'sortBy') {
        setSortBy(value as InventoryQueryParams['sortBy']);
      } else if (key === 'sortOrder') {
        setSortOrder(value as 'asc' | 'desc');
      }

      // 立即更新URL（筛选不需要防抖）
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (newFilters.categoryId) {
          params.set('categoryId', newFilters.categoryId);
        }
        if (newFilters.lowStock) {
          params.set('lowStock', 'true');
        }
        if (newFilters.hasStock) {
          params.set('hasStock', 'true');
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

        router.push(`/inventory?${params.toString()}`);
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
        if (categoryId) {
          params.set('categoryId', categoryId);
        }
        if (lowStock) {
          params.set('lowStock', 'true');
        }
        if (hasStock) {
          params.set('hasStock', 'true');
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

        router.push(`/inventory?${params.toString()}`);
      });
    },
    [
      router,
      search,
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
      initialParams.limit,
    ]
  );

  // ✅ hover 预取处理 - 提升用户体验
  const handleNextPageHover = React.useCallback(() => {
    prefetchNextPage();
  }, [prefetchNextPage]);

  const handlePrevPageHover = React.useCallback(() => {
    prefetchPrevPage();
  }, [prefetchPrevPage]);

  // ✅ 使用 Suspense 包装，支持 Streaming 和更好的加载体验
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <Suspense fallback={<InventoryListSkeleton />}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center shadow-sm">
            <p className="text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              重新加载
            </button>
          </div>
        ) : (
          <ERPInventoryList
            data={{ data: inventories, pagination }}
            categoryOptions={categoryOptions}
            queryParams={initialParams}
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
  );
}
