'use client';

/**
 * 分类页面内容组件
 * 严格遵循全栈项目统一约定规范
 */

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

import { CategoryPageHeader } from '@/components/categories/category-page-header';
import { CategorySearchFilters } from '@/components/categories/category-search-filters';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { type Category, type CategoryQueryParams } from '@/lib/api/categories';
import { cn } from '@/lib/utils';

const CategoryList = dynamic(
  () =>
    import('@/components/categories/category-list').then(
      mod => mod.CategoryList
    ),
  {
    ssr: false,
    loading: () => <TableSkeleton columns={6} rows={8} showPagination />,
  }
);

const CategoryDeleteDialogs = dynamic(
  () =>
    import('@/components/categories/category-delete-dialogs').then(
      mod => mod.CategoryDeleteDialogs
    ),
  { ssr: false, loading: () => null }
);

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface CategoryPageContentProps {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  categories: Category[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  queryParams: CategoryQueryParams;
  deleteDialog: DeleteDialogState;
  updatingStatusId: string | null;
  deleteMutation: {
    mutate: (id: string) => void;
    isPending: boolean;
  };
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialogState>>;
  searchValue?: string;
  isSearching?: boolean;
  onSearchChange?: (value: string) => void;
  handleSearch: (value: string) => void;
  handleFilter: <K extends keyof CategoryQueryParams>(
    key: K,
    value: CategoryQueryParams[K]
  ) => void;
  handlePageChange: (page: number) => void;
  handleDeleteCategory: (categoryId: string, categoryName: string) => void;
  confirmDelete: () => void;
  toggleCategoryStatus: (category: Category) => void;
}

export function CategoryPageContent({
  isLoading,
  isFetching,
  error,
  categories,
  pagination,
  queryParams,
  deleteDialog,
  updatingStatusId,
  deleteMutation,
  setDeleteDialog,
  searchValue,
  isSearching = false,
  onSearchChange,
  handleSearch,
  handleFilter,
  handlePageChange,
  handleDeleteCategory,
  confirmDelete,
  toggleCategoryStatus,
}: CategoryPageContentProps) {
  const isInitialLoading = isLoading && categories.length === 0;
  const isListRefreshing = !isInitialLoading && isFetching;
  const showErrorState = Boolean(error && categories.length === 0);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="space-y-6">
        <CategoryPageHeader />

        <CategorySearchFilters
          queryParams={queryParams}
          searchValue={searchValue}
          isSearching={isSearching || isListRefreshing}
          onSearchChange={onSearchChange}
          onSearch={handleSearch}
          onFilter={handleFilter}
        />

        <div
          className="relative"
          aria-busy={isInitialLoading || isListRefreshing}
        >
          {isListRefreshing && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
              正在更新
            </div>
          )}

          <div
            className={cn(
              'transition-opacity',
              isListRefreshing && 'opacity-60'
            )}
          >
            {showErrorState ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-red-600">
                    加载失败:{' '}
                    {error instanceof Error ? error.message : '未知错误'}
                  </div>
                </CardContent>
              </Card>
            ) : isInitialLoading ? (
              <TableSkeleton columns={6} rows={8} showPagination />
            ) : (
              <CategoryList
                categories={categories}
                updatingStatusId={updatingStatusId}
                onToggleStatus={toggleCategoryStatus}
                onDeleteCategory={handleDeleteCategory}
              />
            )}
          </div>
        </div>

        {pagination && !isInitialLoading && !showErrorState && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange
            showTotal
            disabled={isListRefreshing}
          />
        )}

        {deleteDialog.open ? (
          <CategoryDeleteDialogs
            deleteDialog={deleteDialog}
            isDeleting={deleteMutation.isPending}
            onDeleteDialogChange={setDeleteDialog}
            onConfirmDelete={confirmDelete}
          />
        ) : null}
      </div>
    </div>
  );
}
