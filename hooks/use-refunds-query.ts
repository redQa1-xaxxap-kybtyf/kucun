'use client';

/**
 * 退款列表查询 Hook
 * 统一使用 TanStack Query + HydrationBoundary 模式
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { financeKeys } from '@/lib/queryKeys';
import type { RefundListData, RefundListQueryParams } from '@/lib/types/refund';

interface UseRefundsQueryOptions {
  params: RefundListQueryParams;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

/**
 * 退款列表查询 Hook
 *
 * ✅ 特性：
 * - 与服务端 HydrationBoundary 共用同一 queryKey
 * - 默认避免刷新时的重复请求（staleTime=Infinity）
 * - 提供预取能力，支持分页预取
 */
export function useRefundsQuery({
  params,
  enabled = true,
  staleTime = Infinity,
  cacheTime = 10 * 60 * 1000,
}: UseRefundsQueryOptions) {
  const queryClient = useQueryClient();

  const query = useQuery<RefundListData>({
    queryKey: financeKeys.refundsList(params),
    queryFn: async (): Promise<RefundListData> => {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(
        `/api/finance/refunds?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`获取退款列表失败: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取退款列表失败');
      }

      return result.data;
    },
    enabled,
    staleTime,
    gcTime: cacheTime,
    retry: (failureCount, error) => {
      if (error instanceof Error && /4\d{2}/.test(error.message)) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });

  const prefetch = useCallback(
    async (nextParams: RefundListQueryParams) => {
      await queryClient.prefetchQuery({
        queryKey: financeKeys.refundsList(nextParams),
        queryFn: async (): Promise<RefundListData> => {
          const searchParams = new URLSearchParams();
          Object.entries(nextParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              searchParams.append(key, String(value));
            }
          });

          const response = await fetch(
            `/api/finance/refunds?${searchParams.toString()}`
          );

          if (!response.ok) {
            throw new Error(`获取退款列表失败: ${response.statusText}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || '获取退款列表失败');
          }

          return result.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return {
    ...query,
    prefetch,
  };
}
