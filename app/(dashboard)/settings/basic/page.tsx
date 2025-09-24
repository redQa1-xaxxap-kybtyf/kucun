/**
 * 基本设置页面
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { BasicSettingsForm } from '@/components/settings/BasicSettingsForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePermissions } from '@/lib/utils/permissions';

const BasicSettingsPage = () => {
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role as 'admin' | 'sales');

  // 检查用户权限
  if (!session) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">基本设置</h1>
            <p className="text-muted-foreground">系统基础配置</p>
          </div>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Settings className="mr-2 h-5 w-5" />
              需要登录
            </CardTitle>
            <CardDescription className="text-amber-700">
              请先登录以访问基本设置。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 检查管理员权限
  if (!permissions.isAdmin()) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回设置
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">基本设置</h1>
              <p className="text-muted-foreground">系统基础配置</p>
            </div>
          </div>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Settings className="mr-2 h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription className="text-amber-700">
              只有管理员可以修改基本设置。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回设置
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">基本设置</h1>
            <p className="text-muted-foreground">配置系统基础信息和参数</p>
          </div>
        </div>
      </div>

      {/* 基本设置表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            系统基础配置
          </CardTitle>
          <CardDescription>
            配置公司信息、系统参数、业务设置等基础信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BasicSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default BasicSettingsPage;
