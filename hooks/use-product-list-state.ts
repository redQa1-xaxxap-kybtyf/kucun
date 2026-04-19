'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useRef, useTransition, useEffect } from 'react';

import { useListSearchController } from '@/hooks/use-list-search-controller';
import { PRODUCT_DEFAULT_SORT } from '@/lib/config/product';
import { paginationConfig } from '@/lib/env';
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

// eslint-disable-next-line max-lines-per-function -- URL sync, selection state, and debounced search are intentionally managed together in this shared hook.
export function useProductListState(initialParams?: ProductQueryParams) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // 使用 ref 存储最新的查询参数，避免闭包陷阱
  const latestParamsRef = useRef<LatestQueryState>({
    search: initialParams?.search || '',
    status: initialParams?.status,
    categoryId: initialParams?.categoryId,
    sortBy: initialParams?.sortBy || PRODUCT_DEFAULT_SORT.sortBy,
    sortOrder: initialParams?.sortOrder || PRODUCT_DEFAULT_SORT.sortOrder,
    page: initialParams?.page || 1,
    limit: initialParams?.limit || paginationConfig.defaultPageSize,
  });

  // 同步 initialParams 到 latestParamsRef（参考销售订单模块）
  useEffect(() => {
    latestParamsRef.current = {
      search: initialParams?.search || '',
      status: initialParams?.status,
      categoryId: initialParams?.categoryId,
      sortBy: initialParams?.sortBy || PRODUCT_DEFAULT_SORT.sortBy,
      sortOrder: initialParams?.sortOrder || PRODUCT_DEFAULT_SORT.sortOrder,
      page: initialParams?.page || 1,
      limit: initialParams?.limit || paginationConfig.defaultPageSize,
    };
  }, [
    initialParams?.search,
    initialParams?.status,
    initialParams?.categoryId,
    initialParams?.sortBy,
    initialParams?.sortOrder,
    initialParams?.page,
    initialParams?.limit,
  ]);

  // 统一的 URL 更新函数
  const replaceURL = useCallback(
    (overrides?: Partial<LatestQueryState>) => {
      const next = { ...latestParamsRef.current, ...overrides };
      const params = new URLSearchParams();

      if (next.search) {
        params.set('search', next.search);
      }
      if (next.status) {
        params.set('status', next.status);
      }
      if (next.categoryId) {
        params.set('categoryId', next.categoryId);
      }
      if (next.sortBy) {
        params.set('sortBy', next.sortBy);
      }
      if (next.sortOrder) {
        params.set('sortOrder', next.sortOrder);
      }
      if (next.page > 1) {
        params.set('page', next.page.toString());
      }
      if (typeof next.limit === 'number') {
        params.set('limit', next.limit.toString());
      }

      const queryString = params.toString();
      const newUrl = queryString ? `/products?${queryString}` : '/products';

      startTransition(() => {
        router.replace(newUrl, { scroll: false });
      });
    },
    [router]
  );

  const { searchInput, isSearching, handleSearchChange } =
    useListSearchController({
      committedValue: initialParams?.search,
      onCommit: search => {
        const overrides: Partial<LatestQueryState> = {
          search: search ?? '',
          page: 1,
        };
        latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
        replaceURL(overrides);
      },
    });

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
      const overrides: Partial<LatestQueryState> = { ...filters, page: 1 };
      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
      replaceURL(overrides);
    },
    [replaceURL]
  );

  // 分页处理 - 参考销售订单模块的实现
  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage === latestParamsRef.current.page) {
        return;
      }

      const overrides: Partial<LatestQueryState> = { page: nextPage };
      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
      replaceURL(overrides);
    },
    [replaceURL]
  );

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

  return {
    // 状态
    deleteDialog,
    selectedProductIds,
    batchDeleteDialog,
    searchInput,
    isSearching,

    // 状态更新函数
    setDeleteDialog,
    setSelectedProductIds,
    setBatchDeleteDialog,

    // 事件处理函数
    handleSearch: handleSearchChange,
    handleFilter,
    handlePageChange,
    handleDeleteProduct,
    handleSelectProduct,
    handleSelectAll,
    handleBatchDelete,
    clearSelection,
  };
}
