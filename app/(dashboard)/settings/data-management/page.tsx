import { Database } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { getSystemMode } from '@/lib/services/system-mode-service';

import { DataManagementPageClient } from './page-client';

export const metadata: Metadata = {
  title: '数据管理 - 系统设置',
  description: '试用账套重置与正式账套测试数据清理',
};

export default async function DataManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user, 'finance:manage')) {
    redirect('/dashboard');
  }

  const systemMode = await getSystemMode();
  const canSwitchMode = session.user.role === 'admin';

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <div className="overflow-hidden rounded-lg border bg-gradient-to-r from-slate-50 to-gray-50 p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-lg shadow-slate-900/30">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                数据管理
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                试用账套可一键重置；正式账套仅清理测试数据（可追溯）
              </p>
            </div>
          </div>
        </div>

        <DataManagementPageClient
          systemMode={systemMode}
          canSwitchMode={canSwitchMode}
        />
      </div>
    </div>
  );
}
