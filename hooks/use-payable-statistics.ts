/**
 * 应付款统计数据 Hook
 * 根据筛选条件动态获取统计数据
 */

import { useQuery } from '@tanstack/react-query';

import type { PayableRecordQuery, PayableStatistics } from '@/lib/types/payable';

interface UsePayableStatisticsOptions {
  filters?: PayableRecordQuery;
  enabled?: boolean;
}

/**
 * 获取应付款统计数据
 * @param options - 配置选项
 * @param options.filters - 筛选条件（与列表查询相同）
 * @param options.enabled - 是否启用查询
 */
export function usePayableStatistics({
  filters = {},
  enabled = true,
}: UsePayableStatisticsOptions = {}) {
  return useQuery({
    queryKey: ['payables', 'statistics', filters],
    queryFn: async () => {
      // 构建查询参数
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.supplierId) params.set('supplierId', filters.supplierId);
      if (filters.status) params.set('status', filters.status);
      if (filters.sourceType) params.set('sourceType', filters.sourceType);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const url = `/api/finance/payables/statistics${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('获取应付款统计失败');
      }

      const result = await response.json();
      return result.data as PayableStatistics;
    },
    enabled,
    staleTime: 30000, // 30秒内认为数据是新鲜的
    gcTime: 5 * 60 * 1000, // 5分钟后清除缓存
  });
}

