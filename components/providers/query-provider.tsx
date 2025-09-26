'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { useState } from 'react';

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
            // 数据缓存时间：使用环境配置
            staleTime: dashboardConfig.staleTime,
            // 缓存保持时间：缓存时间的2倍
            gcTime: dashboardConfig.staleTime * 2,
            // 重试次数
            retry: 1,
            // 重新获取数据的条件
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
