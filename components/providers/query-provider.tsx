'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode, useState } from 'react'

interface Props {
  children: ReactNode
}

export default function QueryProvider({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 数据缓存时间：5分钟
            staleTime: 5 * 60 * 1000,
            // 缓存保持时间：10分钟
            gcTime: 10 * 60 * 1000,
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
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
