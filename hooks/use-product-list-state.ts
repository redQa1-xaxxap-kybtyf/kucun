'use client';

import { useState, useCallback, useTransition, useEffect, useMemo } from 'react';
import * as React from 'react';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import { PRODUCT_DEFAULT_SORT } from '@/lib/config/product';
import { paginationConfig } from '@/lib/env';
import { productParamsConfig } from '@/lib/schemas/product-params-config';
import type { Product, ProductQueryParams } from '@/lib/types/product';

interface DeleteDialogState {
  open: boolean;
  productId: string | null;
  productName: string;
}

interface BatchDeleteDialogState {
  open: boolean;
  products: Product[];
}

type LatestQueryState = {
  search: string;
  status?: ProductQueryParams['status'];
  categoryId?: string;
  sortBy: ProductQueryParams['sortBy'];
  sortOrder: 'asc' | 'desc';
  page: number;
  limit?: number;
};

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

const SEARCH_DEBOUNCE_DELAY = 300;

// eslint-disable-next-line max-lines-per-function -- URL sync, selection state, and debounced search are intentionally managed together in this shared hook.
export function useProductListState(initialParams?: ProductQueryParams) {
  const { params, updateParams, isPending: isUrlPending } = useUrlSearchParams(
    productParamsConfig,
    {
      basePath: '/products',
      debounceMs: 0,
      shallow: true,
      initialParams,
    }
  );

  const [isNavigationPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(params.search || '');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // 使用 ref 存储最新的查询参数，避免闭包陷阱
  const latestParamsRef = React.useRef<LatestQueryState>({
    search: params.search || '',
    status: params.status,
    categoryId: params.categoryId,
    sortBy: params.sortBy || PRODUCT_DEFAULT_SORT.sortBy,
    sortOrder: params.sortOrder || PRODUCT_DEFAULT_SORT.sortOrder,
    page: params.page || 1,
    limit: params.limit || paginationConfig.defaultPageSize,
  });

  // 同步 initialParams 到 latestParamsRef（参考销售订单模块）
  useEffect(() => {
    latestParamsRef.current = {
      search: params.search || '',
      status: params.status,
      categoryId: params.categoryId,
      sortBy: params.sortBy || PRODUCT_DEFAULT_SORT.sortBy,
      sortOrder: params.sortOrder || PRODUCT_DEFAULT_SORT.sortOrder,
      page: params.page || 1,
      limit: params.limit || paginationConfig.defaultPageSize,
    };
  }, [
    params.search,
    params.status,
    params.categoryId,
    params.sortBy,
    params.sortOrder,
    params.page,
    params.limit,
  ]);

  useEffect(() => {
    setSearchInput(params.search || '');
  }, [params.search]);

  const applyQueryPatch = useCallback(
    (overrides: Partial<LatestQueryState>) => {
      const nextParams = { ...latestParamsRef.current, ...overrides };
      latestParamsRef.current = nextParams;
      updateParams({
        search: nextParams.search === '' ? undefined : nextParams.search,
        status: nextParams.status,
        categoryId:
          nextParams.categoryId === '' ? undefined : nextParams.categoryId,
        sortBy: nextParams.sortBy,
        sortOrder: nextParams.sortOrder,
        page: nextParams.page,
        limit: nextParams.limit,
      });
    },
    [updateParams]
  );

  const syncPendingSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    const search = normalizeSearch(searchInput) ?? '';
    setSearchInput(search);
    return search;
  }, [searchInput]);

  const handleSearchChange = useCallback(
    (value: string) => {
      const trimmed = value.trimStart();
      setSearchInput(trimmed);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }

      if (!trimmed) {
        startTransition(() => {
          applyQueryPatch({ search: '', page: 1 });
        });
        return;
      }

      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;
        startTransition(() => {
          applyQueryPatch({ search: trimmed, page: 1 });
        });
      }, SEARCH_DEBOUNCE_DELAY);
    },
    [applyQueryPatch, startTransition]
  );

  useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    },
    []
  );

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    productId: null,
    productName: '',
  });

  // 批量选择状态
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // 批量删除确认对话框状态
  const [batchDeleteDialog, setBatchDeleteDialog] =
    useState<BatchDeleteDialogState>({
      open: false,
      products: [],
    });

  // 筛选处理
  const handleFilter = useCallback(
    (filters: Partial<Pick<ProductQueryParams, 'status' | 'categoryId'>>) => {
      const search = syncPendingSearch();
      const overrides: Partial<LatestQueryState> = {
        ...filters,
        search,
        page: 1,
      };
      startTransition(() => {
        applyQueryPatch(overrides);
      });
    },
    [applyQueryPatch, startTransition, syncPendingSearch]
  );

  // 分页处理 - 参考销售订单模块的实现
  const handlePageChange = useCallback(
    (nextPage: number) => {
      const search = syncPendingSearch();

      if (
        nextPage === latestParamsRef.current.page &&
        search === latestParamsRef.current.search
      ) {
        return;
      }

      const overrides: Partial<LatestQueryState> = {
        search,
        page: nextPage,
      };
      startTransition(() => {
        applyQueryPatch(overrides);
      });
    },
    [applyQueryPatch, startTransition, syncPendingSearch]
  );

  const handleClearFilters = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setSearchInput('');

    const overrides: Partial<LatestQueryState> = {
      search: '',
      status: undefined,
      categoryId: undefined,
      page: 1,
    };

    startTransition(() => {
      applyQueryPatch(overrides);
    });
  }, [applyQueryPatch, startTransition]);

  // 删除产品处理
  const handleDeleteProduct = (productId: string, productCode: string) => {
    setDeleteDialog({
      open: true,
      productId,
      productName: productCode, // 使用产品编码而不是名称
    });
  };

  // 批量选择处理
  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds(prev => {
      if (checked) {
        return [...prev, productId];
      } else {
        return prev.filter(id => id !== productId);
      }
    });
  };

  // 全选/取消全选处理
  const handleSelectAll = (checked: boolean, products?: Product[]) => {
    if (checked && Array.isArray(products)) {
      setSelectedProductIds(products.map(product => product.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  // 批量删除处理
  const handleBatchDelete = (products?: Product[]) => {
    if (selectedProductIds.length === 0) return;

    const selectedProducts = Array.isArray(products)
      ? products.filter(product => selectedProductIds.includes(product.id))
      : [];

    setBatchDeleteDialog({
      open: true,
      products: selectedProducts,
    });
  };

  // 清空选择
  const clearSelection = () => {
    setSelectedProductIds([]);
  };

  const currentQueryParams = useMemo<ProductQueryParams>(
    () => ({
      page: params.page || 1,
      limit: params.limit || paginationConfig.defaultPageSize,
      search: params.search || '',
      categoryId: params.categoryId || '',
      status: params.status,
      sortBy: params.sortBy || PRODUCT_DEFAULT_SORT.sortBy,
      sortOrder: params.sortOrder || PRODUCT_DEFAULT_SORT.sortOrder,
    }),
    [
      params.categoryId,
      params.limit,
      params.page,
      params.search,
      params.sortBy,
      params.sortOrder,
      params.status,
    ]
  );

  return {
    // 状态
    deleteDialog,
    selectedProductIds,
    batchDeleteDialog,
    searchInput,
    isSearching: isNavigationPending || isUrlPending,
    isNavigationPending: isNavigationPending || isUrlPending,
    currentQueryParams,

    // 状态更新函数
    setDeleteDialog,
    setSelectedProductIds,
    setBatchDeleteDialog,

    // 事件处理函数
    handleSearch: handleSearchChange,
    handleFilter,
    handleClearFilters,
    handlePageChange,
    handleDeleteProduct,
    handleSelectProduct,
    handleSelectAll,
    handleBatchDelete,
    clearSelection,
  };
}
