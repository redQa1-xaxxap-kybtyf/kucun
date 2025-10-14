import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PayableEditClient } from '@/components/finance/payable-edit-client';
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
  } catch {
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
        {/* 页面头部 - 移除硬编码标题，依赖 DashboardLayoutClient 自动渲染面包屑 */}
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">
            应付款单号：{payable.payableNumber}
          </span>
        </div>

        {/* 表单内容 */}
        <PayableEditClient payableId={id} initialData={payable} />
      </div>
    </div>
  );
}
