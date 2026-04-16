'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

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

interface FactoryShipmentEditClientProps {
  orderId: string;
  initialData: FactoryShipmentOrder;
}

export function FactoryShipmentEditClient({
  orderId,
  initialData: _initialData,
}: FactoryShipmentEditClientProps) {
  const router = useRouter();
  // 处理更新成功
  const handleSuccess = () => {
    // 厂家发货订单更新成功，跳转到详情页
    router.push(`/factory-shipments/${orderId}`);
  };

  // 处理取消
  const handleCancel = () => {
    router.push(`/factory-shipments/${orderId}`);
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--color-text-primary))]">
            编辑厂家发货单
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
            按单据结构调整客户、明细与结算信息
          </p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href={`/factory-shipments/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
      </div>
      <FactoryShipmentOrderForm
        orderId={orderId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </>
  );
}
