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
    selectedCategoryIds,
    deleteDialog,
    batchDeleteDialog,
    updatingStatusId,
    setQueryParams,
    setSelectedCategoryIds,
    setDeleteDialog,
    setBatchDeleteDialog,
    setUpdatingStatusId,
    deleteMutation,
    batchDeleteMutation,
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
    handleSelectCategory,
    handleSelectAll,
    handleBatchDelete,
    confirmBatchDelete,
    toggleCategoryStatus,
  } = useCategoryActions({
    queryParams,
    setQueryParams,
    selectedCategoryIds,
    setSelectedCategoryIds,
    deleteDialog,
    setDeleteDialog,
    setBatchDeleteDialog,
    setUpdatingStatusId,
    statusMutation,
    deleteMutation,
    batchDeleteMutation,
    categories,
  });

  return (
    <CategoryPageContent
      isLoading={isLoading}
      error={error}
      categories={categories}
      pagination={pagination}
      queryParams={queryParams}
      selectedCategoryIds={selectedCategoryIds}
      deleteDialog={deleteDialog}
      batchDeleteDialog={batchDeleteDialog}
      updatingStatusId={updatingStatusId}
      deleteMutation={deleteMutation}
      batchDeleteMutation={batchDeleteMutation}
      setDeleteDialog={setDeleteDialog}
      setBatchDeleteDialog={setBatchDeleteDialog}
      handleSearch={handleSearch}
      handleFilter={handleFilter}
      handlePageChange={handlePageChange}
      handleDeleteCategory={handleDeleteCategory}
      confirmDelete={confirmDelete}
      handleSelectCategory={handleSelectCategory}
      handleSelectAll={handleSelectAll}
      handleBatchDelete={handleBatchDelete}
      confirmBatchDelete={confirmBatchDelete}
      toggleCategoryStatus={toggleCategoryStatus}
    />
  );
}
