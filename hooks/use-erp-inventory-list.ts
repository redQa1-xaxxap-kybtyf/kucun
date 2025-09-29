'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import type { Inventory } from '@/lib/types/inventory';

interface ERPInventoryListData {
  data: Inventory[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useERPInventoryList(
  data: ERPInventoryListData,
  onPageChange: (page: number) => void
) {
  const router = useRouter();
  const [selectedInventoryIds, setSelectedInventoryIds] = React.useState<
    Set<string>
  >(new Set());

  // 处理行选择（useCallback稳定引用）
  const handleRowSelect = React.useCallback(
    (inventoryId: string, checked: boolean) => {
      setSelectedInventoryIds(prev => {
        const next = new Set(prev);
        if (checked) {
          next.add(inventoryId);
        } else {
          next.delete(inventoryId);
        }
        return next;
      });
    },
    []
  );

  // 处理全选（useCallback稳定引用）
  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      const inventoryData = Array.isArray(data?.data) ? data.data : [];
      setSelectedInventoryIds(
        checked ? new Set(inventoryData.map(item => item.id)) : new Set()
      );
    },
    [data?.data]
  );

  // 优化的事件处理函数
  const handleAdjust = React.useCallback(
    (inventoryId?: string) => {
      if (inventoryId) {
        router.push(`/inventory/adjust?id=${inventoryId}`);
      } else {
        router.push('/inventory/adjust');
      }
    },
    [router]
  );

  const handleInbound = React.useCallback(() => {
    router.push('/inventory/inbound');
  }, [router]);

  const handleOutbound = React.useCallback(() => {
    router.push('/inventory/outbound');
  }, [router]);

  // 分页处理函数
  const handlePrevPage = React.useCallback(() => {
    if (data.pagination && data.pagination.page > 1) {
      onPageChange(data.pagination.page - 1);
    }
  }, [data.pagination, onPageChange]);

  const handleNextPage = React.useCallback(() => {
    if (data.pagination && data.pagination.page < data.pagination.totalPages) {
      onPageChange(data.pagination.page + 1);
    }
  }, [data.pagination, onPageChange]);

  // 计算状态
  const hasData = data?.data && data.data.length > 0;
  const selectedCount = selectedInventoryIds.size;
  const canSelectAll = hasData;
  const isAllSelected =
    hasData && selectedInventoryIds.size === data.data.length;

  return {
    selectedInventoryIds,
    selectedCount,
    hasData,
    canSelectAll,
    isAllSelected,
    handleRowSelect,
    handleSelectAll,
    handleAdjust,
    handleInbound,
    handleOutbound,
    handlePrevPage,
    handleNextPage,
  };
}
