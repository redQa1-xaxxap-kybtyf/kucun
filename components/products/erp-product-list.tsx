'use client';

import { useQuery } from '@tanstack/react-query';

import { CategorySelector } from '@/components/categories/category-selector';
import { ContentLoading } from '@/components/common/loading';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import { ProductDeleteDialog } from '@/components/products/product-delete-dialogs';
import { ProductTable } from '@/components/products/product-table';
import { Pagination, type PaginationInfo } from '@/components/ui/pagination';
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
  handleSearch: ProductListState['handleSearch'];
  handleFilter: ProductListState['handleFilter'];
}

function ERPProductListFilters({
  categories,
  initialParams,
  handleSearch,
  handleFilter,
}: ERPProductListFiltersProps) {
  return (
    <SearchFilterCard
      searchValue={initialParams?.search || ''}
      onSearchChange={handleSearch}
      searchPlaceholder="搜索产品编码、名称或规格..."
      filters={[
        {
          key: 'status',
          label: '状态',
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
      onClearFilters={() =>
        handleFilter({
          status: undefined,
          categoryId: undefined,
        })
      }
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
            className="h-14 w-full rounded-2xl border-white bg-white/40 font-bold shadow-sm backdrop-blur-md hover:bg-white sm:w-36"
          />
        }
      />
  );
}

interface ERPProductListTableCardProps {
  products: Product[];
  pagination?: PaginationInfo;
  onProductSelect?: (product: Product) => void;
  onDeleteProduct: ProductListState['handleDeleteProduct'];
  onPageChange: ProductListState['handlePageChange'];
}

function ERPProductListTableCard({
  products,
  pagination,
  onProductSelect,
  onDeleteProduct,
  onPageChange,
}: ERPProductListTableCardProps) {
  return (
    <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
      <ProductTable
        products={products}
        onProductSelect={onProductSelect}
        onDeleteProduct={onDeleteProduct}
      />

      {pagination && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
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
    queryKey: categoryQueryKeys.list(CATEGORY_OPTIONS_QUERY),
    queryFn: () => getCategories(CATEGORY_OPTIONS_QUERY),
  });

  const categories = categoriesResponse?.data ?? [];

  // ✅ 直接使用 initialParams，避免状态不同步（参考销售订单模块）
  // 获取产品列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: productQueryKeys.list(initialParams),
    queryFn: () => getProducts(initialParams),
    staleTime: 0, // ✅ 修复：设置为0，确保每次导航都重新获取最新数据
    refetchOnWindowFocus: false, // 避免不必要的重新获取
    refetchOnMount: 'always', // ✅ 修复：每次挂载都重新获取，确保数据最新
  });

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
      <ERPProductListFilters
        categories={categories}
        initialParams={initialParams}
        handleSearch={handleSearch}
        handleFilter={handleFilter}
      />

      <ERPProductListTableCard
        products={products}
        pagination={pagination}
        onProductSelect={onProductSelect}
        onDeleteProduct={handleDeleteProduct}
        onPageChange={handlePageChange}
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
