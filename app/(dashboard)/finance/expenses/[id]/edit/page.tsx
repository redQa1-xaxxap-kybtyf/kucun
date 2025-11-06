import { ArrowLeft, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { getExpenseRecordById } from '@/lib/services/expense-service';

import { ExpenseEditClient } from './page-client';

type ExpenseEditPageProps = {
  params: { id: string };
};

export const metadata: Metadata = {
  title: '编辑费用记录 - 财务管理',
  description: '编辑现有的费用记录',
};

export default async function ExpenseEditPage({
  params,
}: ExpenseEditPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user, 'finance:manage')) {
    redirect('/dashboard');
  }

  const { id } = params;
  const expense = await getExpenseRecordById(id);

  if (!expense) {
    redirect('/finance/expenses');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 shadow-lg">
                <Pencil className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  编辑费用记录
                </h1>
                <p className="text-muted-foreground text-sm">
                  更新费用信息，确保财务数据准确。
                </p>
              </div>
            </div>
            <Link href={`/finance/expenses/${expense.id}`}>
              <button className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-all">
                <ArrowLeft className="h-4 w-4" />
                返回详情
              </button>
            </Link>
          </div>
        </div>

        <ExpenseEditClient expense={expense} />
      </div>
    </div>
  );
}
