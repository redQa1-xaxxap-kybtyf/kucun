'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getInventoryAlerts, inventoryQueryKeys } from '@/lib/api/inventory';
import { inventoryConfig } from '@/lib/env';
import type { InventoryAlert } from '@/lib/types/inventory';

export function useInventoryAlerts(maxItems?: number) {
  const [showAll, setShowAll] = useState(false);

  // 获取库存预警
  const {
    data: alertsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: inventoryQueryKeys.alerts(),
    queryFn: getInventoryAlerts,
    refetchInterval: inventoryConfig.alertRefreshInterval,
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  // 处理数据
  const alerts = useMemo(() => alertsData || [], [alertsData]);

  const displayAlerts = useMemo(
    () => (maxItems && !showAll ? alerts.slice(0, maxItems) : alerts),
    [alerts, maxItems, showAll]
  );

  // 按类型分组统计
  const alertStats = useMemo(
    () =>
      alerts.reduce(
        (acc: Record<string, number>, alert: InventoryAlert) => {
          const alertType = alert.alertType || 'unknown';
          acc[alertType] = (acc[alertType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    [alerts]
  );

  const toggleShowAll = () => setShowAll(!showAll);

  return {
    alerts,
    displayAlerts,
    alertStats,
    isLoading,
    error,
    refetch,
    showAll,
    toggleShowAll,
    hasMore: maxItems ? alerts.length > maxItems : false,
  };
}
