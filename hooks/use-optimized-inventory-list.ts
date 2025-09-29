'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { paginationConfig } from '@/lib/env';
import type {
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';

export function useOptimizedInventoryList(
  initialParams: Partial<InventoryQueryParams> = {}
) {
  const router = useRouter();

  // 查询参数状态
  const [queryParams, setQueryParams] = React.useState<InventoryQueryParams>({
    page: 1,
    limit: paginationConfig.defaultPageSize,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...initialParams,
  });

  // 选中的库存ID
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // 使用优化的查询Hook
  const { data, isLoading, isError, error, cache } = useOptimizedInventoryQuery(
    {
      params: queryParams,
      staleTime: 30000,
    }
  );

  // 优化的搜索处理函数
  const handleSearch = React.useCallback((value: string) => {
    setQueryParams(prev => ({
      ...prev,
      search: value,
      page: 1, // 重置到第一页
    }));
  }, []);

  // 优化的筛选处理函数
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      setQueryParams(prev => ({
        ...prev,
        [key]: value,
        page: 1, // 重置到第一页
      }));
    },
    []
  );

  // 优化的分页处理函数
  const handlePageChange = React.useCallback((page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  }, []);

  // 优化的导航处理函数
  const navigationHandlers = React.useMemo(
    () => ({
      handleInbound: () => router.push('/inventory/inbound'),
      handleOutbound: () => router.push('/inventory/outbound'),
      handleAdjust: (inventoryId?: string) => {
        const path = inventoryId
          ? `/inventory/adjust/${inventoryId}`
          : '/inventory/adjust';
        router.push(path);
      },
    }),
    [router]
  );

  // 优化的选择处理函数
  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      const responseData = data as InventoryListResponse;
      if (checked && responseData?.data?.inventories) {
        setSelectedIds(responseData.data.inventories.map(item => item.id));
      } else {
        setSelectedIds([]);
      }
    },
    [data]
  );

  const handleSelectRow = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) {
        return [...prev, id];
      } else {
        return prev.filter(selectedId => selectedId !== id);
      }
    });
  }, []);

  // 使用useMemo优化计算
  const inventoryData = React.useMemo(() => {
    const responseData = data as InventoryListResponse;
    return responseData?.data?.inventories || [];
  }, [data]);

  const pagination = React.useMemo(() => {
    const responseData = data as InventoryListResponse;
    return responseData?.data?.pagination;
  }, [data]);

  return {
    queryParams,
    selectedIds,
    inventoryData,
    pagination,
    isLoading,
    isError,
    error,
    cache,
    handleSearch,
    handleFilter,
    handlePageChange,
    ...navigationHandlers,
    handleSelectAll,
    handleSelectRow,
  };
}
