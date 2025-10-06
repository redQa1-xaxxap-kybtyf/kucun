import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PayableEditClient } from '@/components/finance/payable-edit-client';
import { Card, CardContent } from '@/components/ui/card';
import { payablesApi } from '@/lib/api/payables';

export const metadata: Metadata = {
  title: '编辑应付款 - 财务管理',
  description: '编辑应付款记录信息',
};

interface PayableEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 编辑应付款页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default async function EditPayablePage({
  params,
}: PayableEditPageProps) {
  const { id } = await params;

  // 服务器端获取应付款详情
  let payable;
  try {
    payable = await payablesApi.getPayableRecord(id);
  } catch (error) {
    notFound();
  }

  if (!payable) {
    notFound();
  }

  // 只允许编辑待付款和部分付款状态的应付款
  if (payable.status !== 'pending' && payable.status !== 'partial') {
    notFound();
  }

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
                  编辑应付款
                </h1>
                <p className="text-sm text-gray-600">
                  应付款单号：{payable.payableNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 表单内容 */}
        <PayableEditClient payableId={id} initialData={payable} />
      </div>
    </div>
  );
}

