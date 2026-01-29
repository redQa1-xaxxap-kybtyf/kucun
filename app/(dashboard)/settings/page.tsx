/**
 * 系统设置主页面
 * 提供系统配置和管理功能的入口
 */

'use client';

import { Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';

// 未登录状态组件
const LoginRequiredView = () => (
  <div className="flex h-full flex-col overflow-hidden p-6">
    <div className="space-y-6">
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                系统设置
              </h1>
              <p className="text-sm text-gray-600">系统配置和管理功能</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50 shadow-lg shadow-amber-200/50">
        <CardHeader>
          <CardTitle className="text-amber-800">需要登录</CardTitle>
          <CardDescription className="text-amber-700">
            请先登录以访问系统设置。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  </div>
);

const SettingsPage = () => {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const isAdmin = user?.role === 'admin';
  const canManageFinance = user ? can(user, 'finance:manage') : false;

  // 直接重定向到基本设置页面，避免冗余的聚合页面
  React.useEffect(() => {
    if (typeof window === 'undefined' || !session?.user) {
      return;
    }

    if (isAdmin) {
      window.location.replace('/settings/basic');
      return;
    }

    if (canManageFinance) {
      window.location.replace('/settings/data-management');
    }
  }, [session, isAdmin, canManageFinance]);

  // 检查用户权限
  if (!session) {
    return <LoginRequiredView />;
  }

  // 检查管理员权限
  if (!isAdmin && !canManageFinance) {
    return (
      <div className="flex h-full flex-col overflow-hidden p-6">
        <div className="space-y-6">
          {/* 页面标题卡片 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    系统设置
                  </h1>
                  <p className="text-sm text-gray-600">系统配置和管理功能</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50 shadow-lg shadow-amber-200/50">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-800">
                <Settings className="mr-2 h-5 w-5" />
                权限不足
              </CardTitle>
              <CardDescription className="text-amber-700">
                只有管理员/财务管理员可以访问系统设置功能。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg shadow-gray-600/30">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  系统设置
                </h1>
                <p className="text-sm text-gray-600">
                  {isAdmin ? '正在跳转到基本设置...' : '正在跳转到数据管理...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
