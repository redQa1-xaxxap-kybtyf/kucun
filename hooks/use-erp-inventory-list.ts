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
      const firstSelected =
        selectedInventoryIds.size > 0
          ? Array.from(selectedInventoryIds)[0]
          : undefined;
      const fallbackFirst = data?.data?.[0]?.id;
      const targetId = inventoryId ?? firstSelected ?? fallbackFirst;

      if (!targetId) {
        return;
      }

      const inventory = data?.data.find(item => item.id === targetId);
      if (!inventory || !inventory.batchNumber) {
        return;
      }

      const params = new URLSearchParams();
      params.set('inventoryId', targetId);
      if (inventory.productId) {
        params.set('productId', inventory.productId);
      }
      if (inventory.variantId) {
        params.set('variantId', inventory.variantId);
      } else {
        params.set('variantId', 'null');
      }

      router.push(
        `/inventory/batch/${encodeURIComponent(inventory.batchNumber)}/history?${params.toString()}`
      );
    },
    [data?.data, router, selectedInventoryIds]
  );

  // 分页处理函数
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
  };
}
