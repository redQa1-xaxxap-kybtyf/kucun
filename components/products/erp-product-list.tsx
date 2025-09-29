'use client';

import { useQuery } from '@tanstack/react-query';

import {
  ProductBatchDeleteDialog,
  ProductDeleteDialog,
} from '@/components/products/product-delete-dialogs';
import { ProductListToolbar } from '@/components/products/product-list-toolbar';
import { ProductSearchFilters } from '@/components/products/product-search-filters';
import { ProductTable } from '@/components/products/product-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductDelete } from '@/hooks/use-product-delete';
import { useProductListState } from '@/hooks/use-product-list-state';
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { type PaginatedResponse } from '@/lib/types/api';
import type { Product, ProductQueryParams } from '@/lib/types/product';

interface ERPProductListProps {
  onProductSelect?: (product: Product) => void;
  _initialData?: PaginatedResponse<Product>;
  initialParams?: ProductQueryParams;
}

/**
 * ERP风格产品管理列表组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductList({
  onProductSelect,
  _initialData,
  initialParams,
}: ERPProductListProps) {
  // 状态管理
  const {
    queryParams,
    deleteDialog,
    selectedProductIds,
    batchDeleteDialog,
    setDeleteDialog,
    setBatchDeleteDialog,
    handleSearch,
    handleFilter,
    handleDeleteProduct,
    handleSelectProduct,
    handleSelectAll,
    handleBatchDelete,
    clearSelection,
  } = useProductListState(initialParams);

  // 删除操作
  const {
    confirmDeleteProduct,
    confirmBatchDelete,
    isDeleting,
    isBatchDeleting,
  } = useProductDelete({
    onDeleteSuccess: () => {
      setDeleteDialog({ open: false, productId: null, productName: '' });
    },
    onBatchDeleteSuccess: () => {
      setBatchDeleteDialog({ open: false, products: [] });
      clearSelection();
    },
  });

  // 获取分类列表
  const { data: categoriesResponse, isLoading: isLoadingCategories } = useQuery(
    {
      queryKey: categoryQueryKeys.lists(),
      queryFn: () => getCategories(),
    }
  );

  const categories = categoriesResponse?.data || [];

  // 获取产品列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: productQueryKeys.list(queryParams),
    queryFn: () => getProducts(queryParams),
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    refetchOnWindowFocus: false, // 避免不必要的重新获取
  });

  // 处理筛选器清空
  const handleClearFilters = () => {
    handleFilter({
      status: undefined,
      unit: undefined,
      categoryId: undefined,
    });
  };

  // 处理删除确认
  const handleConfirmDelete = () => {
    if (deleteDialog.productId) {
      confirmDeleteProduct(deleteDialog.productId);
    }
  };

  // 处理批量删除确认
  const handleConfirmBatchDelete = () => {
    confirmBatchDelete(selectedProductIds);
  };

  if (isLoading) {
    return <ProductListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        加载产品列表失败，请重试
      </div>
    );
  }

  const products = data?.data || [];

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <ProductListToolbar
        selectedCount={selectedProductIds.length}
        onBatchDelete={() => handleBatchDelete(products)}
      />

      {/* 搜索和筛选 */}
      <ProductSearchFilters
        searchValue={queryParams.search || ''}
        statusFilter={queryParams.status}
        unitFilter={queryParams.unit}
        categoryFilter={queryParams.categoryId}
        categories={categories}
        isLoadingCategories={isLoadingCategories}
        onSearchChange={handleSearch}
        onStatusChange={value => handleFilter({ status: value })}
        onUnitChange={value => handleFilter({ unit: value })}
        onCategoryChange={value => handleFilter({ categoryId: value })}
        onClearFilters={handleClearFilters}
      />

      {/* 产品表格 */}
      <ProductTable
        products={products}
        selectedProductIds={selectedProductIds}
        onProductSelect={onProductSelect}
        onSelectProduct={handleSelectProduct}
        onSelectAll={checked => handleSelectAll(checked, products)}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* 删除确认对话框 */}
      <ProductDeleteDialog
        open={deleteDialog.open}
        productName={deleteDialog.productName}
        isDeleting={isDeleting}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmDelete}
      />

      {/* 批量删除确认对话框 */}
      <ProductBatchDeleteDialog
        open={batchDeleteDialog.open}
        products={batchDeleteDialog.products}
        isBatchDeleting={isBatchDeleting}
        onOpenChange={open => setBatchDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmBatchDelete}
      />
    </div>
  );
}

// 加载骨架屏组件
function ProductListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
