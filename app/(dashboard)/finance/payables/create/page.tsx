import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';

import { PayableCreateClient } from '@/components/finance/payable-create-client';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '新建应付款 - 财务管理',
  description: '创建新的应付款记录',
};

/**
 * 新建应付款页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default function CreatePayablePage() {
  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  新建应付款
                </h1>
                <p className="text-sm text-gray-600">
                  创建新的应付款记录，记录对供应商的应付账款
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 表单内容 */}
        <PayableCreateClient />
      </div>
    </div>
  );
}

