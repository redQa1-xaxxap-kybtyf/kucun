'use client';

import { ArrowLeft, PackageX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { ERPReturnOrderForm } from '@/components/return-orders/erp-return-order-form';
import { Button } from '@/components/ui/button';

/**
 * 新建退货订单页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CreateReturnOrderPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    router.push('/return-orders');
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="创建退货订单"
          description="创建新的退货订单，处理客户退货申请"
          icon={<PackageX className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-error))"
          actions={
            <Button variant="outline" size="lg" asChild className="h-11 gap-2">
              <Link href="/return-orders">
                <ArrowLeft className="h-4 w-4" />
                返回列表
              </Link>
            </Button>
          }
        />

        {/* 表单 */}
        <ERPReturnOrderForm
          mode="create"
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
