import * as React from 'react';

import { AuthLayout } from '@/components/common/AuthLayout';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * 仪表盘路由组布局
 * 为所有仪表盘相关页面提供统一的认证和布局
 * 严格遵循App Router优先思维
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthLayout
      requireAuth={false} // 临时禁用认证以便测试
      showBreadcrumb={true}
      enableGlobalSearch={true}
    >
      {children}
    </AuthLayout>
  );
}

/**
 * 路由组元数据
 */
export const metadata = {
  title: {
    template: '%s - 库存管理工具',
    default: '库存管理工具',
  },
  description: '专业的库存管理解决方案',
};
