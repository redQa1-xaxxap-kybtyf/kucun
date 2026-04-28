'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

const FactoryShipmentOrderForm = dynamic(
  () =>
    import('@/components/factory-shipments/factory-shipment-order-form').then(
      mod => mod.FactoryShipmentOrderForm
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
 * 新建厂家发货单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function CreateFactoryShipmentPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    // 厂家发货单创建成功，跳转到列表页
    router.push('/factory-shipments');
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--color-text-primary))]">
              新建厂家发货单
            </h1>
          </div>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/factory-shipments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>

        <FactoryShipmentOrderForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
