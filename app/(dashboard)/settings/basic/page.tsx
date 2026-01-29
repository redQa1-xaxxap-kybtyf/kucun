/**
 * 基本设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { BasicSettingsForm } from '@/components/settings/BasicSettingsForm';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/utils/permissions';

const BasicSettingsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role as 'admin' | 'sales');

  if (!session || !permissions.isAdmin()) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-100 bg-rose-50 text-rose-500 shadow-sm">
          <Settings className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900">权限受限</h2>
          <p className="text-sm font-medium text-slate-500">
            此区域仅限系统管理员访问与配置。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/settings')}
          className="mt-4 h-11 px-8 font-bold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回工作区
        </Button>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="核心基本设置"
      description="配置系统全局参数、业务规则及供应链预警阈值，这些变更将实时同步至全站节点。"
    >
      <div className="w-full pb-20">
        <BasicSettingsForm />
      </div>
    </SettingsLayout>
  );
};

export default BasicSettingsPage;
