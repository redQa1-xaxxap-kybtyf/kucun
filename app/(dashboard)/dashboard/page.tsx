// 仪表盘主页面
// 基于shadcn/ui组件库的完整仪表盘实现
// 严格遵循全栈开发执行手册和项目统一约定规范

'use client';

import { ERPDashboard } from '@/components/dashboard/erp-dashboard';

/**
 * 仪表盘主页面组件
 * 使用ERP风格的紧凑布局设计
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPDashboard />
    </div>
  );
}
