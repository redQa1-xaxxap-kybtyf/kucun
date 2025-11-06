import { ArrowLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { ExpenseCreateClient } from './page-client';

export const metadata: Metadata = {
  title: '创建费用记录 - 财务管理',
  description: '创建新的费用记录',
};

/**
 * 创建费用记录页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default async function CreateExpensePage() {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限 - 只有具有 finance:manage 权限的用户可以创建费用记录
  if (!session?.user || !can(session.user, 'finance:manage')) {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <div className="overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  创建费用记录
                </h1>
                <p className="text-muted-foreground text-sm">
                  记录运费、仓储费、人工费等各类费用支出
                </p>
              </div>
            </div>
            <Link href="/finance/expenses">
              <button className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-all">
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
            </Link>
          </div>
        </div>

        {/* 表单内容 */}
        <ExpenseCreateClient />
      </div>
    </div>
  );
}
