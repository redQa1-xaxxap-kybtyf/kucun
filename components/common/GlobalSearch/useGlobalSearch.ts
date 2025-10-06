/**
 * 全局搜索逻辑 Hook
 * 封装搜索状态管理和 TanStack Query 集成
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { SEARCH_CONFIG } from '@/lib/config/search';

import { searchAll, type SearchResultItem } from './searchApi';

export function useGlobalSearch() {
  const [query, setQuery] = useState('');

  // 使用 TanStack Query 管理搜索请求
  const {
    data: results = [],
    isLoading,
    error,
  } = useQuery<SearchResultItem[], Error>({
    queryKey: ['global-search', query.trim()],
    queryFn: async ({ signal }) => {
      if (!query.trim()) {
        return [];
      }
      return searchAll(query.trim(), signal);
    },
    enabled: query.trim().length > 0,
    staleTime: SEARCH_CONFIG.CACHE.STALE_TIME,
    gcTime: SEARCH_CONFIG.CACHE.GC_TIME,
    retry: SEARCH_CONFIG.RETRY.COUNT,
    retryDelay: SEARCH_CONFIG.RETRY.DELAY,
  });

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
  };
}
