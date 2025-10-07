'use client';

import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode, useState } from 'react';

interface Props {
  children: ReactNode;
}

export default function QueryProvider({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ 优化：减少默认 staleTime 到 2分钟（避免与页面级配置冲突）
            staleTime: 2 * 60 * 1000, // 2分钟
            // ✅ 优化：增加 gcTime 到 10分钟
            gcTime: 10 * 60 * 1000, // 10分钟
            // 重试次数（减少不必要的重试以提升性能）
            retry: 1,
            // 重新获取数据的条件（优化路由切换性能）
            refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
            refetchOnReconnect: true, // 网络重连时重新获取
            refetchOnMount: false, // ✅ 优化：改为 false，依赖 staleTime
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
