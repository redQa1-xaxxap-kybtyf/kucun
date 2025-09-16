/**
 * 退货订单页面
 * 严格遵循全栈项目统一约定规范
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '退货订单 - 库存管理系统',
  description: '管理客户退货订单',
};

export default function ReturnOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">退货订单</h1>
        <p className="text-muted-foreground">管理客户退货订单</p>
      </div>

      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-center text-muted-foreground">
          退货订单功能正在开发中...
        </p>
      </div>
    </div>
  );
}
