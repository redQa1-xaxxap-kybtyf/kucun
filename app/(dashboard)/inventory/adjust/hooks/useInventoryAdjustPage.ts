/**
 * 库存调整页面的自定义Hook
 * 管理页面状态、数据获取和操作逻辑
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getInventories, inventoryQueryKeys } from '@/lib/api/inventory';
import type { InventoryQueryParams } from '@/lib/types/inventory';

export function useInventoryAdjustPage() {
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);

  // 获取库存数据 - 用于显示当前库存状态
  const queryParams: InventoryQueryParams = {
    page: 1,
    limit: 50,
    hasStock: true, // 只显示有库存的记录
    includeVariants: true, // 包含变体信息以显示SKU
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: inventoryQueryKeys.list(queryParams),
    queryFn: () => getInventories(queryParams),
  });

  const inventoryRecords = data?.data || [];

  // 处理调整成功
  const handleAdjustSuccess = () => {
    setShowAdjustDialog(false);
    refetch();
  };

  // 打开调整对话框
  const openAdjustDialog = () => {
    setShowAdjustDialog(true);
  };

  // 关闭调整对话框
  const closeAdjustDialog = () => {
    setShowAdjustDialog(false);
  };

  return {
    // 状态
    showAdjustDialog,

    // 数据
    inventoryRecords,
    isLoading,
    error,

    // 操作
    handleAdjustSuccess,
    openAdjustDialog,
    closeAdjustDialog,
    refetch,
  };
}
