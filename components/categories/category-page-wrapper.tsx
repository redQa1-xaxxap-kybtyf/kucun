'use client';

import { CategoryPageContent } from '@/components/categories/category-page-content';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryActions } from '@/hooks/use-category-actions';
import type { Category, CategoryQueryParams } from '@/lib/api/categories';
import type { PaginatedResponse } from '@/lib/types/api';

interface CategoryPageWrapperProps {
  initialData?: PaginatedResponse<Category>;
  initialParams?: CategoryQueryParams;
}

/**
 * 分类页面客户端包装组件
 * 处理客户端交互和状态管理
 */
export function CategoryPageWrapper({
  initialData,
  initialParams,
}: CategoryPageWrapperProps) {
  const {
    data,
    isLoading,
    error,
    queryParams,
    deleteDialog,
    updatingStatusId,
    setQueryParams,
    setDeleteDialog,
    setUpdatingStatusId,
    deleteMutation,
    statusMutation,
  } = useCategories(initialData, initialParams);

  const categories = data?.data || [];
  const pagination = data?.pagination;

  const {
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDeleteCategory,
    confirmDelete,
    toggleCategoryStatus,
  } = useCategoryActions({
    queryParams,
    setQueryParams,
    deleteDialog,
    setDeleteDialog,
    setUpdatingStatusId,
    statusMutation,
    deleteMutation,
  });

  return (
    <CategoryPageContent
      isLoading={isLoading}
      error={error}
      categories={categories}
      pagination={pagination}
      queryParams={queryParams}
      deleteDialog={deleteDialog}
      updatingStatusId={updatingStatusId}
      deleteMutation={deleteMutation}
      setDeleteDialog={setDeleteDialog}
      handleSearch={handleSearch}
      handleFilter={handleFilter}
      handlePageChange={handlePageChange}
      handleDeleteCategory={handleDeleteCategory}
      confirmDelete={confirmDelete}
      toggleCategoryStatus={toggleCategoryStatus}
    />
  );
}
