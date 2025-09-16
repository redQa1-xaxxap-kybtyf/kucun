import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthSessionProvider from '@/components/providers/session-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '库存管理工具',
  description: '专为瓷砖行业设计的库存管理工具',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthSessionProvider>
          <div className="min-h-screen bg-background">{children}</div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
