import { ArrowLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { ExpenseCreateClient } from './page-client';

export const metadata: Metadata = {
  title: '登记费用 - 财务管理',
  description: '登记新的费用支出',
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
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <div className="overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm sm:p-6 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg sm:h-12 sm:w-12">
                <Receipt className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight sm:text-2xl sm:font-bold">
                  登记费用
                </h1>
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                  记录运费、仓储费、工资、营业费、管理费等各类费用支出
                </p>
              </div>
            </div>
            <Link
              href="/finance/expenses"
              className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium shadow-sm transition-all sm:h-11 sm:px-4 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </div>
        </div>

        {/* 表单内容 */}
        <ExpenseCreateClient />
      </div>
    </div>
  );
}
