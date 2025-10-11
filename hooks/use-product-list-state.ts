'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useRef, useTransition, useEffect } from 'react';

import { paginationConfig } from '@/lib/config/product';
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

export function useProductListState(initialParams?: ProductQueryParams) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // 使用 ref 存储最新的查询参数，避免闭包陷阱
  const latestParamsRef = useRef<LatestQueryState>({
    search: initialParams?.search || '',
    status: initialParams?.status,
    categoryId: initialParams?.categoryId,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    page: initialParams?.page || 1,
    limit: initialParams?.limit || paginationConfig.defaultPageSize,
  });

  // 同步 initialParams 到 latestParamsRef（参考销售订单模块）
  useEffect(() => {
    latestParamsRef.current = {
      search: initialParams?.search || '',
      status: initialParams?.status,
      categoryId: initialParams?.categoryId,
      sortBy: initialParams?.sortBy || 'createdAt',
      sortOrder: initialParams?.sortOrder || 'desc',
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

  // 搜索处理
  const handleSearch = useCallback(
    (value: string) => {
      const overrides: Partial<LatestQueryState> = { search: value, page: 1 };
      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
      replaceURL(overrides);
    },
    [replaceURL]
  );

  // 筛选处理
  const handleFilter = useCallback(
    (filters: Partial<Pick<ProductQueryParams, 'status' | 'categoryId'>>) => {
      const overrides: Partial<LatestQueryState> = { ...filters, page: 1 };
      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
      replaceURL(overrides);
    },
    [replaceURL]
  );

  // 排序处理
  const handleSortChange = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const overrides: Partial<LatestQueryState> = {
        sortBy,
        sortOrder,
        page: 1,
      };
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

    // 状态更新函数
    setDeleteDialog,
    setSelectedProductIds,
    setBatchDeleteDialog,

    // 事件处理函数
    handleSearch,
    handleFilter,
    handleSortChange,
    handlePageChange,
    handleDeleteProduct,
    handleSelectProduct,
    handleSelectAll,
    handleBatchDelete,
    clearSelection,
  };
}
