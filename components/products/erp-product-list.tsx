'use client';

import { useQuery } from '@tanstack/react-query';

import { ContentLoading } from '@/components/common/loading';
import {
  ProductBatchDeleteDialog,
  ProductDeleteDialog,
} from '@/components/products/product-delete-dialogs';
import { ProductListToolbar } from '@/components/products/product-list-toolbar';
import { ProductSearchFilters } from '@/components/products/product-search-filters';
import { ProductTable } from '@/components/products/product-table';
import { Pagination } from '@/components/ui/pagination';
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
    handlePageChange,
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
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的（与服务端缓存策略保持一致）
    refetchOnMount: false, // 避免重复请求，使用缓存数据
    refetchOnWindowFocus: false, // 避免不必要的重新获取
    initialData: _initialData, // 使用服务端预取的数据
    placeholderData: previousData => previousData, // 切换查询参数时保持上一次数据
  });

  // 处理筛选器清空
  const handleClearFilters = () => {
    handleFilter({
      status: undefined,
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
    return <ContentLoading text="加载产品列表中..." />;
  }

  if (error) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center">
        加载产品列表失败，请重试
      </div>
    );
  }

  const products = data?.data || [];
  const pagination = data?.pagination;

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
        categoryFilter={queryParams.categoryId}
        categories={categories}
        isLoadingCategories={isLoadingCategories}
        onSearchChange={handleSearch}
        onStatusChange={value => handleFilter({ status: value })}
        onCategoryChange={value => handleFilter({ categoryId: value })}
        onClearFilters={handleClearFilters}
      />

      {/* 产品表格 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        <ProductTable
          products={products}
          selectedProductIds={selectedProductIds}
          onProductSelect={onProductSelect}
          onSelectProduct={handleSelectProduct}
          onSelectAll={checked => handleSelectAll(checked, products)}
          onDeleteProduct={handleDeleteProduct}
        />

        {/* 分页组件 */}
        {pagination && (
          <div className="border-t bg-gray-50/50 px-4 py-3">
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              showRange
              showTotal
            />
          </div>
        )}
      </div>

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
