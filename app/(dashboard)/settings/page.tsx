/**
 * 系统设置主页面
 * 当前系统设置功能已被移除
 */

'use client';

import { Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';

import {
  Card,
  CardContent,
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

// 管理员操作提示组件
const AdminActionsCard = () => (
  <Card>
    <CardHeader>
      <CardTitle>管理员操作</CardTitle>
      <CardDescription>作为管理员，您可以通过以下方式管理系统</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>• 用户管理：通过用户管理页面添加、编辑用户信息</p>
        <p>• 数据管理：通过各业务模块进行数据的导入导出</p>
        <p>• 系统监控：通过仪表板查看系统运行状态</p>
        <p>• 权限控制：通过用户角色管理控制访问权限</p>
      </div>
    </CardContent>
  </Card>
);

const SettingsPage = () => {
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role as 'admin' | 'sales');

  // 检查用户权限
  if (!session) {
    return <LoginRequiredView />;
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统设置</h1>
          <p className="text-muted-foreground">系统配置和管理功能</p>
        </div>
      </div>

      {/* 功能不可用提示 */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center text-amber-800">
            <Settings className="mr-2 h-5 w-5" />
            系统设置功能暂不可用
          </CardTitle>
          <CardDescription className="text-amber-700">
            系统设置模块当前已被禁用。如需配置系统参数，请联系系统管理员。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-amber-700">
            <p>• 基础设置（公司信息、系统配置）</p>
            <p>• 用户管理设置（密码策略、权限配置）</p>
            <p>• 业务设置（支付方式、库存预警）</p>
            <p>• 通知设置（消息提醒、报表推送）</p>
            <p>• 数据管理设置（备份、导出、维护）</p>
          </div>
        </CardContent>
      </Card>

      {/* 替代方案提示 */}
      {permissions.isAdmin() && <AdminActionsCard />}
    </div>
  );
};

export default SettingsPage;
