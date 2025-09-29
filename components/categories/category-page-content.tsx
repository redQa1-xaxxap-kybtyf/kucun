'use client';

/**
 * 分类页面内容组件
 * 严格遵循全栈项目统一约定规范
 */

import React from 'react';

import { CategoryDeleteDialogs } from '@/components/categories/category-delete-dialogs';
import { CategoryList } from '@/components/categories/category-list';
import { CategoryPageHeader } from '@/components/categories/category-page-header';
import { CategoryPagination } from '@/components/categories/category-pagination';
import { CategorySearchFilters } from '@/components/categories/category-search-filters';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type Category } from '@/lib/api/categories';

interface CategoryPageContentProps {
  isLoading: boolean;
  error: Error | null;
  categories: Category[];
  pagination: any;
  queryParams: any;
  selectedCategoryIds: string[];
  deleteDialog: any;
  batchDeleteDialog: any;
  updatingStatusId: string | null;
  deleteMutation: any;
  batchDeleteMutation: any;
  setDeleteDialog: (state: any) => void;
  setBatchDeleteDialog: (state: any) => void;
  handleSearch: (value: string) => void;
  handleFilter: (key: string, value: any) => void;
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
        <CategoryPagination
          pagination={pagination}
          onPageChange={handlePageChange}
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
  );
}
