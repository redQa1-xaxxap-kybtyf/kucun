'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import {
  ProductBatchDeleteDialog,
  ProductDeleteDialog,
} from '@/components/products/product-delete-dialogs';
import { ProductListToolbar } from '@/components/products/product-list-toolbar';
import { ProductSearchFilters } from '@/components/products/product-search-filters';
import { ProductTable } from '@/components/products/product-table';
import { Pagination } from '@/components/ui/pagination';
import { useProductDelete } from '@/hooks/use-product-delete';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Category } from '@/lib/types/category';
import type { Product, ProductQueryParams } from '@/lib/types/product';

interface ProductsPageClientProps {
  initialData: PaginatedResponse<Product>;
  initialParams: ProductQueryParams;
  categories: Category[];
}

/**
 * 产品管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 * 参考客户管理页面实现，使用URL参数管理搜索状态
 */
export function ProductsPageClient({
  initialData,
  initialParams,
  categories,
}: ProductsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [categoryId, setCategoryId] = React.useState(
    initialParams.categoryId || ''
  );
  const [status, setStatus] = React.useState<'active' | 'inactive' | undefined>(
    initialParams.status
  );
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 对话框状态管理
  const [deleteDialog, setDeleteDialog] = React.useState({
    open: false,
    productId: null as string | null,
    productName: '',
  });
  const [batchDeleteDialog, setBatchDeleteDialog] = React.useState({
    open: false,
    products: [] as Product[],
  });
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>(
    []
  );

  // 防抖更新URL - 避免每次输入都触发导航
  // 参考Next.js官方最佳实践: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
  const debouncedUpdateURL = useDebouncedCallback(
    (
      searchValue: string,
      filters: { categoryId?: string; status?: string }
    ) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.categoryId) {
          params.set('categoryId', filters.categoryId);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        router.push(`/products?${params.toString()}`);
      });
    },
    300
  ); // 300ms防抖延迟，用户停止输入后才更新URL

  // 处理搜索 - 立即更新本地状态，防抖更新URL
  const handleSearch = (value: string) => {
    setSearch(value); // 立即更新，保持输入框响应流畅
    debouncedUpdateURL(value, { categoryId, status }); // 防抖更新URL和服务器数据
  };

  // 处理筛选 - 立即更新URL（筛选不需要防抖）
  const handleFilter = (filters: {
    categoryId?: string;
    status?: 'active' | 'inactive';
  }) => {
    if (filters.categoryId !== undefined) {
      setCategoryId(filters.categoryId);
    }
    if (filters.status !== undefined) {
      setStatus(filters.status);
    }

    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (filters.categoryId) {
        params.set('categoryId', filters.categoryId);
      }
      if (filters.status) {
        params.set('status', filters.status);
      }
      if (sortBy) {
        params.set('sortBy', sortBy);
      }
      if (sortOrder) {
        params.set('sortOrder', sortOrder);
      }
      router.push(`/products?${params.toString()}`);
    });
  };

  // 处理清空筛选
  const handleClearFilters = () => {
    setCategoryId('');
    setStatus(undefined);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (sortBy) {
        params.set('sortBy', sortBy);
      }
      if (sortOrder) {
        params.set('sortOrder', sortOrder);
      }
      router.push(`/products?${params.toString()}`);
    });
  };

  // 处理排序 - 更新URL参数触发服务器端重新获取数据
  const handleSortChange = (
    newSortBy: string,
    newSortOrder: 'asc' | 'desc'
  ) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (categoryId) {
        params.set('categoryId', categoryId);
      }
      if (status) {
        params.set('status', status);
      }
      params.set('sortBy', newSortBy);
      params.set('sortOrder', newSortOrder);
      router.push(`/products?${params.toString()}`);
    });
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (categoryId) {
        params.set('categoryId', categoryId);
      }
      if (status) {
        params.set('status', status);
      }
      if (sortBy) {
        params.set('sortBy', sortBy);
      }
      if (sortOrder) {
        params.set('sortOrder', sortOrder);
      }
      params.set('page', page.toString());
      router.push(`/products?${params.toString()}`);
    });
  };

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
      setSelectedProductIds([]);
    },
  });

  // 处理删除产品
  const handleDeleteProduct = (productId: string, productCode: string) => {
    setDeleteDialog({
      open: true,
      productId,
      productName: productCode,
    });
  };

  // 处理批量选择
  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds(prev => {
      if (checked) {
        return [...prev, productId];
      } else {
        return prev.filter(id => id !== productId);
      }
    });
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(initialData.data.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    const selectedProducts = initialData.data.filter(p =>
      selectedProductIds.includes(p.id)
    );
    setBatchDeleteDialog({
      open: true,
      products: selectedProducts,
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

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 工具栏 */}
        <ProductListToolbar
          selectedCount={selectedProductIds.length}
          onBatchDelete={handleBatchDelete}
        />

        {/* 搜索和筛选 */}
        <ProductSearchFilters
          searchValue={search}
          categoryId={categoryId}
          status={status}
          sortBy={sortBy}
          sortOrder={sortOrder}
          categories={categories}
          onSearchChange={handleSearch}
          onFilterChange={handleFilter}
          onSortChange={handleSortChange}
          onClearFilters={handleClearFilters}
        />

        {/* 产品表格 */}
        <ProductTable
          products={initialData.data}
          selectedProductIds={selectedProductIds}
          onSelectProduct={handleSelectProduct}
          onSelectAll={handleSelectAll}
          onDeleteProduct={handleDeleteProduct}
          isLoading={isPending}
        />

        {/* 分页 */}
        <Pagination
          currentPage={initialData.pagination.page}
          totalPages={initialData.pagination.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {/* 删除对话框 */}
      <ProductDeleteDialog
        open={deleteDialog.open}
        productName={deleteDialog.productName}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteDialog({ open: false, productId: null, productName: '' })
        }
      />

      {/* 批量删除对话框 */}
      <ProductBatchDeleteDialog
        open={batchDeleteDialog.open}
        products={batchDeleteDialog.products}
        isDeleting={isBatchDeleting}
        onConfirm={handleConfirmBatchDelete}
        onCancel={() => setBatchDeleteDialog({ open: false, products: [] })}
      />
    </div>
  );
}
