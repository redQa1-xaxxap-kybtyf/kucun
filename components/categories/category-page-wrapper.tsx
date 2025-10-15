'use client';

import { CategoryPageContent } from '@/components/categories/category-page-content';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryActions } from '@/hooks/use-category-actions';
import type { CategoryQueryParams } from '@/lib/api/categories';

interface CategoryPageWrapperProps {
  initialParams?: CategoryQueryParams;
}

/**
 * 分类页面客户端包装组件
 * 处理客户端交互和状态管理
 */
export function CategoryPageWrapper({
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
  } = useCategories(initialParams);

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
