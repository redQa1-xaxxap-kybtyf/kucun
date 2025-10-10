'use client';

/**
 * 分类页面内容组件
 * 严格遵循全栈项目统一约定规范
 */

import { CategoryDeleteDialogs } from '@/components/categories/category-delete-dialogs';
import { CategoryList } from '@/components/categories/category-list';
import { CategoryPageHeader } from '@/components/categories/category-page-header';
import { CategorySearchFilters } from '@/components/categories/category-search-filters';
import { ContentLoading } from '@/components/common/loading';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { type Category, type CategoryQueryParams } from '@/lib/api/categories';

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface BatchDeleteDialogState {
  open: boolean;
  categories: Category[];
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
  selectedCategoryIds: string[];
  deleteDialog: DeleteDialogState;
  batchDeleteDialog: BatchDeleteDialogState;
  updatingStatusId: string | null;
  deleteMutation: {
    mutate: (id: string) => void;
    isPending: boolean;
  };
  batchDeleteMutation: {
    mutate: (input: { categoryIds: string[] }) => void;
    isPending: boolean;
  };
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialogState>>;
  setBatchDeleteDialog: React.Dispatch<
    React.SetStateAction<BatchDeleteDialogState>
  >;
  handleSearch: (value: string) => void;
  handleFilter: <K extends keyof CategoryQueryParams>(
    key: K,
    value: CategoryQueryParams[K]
  ) => void;
  handlePageChange: (page: number) => void;
  handleDeleteCategory: (categoryId: string, categoryName: string) => void;
  confirmDelete: () => void;
  handleSelectCategory: (categoryId: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  handleBatchDelete: () => void;
  confirmBatchDelete: () => void;
  toggleCategoryStatus: (category: Category) => void;
}

export function CategoryPageContent({
  isLoading,
  error,
  categories,
  pagination,
  queryParams,
  selectedCategoryIds,
  deleteDialog,
  batchDeleteDialog,
  updatingStatusId,
  deleteMutation,
  batchDeleteMutation,
  setDeleteDialog,
  setBatchDeleteDialog,
  handleSearch,
  handleFilter,
  handlePageChange,
  handleDeleteCategory,
  confirmDelete,
  handleSelectCategory,
  handleSelectAll,
  handleBatchDelete,
  confirmBatchDelete,
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
        <CategoryPageHeader
          selectedCategoryIds={selectedCategoryIds}
          onBatchDelete={handleBatchDelete}
          isBatchDeleting={batchDeleteMutation.isPending}
        />

        <CategorySearchFilters
          queryParams={queryParams}
          onSearch={handleSearch}
          onFilter={handleFilter}
        />

        <CategoryList
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          updatingStatusId={updatingStatusId}
          onSelectCategory={handleSelectCategory}
          onSelectAll={handleSelectAll}
          onToggleStatus={toggleCategoryStatus}
          onDeleteCategory={handleDeleteCategory}
          totalCount={categories.length}
        />

        {pagination && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange
            showTotal
          />
        )}

        <CategoryDeleteDialogs
          deleteDialog={deleteDialog}
          batchDeleteDialog={batchDeleteDialog}
          isDeleting={deleteMutation.isPending}
          isBatchDeleting={batchDeleteMutation.isPending}
          onDeleteDialogChange={setDeleteDialog}
          onBatchDeleteDialogChange={setBatchDeleteDialog}
          onConfirmDelete={confirmDelete}
          onConfirmBatchDelete={confirmBatchDelete}
        />
      </div>
    </div>
  );
}
