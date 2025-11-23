import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';

import ChunkLoadRecovery from '@/components/providers/chunkload-recovery';
import QueryProvider from '@/components/providers/query-provider';
import AuthSessionProvider from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/toaster';
import { authOptions } from '@/lib/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '库存管理工具',
  description: '专为瓷砖行业设计的库存管理工具',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 在服务端获取 session，传递给 SessionProvider
  const session = await getServerSession(authOptions);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthSessionProvider session={session}>
          <QueryProvider>
            <ChunkLoadRecovery />
            <div className="bg-background min-h-screen">{children}</div>
            <Toaster />
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
