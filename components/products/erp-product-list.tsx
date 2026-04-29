'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { CategorySelector } from '@/components/categories/category-selector';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import { ProductDeleteDialog } from '@/components/products/product-delete-dialogs';
import { ProductTable } from '@/components/products/product-table';
import { Pagination, type PaginationInfo } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductDelete } from '@/hooks/use-product-delete';
import { useProductListState } from '@/hooks/use-product-list-state';
import {
  categoryQueryKeys,
  getCategories,
  type Category,
} from '@/lib/api/categories';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { PRODUCT_STATUS_OPTIONS } from '@/lib/config/product';
import type {
  Product,
  ProductQueryParams,
  ProductStatus,
} from '@/lib/types/product';
import { cn } from '@/lib/utils';

const CATEGORY_OPTIONS_QUERY = {
  status: 'active',
  limit: 100,
  sortBy: 'name',
  sortOrder: 'asc',
} as const;

interface ERPProductListProps {
  onProductSelect?: (product: Product) => void;
  initialParams?: ProductQueryParams;
}

type ProductListState = ReturnType<typeof useProductListState>;
type ConfirmDeleteProduct = ReturnType<
  typeof useProductDelete
>['confirmDeleteProduct'];

interface ERPProductListFiltersProps {
  categories: Category[];
  initialParams?: ProductQueryParams;
  searchValue: string;
  isSearching: boolean;
  handleSearch: ProductListState['handleSearch'];
  handleFilter: ProductListState['handleFilter'];
  handleClearFilters: ProductListState['handleClearFilters'];
}

function ERPProductListFilters({
  categories,
  initialParams,
  searchValue,
  isSearching,
  handleSearch,
  handleFilter,
  handleClearFilters,
}: ERPProductListFiltersProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={handleSearch}
      searchPlaceholder="搜索编码、名称、规格"
      isSearching={isSearching}
      filters={[
        {
          key: 'status',
          label: '产品状态',
          options: PRODUCT_STATUS_OPTIONS.map(option => ({
            label: option.label,
            value: option.value,
          })),
          width: 'w-32',
        },
      ]}
      filterValues={{
        categoryId: initialParams?.categoryId || 'all',
        status: initialParams?.status || 'all',
      }}
      onFilterChange={(key, value) => {
        if (key === 'status') {
          handleFilter({
            categoryId: initialParams?.categoryId,
            status: value as ProductStatus | undefined,
          });
        }
      }}
      onClearFilters={handleClearFilters}
      variant="pro"
      compact={true}
      customFilters={
        <CategorySelector
          categories={categories}
          value={initialParams?.categoryId || undefined}
          onValueChange={nextCategoryId => {
            handleFilter({
              categoryId: nextCategoryId,
              status: initialParams?.status,
            });
          }}
          className="h-11 w-full rounded-lg border-slate-200 bg-white font-medium shadow-none hover:bg-white sm:w-36"
        />
      }
    />
  );
}

interface ERPProductListTableCardProps {
  products: Product[];
  pagination?: PaginationInfo;
  categoryPathById: Map<string, string>;
  onProductSelect?: (product: Product) => void;
  onDeleteProduct: ProductListState['handleDeleteProduct'];
  onPageChange: ProductListState['handlePageChange'];
  isLoading?: boolean;
  isRefreshing?: boolean;
}

function ERPProductListTableCard({
  products,
  pagination,
  categoryPathById,
  onProductSelect,
  onDeleteProduct,
  onPageChange,
  isLoading = false,
  isRefreshing = false,
}: ERPProductListTableCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm"
      aria-busy={isLoading || isRefreshing}
    >
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
          正在更新
        </div>
      )}
      <div className={cn('transition-opacity', isRefreshing && 'opacity-60')}>
        {isLoading ? (
          <ProductListTableSkeleton />
        ) : (
          <ProductTable
            products={products}
            categoryPathById={categoryPathById}
            onProductSelect={onProductSelect}
            onDeleteProduct={onDeleteProduct}
            isLoading={isRefreshing}
          />
        )}
      </div>

      {pagination && !isLoading && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isRefreshing}
          />
        </div>
      )}
    </div>
  );
}

interface ERPProductListDeleteDialogProps {
  deleteDialog: ProductListState['deleteDialog'];
  setDeleteDialog: ProductListState['setDeleteDialog'];
  isDeleting: boolean;
  confirmDeleteProduct: ConfirmDeleteProduct;
}

function ERPProductListDeleteDialog({
  deleteDialog,
  setDeleteDialog,
  isDeleting,
  confirmDeleteProduct,
}: ERPProductListDeleteDialogProps) {
  return (
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
      onConfirm={() => {
        if (deleteDialog.productId) {
          confirmDeleteProduct(deleteDialog.productId);
        }
      }}
    />
  );
}

/**
 * ERP风格产品管理列表组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductList({
  onProductSelect,
  initialParams,
}: ERPProductListProps) {
  // 状态管理
  const {
    deleteDialog,
    setDeleteDialog,
    searchInput,
    isSearching,
    isNavigationPending,
    handleSearch,
    handleFilter,
    handleClearFilters,
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
    queryKey: categoryQueryKeys.list(CATEGORY_OPTIONS_QUERY),
    queryFn: () => getCategories(CATEGORY_OPTIONS_QUERY),
  });

  const categories = categoriesResponse?.data ?? [];
  const categoryPathById = new Map(
    categories.map(category => [
      category.id,
      category.fullPath ?? category.name,
    ])
  );

  // ✅ 直接使用 initialParams，避免状态不同步（参考销售订单模块）
  // 获取产品列表数据
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: productQueryKeys.list(initialParams),
    queryFn: () => getProducts(initialParams),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
    refetchOnMount: false,
  });
  const isInitialLoading = isLoading && !data;
  const isListRefreshing =
    !isInitialLoading && (isFetching || isSearching || isNavigationPending);

  if (error && !data) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center">
        产品列表加载失败
      </div>
    );
  }

  const products = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <ERPProductListFilters
        categories={categories}
        initialParams={initialParams}
        searchValue={searchInput}
        isSearching={isSearching || isListRefreshing}
        handleSearch={handleSearch}
        handleFilter={handleFilter}
        handleClearFilters={handleClearFilters}
      />

      <ERPProductListTableCard
        products={products}
        pagination={pagination}
        categoryPathById={categoryPathById}
        onProductSelect={onProductSelect}
        onDeleteProduct={handleDeleteProduct}
        onPageChange={handlePageChange}
        isLoading={isInitialLoading}
        isRefreshing={isListRefreshing}
      />

      <ERPProductListDeleteDialog
        deleteDialog={deleteDialog}
        setDeleteDialog={setDeleteDialog}
        isDeleting={isDeleting}
        confirmDeleteProduct={confirmDeleteProduct}
      />
    </div>
  );
}

function ProductListTableSkeleton() {
  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`product-mobile-skeleton-${index}`}
            className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-[var(--shadow-light)]"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="col-span-2 h-4 w-3/4" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((__, buttonIndex) => (
                <Skeleton
                  key={`product-mobile-action-skeleton-${index}-${buttonIndex}`}
                  className="h-9 w-full"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="border-b bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <div className="grid grid-cols-[64px_1fr_1.2fr_1fr_1fr_90px_90px_130px_64px] gap-4">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton
                key={`product-header-skeleton-${index}`}
                className="h-4 w-full"
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div
            key={`product-row-skeleton-${rowIndex}`}
            className="border-b px-4 py-3 last:border-b-0"
          >
            <div className="grid grid-cols-[64px_1fr_1.2fr_1fr_1fr_90px_90px_130px_64px] items-center gap-4">
              <Skeleton className="h-10 w-10 rounded" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
