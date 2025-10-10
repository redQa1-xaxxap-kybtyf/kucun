/**
 * 优化的库存查询Hook
 * 统一查询键命名规范，实现数据预取策略，优化分页查询缓存
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type {
  Inventory,
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';

// 统一的查询键工厂
export const inventoryQueryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryQueryKeys.all, 'list'] as const,
  list: (params: InventoryQueryParams) =>
    [...inventoryQueryKeys.lists(), params] as const,
  details: () => [...inventoryQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryQueryKeys.details(), id] as const,
  stats: () => [...inventoryQueryKeys.all, 'stats'] as const,
  alerts: () => [...inventoryQueryKeys.all, 'alerts'] as const,
};

interface UseOptimizedInventoryQueryOptions {
  /** 查询参数 */
  params: InventoryQueryParams;
  /** 是否启用查询 */
  enabled?: boolean;
  /** 缓存时间（毫秒）- 数据被视为新鲜的时间，在此期间不会重新请求 */
  staleTime?: number;
  /** 垃圾回收时间（毫秒）- 未使用的缓存被清理的时间 */
  cacheTime?: number;
}

/**
 * 优化的库存列表查询Hook
 *
 * ✅ Next.js 15.4 + TanStack Query v5 最佳实践：
 * - 服务端通过 HydrationBoundary 预取数据
 * - 客户端使用相同的 queryKey 获取缓存数据
 * - 配置 staleTime=Infinity 防止首次渲染时重新请求
 * - 后续交互（翻页、筛选）会自动触发新请求
 * - 预取策略改为按需触发，避免不必要的请求
 */
export function useOptimizedInventoryQuery({
  params,
  enabled = true,
  staleTime = Infinity, // 防止客户端重复请求服务端已预取的数据
  cacheTime = 10 * 60 * 1000, // 10分钟
}: UseOptimizedInventoryQueryOptions) {
  const queryClient = useQueryClient();

  // 主查询
  const query = useQuery<InventoryListResponse>({
    queryKey: inventoryQueryKeys.list(params),
    queryFn: async (): Promise<InventoryListResponse> => {
      const searchParams = new URLSearchParams();

      // 构建查询参数
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(`/api/inventory?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`库存查询失败: ${response.statusText}`);
      }

      return response.json();
    },
    enabled,
    staleTime, // 数据新鲜度时间 - Infinity 表示永不过期（除非手动 invalidate）
    gcTime: cacheTime, // 垃圾回收时间
    // ✅ 修复：移除 placeholderData，避免数据切换时的闪烁
    // 使用 React 的 useTransition 在父组件中处理加载状态
    // 错误重试配置
    retry: (failureCount, error) => {
      // 4xx错误不重试
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // ✅ 按需预取策略 - 由组件层基于用户交互触发
  const prefetchPage = useCallback(
    async (pageParams: InventoryQueryParams) => {
      await queryClient.prefetchQuery({
        queryKey: inventoryQueryKeys.list(pageParams),
        queryFn: async (): Promise<InventoryListResponse> => {
          const searchParams = new URLSearchParams();

          Object.entries(pageParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              searchParams.append(key, String(value));
            }
          });

          const response = await fetch(
            `/api/inventory?${searchParams.toString()}`
          );
          if (!response.ok) {
            throw new Error(`库存查询失败: ${response.statusText}`);
          }

          return response.json();
        },
        staleTime: 5 * 60 * 1000, // 预取数据缓存5分钟
      });
    },
    [queryClient]
  );

  // ✅ 提供便捷的预取方法，供组件使用
  const prefetchNextPage = useCallback(() => {
    const pagination = query.data?.pagination;
    if (!pagination) return;

    const { page, totalPages } = pagination;
    if (page < totalPages) {
      prefetchPage({ ...params, page: page + 1 });
    }
  }, [query.data?.pagination, params, prefetchPage]);

  const prefetchPrevPage = useCallback(() => {
    const pagination = query.data?.pagination;
    if (!pagination) return;

    const { page } = pagination;
    if (page > 1) {
      prefetchPage({ ...params, page: page - 1 });
    }
  }, [query.data?.pagination, params, prefetchPage]);

  // 缓存优化工具
  const cacheUtils = useMemo(
    () => ({
      // 使查询无效
      invalidate: () => {
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() });
      },

      // 移除特定查询缓存
      remove: (queryParams?: InventoryQueryParams) => {
        if (queryParams) {
          queryClient.removeQueries({
            queryKey: inventoryQueryKeys.list(queryParams),
          });
        } else {
          queryClient.removeQueries({ queryKey: inventoryQueryKeys.lists() });
        }
      },

      // 设置查询数据
      setData: (
        queryParams: InventoryQueryParams,
        data: InventoryListResponse
      ) => {
        queryClient.setQueryData(inventoryQueryKeys.list(queryParams), data);
      },

      // 获取缓存数据
      getData: (queryParams: InventoryQueryParams) =>
        queryClient.getQueryData<InventoryListResponse>(
          inventoryQueryKeys.list(queryParams)
        ),

      // 预取指定页面
      prefetch: prefetchPage,

      // 清理所有库存相关缓存
      clear: () => {
        queryClient.removeQueries({ queryKey: inventoryQueryKeys.all });
      },
    }),
    [queryClient, prefetchPage]
  );

  return {
    ...query,
    cache: cacheUtils,
    // ✅ 暴露预取方法供组件使用（基于用户交互触发）
    prefetchNextPage,
    prefetchPrevPage,
    prefetchPage,
  };
}

/**
 * 库存详情查询Hook
 */
export function useInventoryDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.detail(id),
    queryFn: async (): Promise<Inventory> => {
      const response = await fetch(`/api/inventory/${id}`);
      if (!response.ok) {
        throw new Error(`库存详情查询失败: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000, // 2分钟
    gcTime: 5 * 60 * 1000, // 5分钟
  });
}

/**
 * 库存统计查询Hook
 */
export function useInventoryStats(enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.stats(),
    queryFn: async () => {
      const response = await fetch('/api/inventory/stats');
      if (!response.ok) {
        throw new Error(`库存统计查询失败: ${response.statusText}`);
      }
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 库存预警查询Hook
 */
export function useInventoryAlerts(enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.alerts(),
    queryFn: async () => {
      const response = await fetch('/api/inventory/alerts');
      if (!response.ok) {
        throw new Error(`库存预警查询失败: ${response.statusText}`);
      }
      return response.json();
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2分钟
    gcTime: 5 * 60 * 1000, // 5分钟
    refetchInterval: 5 * 60 * 1000, // 每5分钟自动刷新
  });
}

/**
 * 库存操作Mutation Hook
 */
export function useInventoryMutations() {
  const queryClient = useQueryClient();

  const adjustMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      adjustment: number;
      reason?: string;
    }) => {
      const response = await fetch(`/api/inventory/${data.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`库存调整失败: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // 使所有库存相关查询无效
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });

  return {
    adjust: adjustMutation,
  };
}
