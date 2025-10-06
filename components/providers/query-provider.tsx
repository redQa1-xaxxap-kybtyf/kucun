'use client';

import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode, useState } from 'react';

import { dashboardConfig } from '@/lib/env';

interface Props {
  children: ReactNode;
}

export default function QueryProvider({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 数据缓存时间：使用环境配置（5分钟）
            staleTime: dashboardConfig.staleTime,
            // 缓存保持时间：缓存时间的2倍（10分钟）
            gcTime: dashboardConfig.staleTime * 2,
            // 重试次数（减少不必要的重试以提升性能）
            retry: 1,
            // 重新获取数据的条件（优化路由切换性能）
            refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
            refetchOnReconnect: true, // 网络重连时重新获取
            refetchOnMount: 'stale', // 优化：只在数据过期时才重新获取（代替 false）
            // ✅ 修复：使用正确的 keepPreviousData 函数（React Query v5）
            placeholderData: keepPreviousData,
          },
          mutations: {
            // 错误重试次数
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 仅在开发环境启用 ReactQueryDevtools */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
