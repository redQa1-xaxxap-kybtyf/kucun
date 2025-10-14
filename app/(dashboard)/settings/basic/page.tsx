/**
 * 基本设置页面
 * 严格遵循全栈项目统一约定规范
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role as 'admin' | 'sales');

  // 检查用户权限
  if (!session) {
    return (
      <div className="space-y-6 p-6">
        {/* 页面头部 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  基本设置
                </h1>
                <p className="text-sm text-gray-600">系统基础配置</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 shadow-lg shadow-amber-200/50">
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
      <div className="space-y-6 p-6">
        {/* 页面头部 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    基本设置
                  </h1>
                  <p className="text-sm text-gray-600">系统基础配置</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/settings')}
                className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <ArrowLeft className="h-4 w-4" />
                返回设置
              </Button>
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
              只有管理员可以修改基本设置。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面头部 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  基本设置
                </h1>
                <p className="text-sm text-gray-600">
                  配置公司信息、系统参数、业务规则等基础信息
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/settings')}
              className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              返回设置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 基本设置表单 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Settings className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>配置公司基本信息、系统参数、库存规则、订单流程等设置</span>
          </div>
          <BasicSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default BasicSettingsPage;
