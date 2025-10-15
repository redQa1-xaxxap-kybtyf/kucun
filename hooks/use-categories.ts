'use client';

/**
 * 分类管理自定义Hook
 * 严格遵循全栈项目统一约定规范
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import {
  categoryQueryKeys,
  deleteCategory,
  getCategories,
  updateCategoryStatus,
  type Category,
  type CategoryQueryParams,
} from '@/lib/api/categories';
import type { PaginatedResponse } from '@/lib/types/api';
import { showError, showSuccess } from '@/lib/utils/toast-helper';

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

export function useCategories(initialParams?: CategoryQueryParams) {
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

  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
    open: false,
    categoryId: null,
    categoryName: '',
  });

  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(
    null
  );

  const { data, isLoading, error } = useQuery<PaginatedResponse<Category>>({
    queryKey: categoryQueryKeys.list({
      ...queryParams,
      parentId: queryParams.parentId ?? undefined,
    }),
    queryFn: () => getCategories(queryParams),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
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

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'active' | 'inactive';
    }) => updateCategoryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
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
    deleteDialog,
    updatingStatusId,

    // 状态设置
    setQueryParams,
    setDeleteDialog,
    setUpdatingStatusId,

    // 变更操作
    deleteMutation,
    statusMutation,
  };
}
