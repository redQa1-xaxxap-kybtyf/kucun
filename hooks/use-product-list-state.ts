'use client';

import React from 'react';

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

export function useProductListState(initialParams?: ProductQueryParams) {
  // 查询参数状态
  const [queryParams, setQueryParams] = React.useState<ProductQueryParams>(
    initialParams || {
      page: 1,
      limit: paginationConfig.defaultPageSize,
      search: '',
      status: undefined,
      unit: undefined,
      categoryId: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
  );

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
    open: false,
    productId: null,
    productName: '',
  });

  // 批量选择状态
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>(
    []
  );

  // 批量删除确认对话框状态
  const [batchDeleteDialog, setBatchDeleteDialog] =
    React.useState<BatchDeleteDialogState>({
      open: false,
      products: [],
    });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (
    filters: Partial<Pick<ProductQueryParams, 'status' | 'unit' | 'categoryId'>>
  ) => {
    setQueryParams(prev => ({ ...prev, ...filters, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

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
    queryParams,
    deleteDialog,
    selectedProductIds,
    batchDeleteDialog,

    // 状态更新函数
    setQueryParams,
    setDeleteDialog,
    setSelectedProductIds,
    setBatchDeleteDialog,

    // 事件处理函数
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDeleteProduct,
    handleSelectProduct,
    handleSelectAll,
    handleBatchDelete,
    clearSelection,
  };
}
