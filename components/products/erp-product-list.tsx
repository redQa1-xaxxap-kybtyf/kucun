'use client';

import { useQuery } from '@tanstack/react-query';

import { ContentLoading } from '@/components/common/loading';
import { ProductDeleteDialog } from '@/components/products/product-delete-dialogs';
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
    deleteDialog,
    setDeleteDialog,
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDeleteProduct,
  } = useProductListState(initialParams);

  // 删除操作
  const { confirmDeleteProduct, isDeleting } = useProductDelete({
    onDeleteSuccess: () => {
      setDeleteDialog({ open: false, productId: null, productName: '' });
    },
  });

  // 获取分类列表
  const { data: categoriesResponse } = useQuery({
    queryKey: categoryQueryKeys.lists(),
    queryFn: () => getCategories(),
  });

  const categories = categoriesResponse?.data || [];

  // ✅ 直接使用 initialParams，避免状态不同步（参考销售订单模块）
  // 获取产品列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: productQueryKeys.list(initialParams),
    queryFn: () => getProducts(initialParams),
    staleTime: 30 * 1000, // 30秒缓存时间，平衡性能和数据新鲜度
    refetchOnWindowFocus: false, // 避免不必要的重新获取
    initialData: _initialData, // 使用服务端预取的数据，但允许后续更新
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
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <ProductSearchFilters
        searchValue={initialParams?.search || ''}
        categoryId={initialParams?.categoryId}
        status={initialParams?.status}
        categories={categories}
        onSearchChange={handleSearch}
        onFilterChange={handleFilter}
        onClearFilters={handleClearFilters}
      />

      {/* 产品列表 */}
      <div
        className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <ProductTable
          products={products}
          onProductSelect={onProductSelect}
          onDeleteProduct={handleDeleteProduct}
        />

        {/* 分页组件 */}
        {pagination && (
          <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
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
        onOpenChange={open =>
          setDeleteDialog(prev => ({
            ...prev,
            open,
            ...(open
              ? {}
              : {
                  productId: null,
                  productName: '',
                }),
          }))
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
