'use client';

/**
 * 分类管理页面
 * 严格遵循全栈项目统一约定规范
 */

import { CategoryPageContent } from '@/components/categories/category-page-content';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryActions } from '@/hooks/use-category-actions';

/**
 * 分类管理页面组件
 */
function CategoriesPage() {
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
  } = useCategories();

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

export default CategoriesPage;
