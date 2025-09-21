/**
 * 系统设置主页面
 * 提供设置概览和快速导航
 */

'use client';

import {
  AlertCircle,
  Bell,
  Building,
  CheckCircle,
  Clock,
  Database,
  Palette,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSystemSettings } from '@/lib/api/settings';
import { SETTING_CATEGORIES } from '@/lib/types/settings';
import { usePermissions } from '@/lib/utils/permissions';

const SettingsPage = () => {
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role);
  const { data: settingsResponse, isLoading, error } = useSystemSettings();

  const settings = settingsResponse?.data;

  // 过滤用户可访问的设置分类
  const accessibleCategories = SETTING_CATEGORIES.filter(
    category => category.requiredRole === 'all' || permissions.isAdmin()
  );

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    const icons = {
      Building,
      Users,
      Settings,
      Palette,
      Bell,
      Database,
    };
    return icons[iconName as keyof typeof icons] || Settings;
  };

  // 获取设置状态
  const getSettingStatus = (categoryId: string) => {
    if (!settings) return 'unknown';

    switch (categoryId) {
      case 'basic':
        return settings.basic.companyName && settings.basic.systemName
          ? 'configured'
          : 'incomplete';
      case 'userManagement':
        return settings.userManagement.passwordMinLength >= 8
          ? 'configured'
          : 'incomplete';
      case 'business':
        return settings.business.paymentMethods.length > 0
          ? 'configured'
          : 'incomplete';
      case 'notifications':
        return settings.notifications.emailRecipients?.length > 0 ||
          settings.notifications.enableSystemNotifications
          ? 'configured'
          : 'incomplete';
      case 'dataManagement':
        return settings.dataManagement.autoBackupEnabled &&
          settings.dataManagement.backupStoragePath
          ? 'configured'
          : 'incomplete';
      default:
        return 'configured';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'configured':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            已配置
          </Badge>
        );
      case 'incomplete':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            待配置
          </Badge>
        );
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">管理系统配置和偏好设置</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                <div className="h-3 w-full rounded bg-gray-200"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-1/2 rounded bg-gray-200"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">管理系统配置和偏好设置</p>
          </div>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">加载设置失败</CardTitle>
            <CardDescription>
              无法加载系统设置信息，请刷新页面重试。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统设置</h1>
          <p className="text-muted-foreground">管理系统配置和偏好设置</p>
        </div>
        {permissions.isAdmin() && (
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              <Shield className="mr-1 h-3 w-3" />
              管理员权限
            </Badge>
          </div>
        )}
      </div>

      {/* 系统状态概览 */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              系统状态概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">公司名称:</span>
                <span className="font-medium">
                  {settings.basic.companyName || '未设置'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">最后更新:</span>
                <span className="font-medium">
                  {new Intl.DateTimeFormat('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(settings.updatedAt))}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">更新者:</span>
                <span className="font-medium">{settings.updatedBy}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* 设置分类卡片 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accessibleCategories.map(category => {
          const IconComponent = getIconComponent(category.icon);
          const status = getSettingStatus(category.id);

          return (
            <Card
              key={category.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </div>
                  {getStatusBadge(status)}
                </div>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/settings/${category.id}`}>配置设置</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 快速操作 */}
      {permissions.isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>常用的系统管理操作</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                导出配置
              </Button>
              <Button variant="outline" size="sm">
                导入配置
              </Button>
              <Button variant="outline" size="sm">
                重置所有设置
              </Button>
              <Button variant="outline" size="sm">
                查看操作日志
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
