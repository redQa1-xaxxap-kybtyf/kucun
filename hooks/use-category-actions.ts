'use client';

/**
 * 分类操作自定义Hook
 * 严格遵循全栈项目统一约定规范
 */

import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

import { type Category, type CategoryQueryParams } from '@/lib/api/categories';

interface DialogState {
  open: boolean;
  categoryId?: string;
}

interface UseCategoryActionsProps {
  queryParams: CategoryQueryParams;
  setQueryParams: (params: CategoryQueryParams) => void;
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (ids: string[]) => void;
  setDeleteDialog: (state: DialogState) => void;
  setBatchDeleteDialog: (state: { open: boolean }) => void;
  setUpdatingStatusId: (id: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusMutation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteMutation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  batchDeleteMutation: any;
  categories: Category[];
}

export function useCategoryActions({
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
}: UseCategoryActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 同步URL参数
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const newParams: CategoryQueryParams = {
      page: Number(params.get('page')) || 1,
      limit: Number(params.get('limit')) || 10,
      search: params.get('search') || '',
      status: (params.get('status') as 'active' | 'inactive') || undefined,
      sortBy:
        (params.get('sortBy') as 'name' | 'code' | 'sortOrder' | 'createdAt') ||
        'createdAt',
      sortOrder: (params.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    setQueryParams(newParams);
  }, [searchParams, setQueryParams]);

  const updateURL = React.useCallback(
    (newParams: Partial<CategoryQueryParams>) => {
      const params = new URLSearchParams();
      const finalParams = { ...queryParams, ...newParams };

      Object.entries(finalParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          params.set(key, String(value));
        }
      });

      router.push(`/categories?${params.toString()}`);
    },
    [queryParams, router]
  );

  const handleSearch = React.useCallback(
    (search: string) => {
      updateURL({ search, page: 1 });
    },
    [updateURL]
  );

  const handleFilter = React.useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      updateURL({ [key]: value, page: 1 });
    },
    [updateURL]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      updateURL({ page });
    },
    [updateURL]
  );

  const handleDeleteCategory = React.useCallback(
    (categoryId: string, categoryName: string) => {
      setDeleteDialog({ open: true, categoryId, categoryName });
    },
    [setDeleteDialog]
  );

  const confirmDelete = React.useCallback(() => {
    const categoryId = selectedCategoryIds[0];
    if (categoryId) {
      deleteMutation.mutate(categoryId);
    }
  }, [selectedCategoryIds, deleteMutation]);

  const handleSelectCategory = React.useCallback(
    (categoryId: string, checked: boolean) => {
      setSelectedCategoryIds(
        checked
          ? [...selectedCategoryIds, categoryId]
          : selectedCategoryIds.filter(id => id !== categoryId)
      );
    },
    [selectedCategoryIds, setSelectedCategoryIds]
  );

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      setSelectedCategoryIds(
        checked ? categories.map(category => category.id) : []
      );
    },
    [categories, setSelectedCategoryIds]
  );

  const handleBatchDelete = React.useCallback(() => {
    const selectedCategories = categories.filter(category =>
      selectedCategoryIds.includes(category.id)
    );
    setBatchDeleteDialog({ open: true, categories: selectedCategories });
  }, [categories, selectedCategoryIds, setBatchDeleteDialog]);

  const confirmBatchDelete = React.useCallback(() => {
    if (selectedCategoryIds.length > 0) {
      batchDeleteMutation.mutate(selectedCategoryIds);
    }
  }, [selectedCategoryIds, batchDeleteMutation]);

  const toggleCategoryStatus = React.useCallback(
    (category: Category) => {
      setUpdatingStatusId(category.id);
      const newStatus = category.status === 'active' ? 'inactive' : 'active';
      statusMutation.mutate({ id: category.id, status: newStatus });
    },
    [setUpdatingStatusId, statusMutation]
  );

  return {
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
  };
}
