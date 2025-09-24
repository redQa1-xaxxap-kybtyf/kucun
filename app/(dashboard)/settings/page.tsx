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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePermissions } from '@/lib/utils/permissions';

// 未登录状态组件
const LoginRequiredView = () => (
  <div className="container mx-auto space-y-6 py-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">系统设置</h1>
        <p className="text-muted-foreground">系统配置和管理功能</p>
      </div>
    </div>
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="text-amber-800">需要登录</CardTitle>
        <CardDescription>请先登录以访问系统设置。</CardDescription>
      </CardHeader>
    </Card>
  </div>
);

const SettingsPage = () => {
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role as 'admin' | 'sales');

  // 直接重定向到基本设置页面，避免冗余的聚合页面
  React.useEffect(() => {
    if (typeof window !== 'undefined' && session && permissions.isAdmin()) {
      window.location.replace('/settings/basic');
    }
  }, [session, permissions]);

  // 检查用户权限
  if (!session) {
    return <LoginRequiredView />;
  }

  // 检查管理员权限
  if (!permissions.isAdmin()) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">系统配置和管理功能</p>
          </div>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Settings className="mr-2 h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription className="text-amber-700">
              只有管理员可以访问系统设置功能。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统设置</h1>
          <p className="text-muted-foreground">正在跳转到基本设置...</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
