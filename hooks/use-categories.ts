'use client';

/**
 * 分类管理自定义Hook
 * 严格遵循全栈项目统一约定规范
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import {
  batchDeleteCategories,
  deleteCategory,
  getCategories,
  updateCategoryStatus,
  type Category,
  type CategoryQueryParams,
} from '@/lib/api/categories';
import { queryKeys } from '@/lib/queryKeys';
import type { PaginatedResponse } from '@/lib/types/api';
import { showError, showSuccess } from '@/lib/utils/toast-helper';

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface BatchDeleteDialogState {
  open: boolean;
  categories: Category[];
}

export function useCategories(
  initialData?: PaginatedResponse<Category>,
  initialParams?: CategoryQueryParams
) {
  const queryClient = useQueryClient();

  const [queryParams, setQueryParams] = React.useState<CategoryQueryParams>(
    initialParams || {
      page: 1,
      limit: 10,
      search: '',
      status: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
  );

  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<
    string[]
  >([]);

  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
    open: false,
    categoryId: null,
    categoryName: '',
  });

  const [batchDeleteDialog, setBatchDeleteDialog] =
    React.useState<BatchDeleteDialogState>({
      open: false,
      categories: [],
    });

  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(
    null
  );

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.categories.list(queryParams),
    queryFn: () => getCategories(queryParams),
    initialData, // 使用服务端预取的数据
    staleTime: 0, // 数据立即过期，确保能及时刷新
    refetchOnMount: true, // 重新挂载时刷新数据
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData, // 保持上一次数据
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
      setSelectedCategoryIds([]);
      showSuccess('删除成功', {
        description: '分类删除成功！相关数据已清理完毕。',
      });
    },
    onError: (error: Error) => {
      showError('删除失败', {
        description: error.message || '删除分类时发生错误，请重试。',
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteCategories,
    onSuccess: (_, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setBatchDeleteDialog({ open: false, categories: [] });
      setSelectedCategoryIds([]);
      showSuccess('批量删除成功', {
        description: `成功删除 ${deletedIds.categoryIds.length} 个分类！`,
      });
    },
    onError: (error: Error) => {
      showError('批量删除失败', {
        description: error.message || '批量删除分类时发生错误，请重试。',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'active' | 'inactive';
    }) => updateCategoryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setUpdatingStatusId(null);
      showSuccess('状态更新成功', {
        description: '分类状态已更新！',
      });
    },
    onError: (error: Error) => {
      setUpdatingStatusId(null);
      showError('状态更新失败', {
        description: error.message || '更新分类状态时发生错误，请重试。',
      });
    },
  });

  return {
    // 数据
    data,
    isLoading,
    error,
    queryParams,
    selectedCategoryIds,
    deleteDialog,
    batchDeleteDialog,
    updatingStatusId,

    // 状态设置
    setQueryParams,
    setSelectedCategoryIds,
    setDeleteDialog,
    setBatchDeleteDialog,
    setUpdatingStatusId,

    // 变更操作
    deleteMutation,
    batchDeleteMutation,
    statusMutation,
  };
}
