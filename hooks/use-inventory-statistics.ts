'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type {
  InventoryStatistics,
  InventoryStatisticsParams,
} from '@/lib/types/inventory-statistics';

/**
 * 获取库存统计数据的 Hook
 *
 * @param params - 查询参数（可选的分类筛选）
 * @returns 库存统计数据和查询状态
 */
export function useInventoryStatistics(params?: InventoryStatisticsParams) {
  return useQuery({
    queryKey: queryKeys.inventory.statistics(params),
    queryFn: async (): Promise<InventoryStatistics> => {
      const searchParams = new URLSearchParams();

      if (params?.categoryId) {
        searchParams.set('categoryId', params.categoryId);
      }

      const url = `/api/inventory/statistics${
        searchParams.toString() ? `?${searchParams.toString()}` : ''
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('获取库存统计失败');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取库存统计失败');
      }

      return result.data;
    },
    // 统计数据缓存 5 分钟
    staleTime: 5 * 60 * 1000,
    // 保持数据在后台更新
    refetchOnWindowFocus: true,
  });
}
