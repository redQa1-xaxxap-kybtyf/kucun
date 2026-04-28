import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import ChunkLoadRecovery from '@/components/providers/chunkload-recovery';
import QueryProvider from '@/components/providers/query-provider';
import AuthSessionProvider from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/toaster';
import { safeAuth } from '@/lib/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '瓷砖销售 ERP',
  description: '面向瓷砖门店和批发业务的进销存、销售、库存与财务系统',
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
  const session = await safeAuth('root-layout');

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
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
