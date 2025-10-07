import { ArrowLeft, CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PayableCreateClient } from '@/components/finance/payable-create-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '创建应付款 - 财务管理',
  description: '创建新的应付款记录',
};

/**
 * 创建应付款页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default function CreatePayablePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/30">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    创建应付款
                  </h1>
                  <p className="text-sm text-gray-600">
                    创建新的应付款记录，记录对供应商的应付账款
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Link href="/finance/payables">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单内容 */}
        <PayableCreateClient />
      </div>
    </div>
  );
}
