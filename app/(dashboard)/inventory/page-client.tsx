'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '@/components/ui/button';
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
  const [limit, setLimit] = React.useState<number>(
    typeof initialParams.limit === 'number' && Number.isFinite(initialParams.limit)
      ? initialParams.limit
      : 50
  );

  React.useEffect(() => {
    setSearch(initialParams.search || '');
    setCategoryId(initialParams.categoryId || '');
    setLowStock(Boolean(initialParams.lowStock));
    setHasStock(Boolean(initialParams.hasStock));
    setSortBy(initialParams.sortBy || 'updatedAt');
    setSortOrder(initialParams.sortOrder === 'asc' ? 'asc' : 'desc');
    setLimit(current =>
      typeof initialParams.limit === 'number' && Number.isFinite(initialParams.limit)
        ? initialParams.limit
        : current
    );
  }, [initialParams]);

  // ✅ 使用 ref 存储最新的筛选状态，避免闭包问题
  const filtersRef = React.useRef({
    categoryId,
    lowStock,
    hasStock,
    sortBy,
    sortOrder,
  });

  // ✅ 每次状态变化时更新 ref
  React.useEffect(() => {
    filtersRef.current = {
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
    };
  }, [categoryId, lowStock, hasStock, sortBy, sortOrder]);

  // ✅ 获取库存列表数据（从 HydrationBoundary 自动获取服务端预取的数据，无需重复请求）
  // ✅ 暴露预取方法供分页按钮使用
  const { data, isLoading, error, prefetchNextPage, prefetchPrevPage } =
    useOptimizedInventoryQuery({
      params: initialParams,
    });

  // ✅ 统一数据格式后，直接使用，无需复杂的 normalizedData 映射
  // ✅ 兼容旧结构（data.data）与新结构（data.inventories）
  const normalizedData = data?.data;
  const inventories =
    normalizedData?.inventories ??
    (Array.isArray(normalizedData?.data) ? normalizedData?.data : []) ??
    [];
  const pagination = normalizedData?.pagination;

  // ✅ 防抖更新URL - 只在用户停止输入后才更新URL和触发数据请求
  const debouncedUpdateURL = useDebouncedCallback(
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

      params.set('page', '1');

      if (Number.isFinite(limit) && limit > 0) {
        params.set('limit', limit.toString());
      }

      router.replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    500 // ✅ 增加防抖时间到 500ms，减少不必要的请求
  );

  // ✅ 搜索处理 - 立即更新本地状态（不触发重渲染），防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      // ✅ 立即更新本地状态，保证输入流畅
      setSearch(value);
      // ✅ 防抖更新URL，避免频繁请求
      debouncedUpdateURL(value);
    },
    [debouncedUpdateURL]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      let nextCategoryId = categoryId;
      let nextLowStock = lowStock;
      let nextHasStock = hasStock;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextLimit = limit;

      const stringValue =
        typeof value === 'string' ? value.trim() : value;

      if (key === 'categoryId') {
        nextCategoryId = typeof stringValue === 'string' ? stringValue : '';
        setCategoryId(nextCategoryId);
      } else if (key === 'lowStock') {
        nextLowStock = Boolean(stringValue);
        setLowStock(nextLowStock);
        if (nextLowStock) {
          nextHasStock = false;
          setHasStock(false);
        }
      } else if (key === 'hasStock') {
        nextHasStock = Boolean(stringValue);
        setHasStock(nextHasStock);
        if (nextHasStock) {
          nextLowStock = false;
          setLowStock(false);
        }
      } else if (key === 'sortBy') {
        nextSortBy =
          (stringValue as InventoryQueryParams['sortBy']) || 'updatedAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = stringValue === 'asc' ? 'asc' : 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'limit') {
        const parsed = Number(stringValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          nextLimit = parsed;
        }
        setLimit(nextLimit);
      }

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (nextCategoryId) {
        params.set('categoryId', nextCategoryId);
      }
      if (nextLowStock) {
        params.set('lowStock', 'true');
      }
      if (nextHasStock) {
        params.set('hasStock', 'true');
      }
      if (nextSortBy) {
        params.set('sortBy', nextSortBy);
      }
      if (nextSortOrder) {
        params.set('sortOrder', nextSortOrder);
      }

      params.set('page', '1');

      if (Number.isFinite(nextLimit) && nextLimit > 0) {
        params.set('limit', nextLimit.toString());
      }

      router.replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    [categoryId, hasStock, limit, lowStock, router, search, sortBy, sortOrder]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
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
      if (Number.isFinite(limit) && limit > 0) {
        params.set('limit', limit.toString());
      }

      // ✅ 使用 replace 而不是 push，避免输入框失去焦点
      router.replace(`/inventory?${params.toString()}`, { scroll: false });
    },
    [
      router,
      search,
      categoryId,
      lowStock,
      hasStock,
      sortBy,
      sortOrder,
      limit,
    ]
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
      page: initialParams.page,
      limit,
    }),
    [search, categoryId, lowStock, hasStock, sortBy, sortOrder, limit, initialParams]
  );

  // ✅ 使用 Suspense 包装，支持 Streaming 和更好的加载体验
  // ✅ 修复：使用固定高度容器，避免内容加载时的布局偏移
  // ✅ 修复：移除外层 padding，让工具栏从顶部开始 sticky
  return (
    <div className="flex h-full flex-col overflow-auto">
      <Suspense fallback={<InventoryListSkeleton />}>
        {error ? (
          <div className="m-6 rounded-lg border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] p-6 text-center shadow-sm">
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
          <div className="min-h-[600px]">
            <ERPInventoryList
              data={{ data: inventories, pagination }}
              categoryOptions={categoryOptions}
              queryParams={currentQueryParams}
              onSearch={handleSearch}
              onFilter={handleFilter}
              onPageChange={handlePageChange}
              onNextPageHover={handleNextPageHover}
              onPrevPageHover={handlePrevPageHover}
              isLoading={isLoading}
            />
          </div>
        )}
      </Suspense>
    </div>
  );
}

