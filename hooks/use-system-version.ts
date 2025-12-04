/**
 * 系统版本号获取 Hook
 * 统一管理版本号获取逻辑，遵循 DRY 原则
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';

/**
 * 获取系统版本号
 * @returns 版本号字符串，失败时返回默认值 '1.0.0'
 */
export function useSystemVersion() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.settings.basic(),
    queryFn: async () => {
      const response = await fetch('/api/settings/basic');
      const result: SettingsApiResponse<BasicSettings> = await response.json();

      if (!result.success || !result.data) {
        throw new Error('获取系统版本失败');
      }

      return result.data;
    },
    staleTime: 30 * 60 * 1000, // 30分钟缓存
    retry: 3,
    retryDelay: 1000,
  });

  return {
    version: data?.systemVersion || '1.0.0',
    systemName: data?.systemName || '库存管理系统',
    isLoading,
    error,
  };
}
