'use client';

/**
 * 分类页面内容组件
 * 严格遵循全栈项目统一约定规范
 */

import dynamic from 'next/dynamic';

import { CategoryPageHeader } from '@/components/categories/category-page-header';
import { CategorySearchFilters } from '@/components/categories/category-search-filters';
import { ContentLoading } from '@/components/common/loading';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { type Category, type CategoryQueryParams } from '@/lib/api/categories';

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
  error,
  categories,
  pagination,
  queryParams,
  deleteDialog,
  updatingStatusId,
  deleteMutation,
  setDeleteDialog,
  handleSearch,
  handleFilter,
  handlePageChange,
  handleDeleteCategory,
  confirmDelete,
  toggleCategoryStatus,
}: CategoryPageContentProps) {
  // 加载状态
  if (isLoading) {
    return <ContentLoading text="加载分类列表中..." />;
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">分类管理</h1>
          <p className="text-muted-foreground">管理产品分类和层级结构</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="space-y-6">
        <CategoryPageHeader />

        <CategorySearchFilters
          queryParams={queryParams}
          onSearch={handleSearch}
          onFilter={handleFilter}
        />

        <CategoryList
          categories={categories}
          updatingStatusId={updatingStatusId}
          onToggleStatus={toggleCategoryStatus}
          onDeleteCategory={handleDeleteCategory}
        />

        {pagination && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange
            showTotal
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
