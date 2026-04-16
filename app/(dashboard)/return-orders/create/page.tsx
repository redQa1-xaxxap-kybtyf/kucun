'use client';

import { ArrowLeft, PackageX } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { readQuickReturnPrefill } from '@/lib/utils/sales-order-navigation';

const ERPReturnOrderForm = dynamic(
  () =>
    import('@/components/return-orders/erp-return-order-form').then(
      mod => mod.ERPReturnOrderForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

/**
 * 新建退货订单页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CreateReturnOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickReturnPrefill = readQuickReturnPrefill(searchParams);
  const hasQuickReturnPrefill = Boolean(quickReturnPrefill.salesOrderId);
  const returnHref = quickReturnPrefill.returnTo ?? '/return-orders';

  // 处理创建成功
  const handleSuccess = () => {
    if (quickReturnPrefill.returnTo) {
      router.push(quickReturnPrefill.returnTo);
      return;
    }

    router.push('/return-orders');
  };

  // 处理取消
  const handleCancel = () => {
    if (quickReturnPrefill.returnTo) {
      router.push(quickReturnPrefill.returnTo);
      return;
    }

    router.back();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="新建退货订单"
          description={
            hasQuickReturnPrefill
              ? '已从销售单带入客户和待退明细，补充退货数量后即可保存或提交。'
              : '新建退货订单，处理客户退货申请'
          }
          icon={<PackageX className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-error))"
          actions={
            <Button variant="outline" size="lg" asChild className="h-11 gap-2">
              <Link href={returnHref}>
                <ArrowLeft className="h-4 w-4" />
                {hasQuickReturnPrefill ? '返回销售单' : '返回列表'}
              </Link>
            </Button>
          }
        />

        {/* 表单 */}
        <ERPReturnOrderForm
          mode="create"
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          presetSalesOrderId={quickReturnPrefill.salesOrderId}
          presetCustomerId={quickReturnPrefill.customerId}
        />
      </div>
    </div>
  );
}
