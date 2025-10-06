import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PayableDetailClient } from '@/components/finance/payable-detail-client';
import { Card, CardContent } from '@/components/ui/card';
import { payablesApi } from '@/lib/api/payables';

export const metadata: Metadata = {
  title: '应付款详情 - 财务管理',
  description: '查看应付款详细信息',
};

interface PayableDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 应付款详情页面
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */
export default async function PayableDetailPage({
  params,
}: PayableDetailPageProps) {
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

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面头部 - 移除硬编码标题，依赖 DashboardLayoutClient 自动渲染面包屑 */}
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">
            应付款单号：{payable.payableNumber}
          </span>
        </div>

        {/* 详情内容 */}
        <PayableDetailClient payable={payable} />
      </div>
    </div>
  );
}
