/**
 * 库存调整记录管理Hook
 * 管理调整记录的查询、筛选和分页
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getAdjustmentQueryOptions } from '@/lib/api/adjustments';
import type {
  AdjustmentQueryParams,
  InventoryAdjustment,
} from '@/lib/types/inventory';

export function useAdjustmentRecords() {
  // 查询参数状态
  const [queryParams, setQueryParams] = useState<AdjustmentQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 详情对话框状态
  const [selectedAdjustment, setSelectedAdjustment] =
    useState<InventoryAdjustment | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // 查询调整记录
  const { data, isLoading, error, refetch } = useQuery(
    getAdjustmentQueryOptions(queryParams)
  );

  const adjustments = data?.adjustments || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  // 更新查询参数
  const updateQueryParams = (newParams: Partial<AdjustmentQueryParams>) => {
    setQueryParams(prev => ({
      ...prev,
      ...newParams,
    }));
  };

  // 重置筛选条件
  const resetFilters = () => {
    setQueryParams({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  // 处理分页变更
  const handlePageChange = (page: number) => {
    updateQueryParams({ page });
  };

  // 处理页面大小变更
  const handlePageSizeChange = (limit: number) => {
    updateQueryParams({ page: 1, limit });
  };

  // 处理排序变更
  const handleSortChange = (
    sortBy: AdjustmentQueryParams['sortBy'],
    sortOrder: 'asc' | 'desc'
  ) => {
    updateQueryParams({ sortBy, sortOrder, page: 1 });
  };

  // 查看详情
  const viewDetail = (adjustment: InventoryAdjustment) => {
    setSelectedAdjustment(adjustment);
    setShowDetailDialog(true);
  };

  // 关闭详情对话框
  const closeDetailDialog = () => {
    setShowDetailDialog(false);
    setSelectedAdjustment(null);
  };

  return {
    // 数据
    adjustments,
    pagination,
    isLoading,
    error,
    queryParams,

    // 详情对话框
    selectedAdjustment,
    showDetailDialog,

    // 操作
    updateQueryParams,
    resetFilters,
    handlePageChange,
    handlePageSizeChange,
    handleSortChange,
    viewDetail,
    closeDetailDialog,
    refetch,
  };
}
