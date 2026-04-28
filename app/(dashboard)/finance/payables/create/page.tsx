import { ArrowLeft, CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PayableCreateClient } from '@/components/finance/payable-create-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '登记应付款 - 财务管理',
  description: '登记一笔供应商应付款',
};

/**
 * 登记应付款页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default function CreatePayablePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden rounded-md border border-border shadow-sm">
          <CardContent className="bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[hsl(var(--color-error))]">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    登记应付款
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    录入应付款信息，登记对供应商的应付账款
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-10"
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
