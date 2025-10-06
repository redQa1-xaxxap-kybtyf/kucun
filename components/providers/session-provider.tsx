'use client';

import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  session?: Session | null;
}

/**
 * 🚀 性能优化的 SessionProvider
 * - refetchInterval: 禁用自动刷新，避免不必要的网络请求
 * - refetchOnWindowFocus: 禁用窗口聚焦刷新，减少后台请求
 */
export default function AuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}
