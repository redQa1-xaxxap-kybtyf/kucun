'use client';

import { ArrowLeft, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderForm } from '@/components/factory-shipments/factory-shipment-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

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
      {/* 页面标题卡片 */}
      <Card
        className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                  编辑厂家发货订单
                </h1>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  修改厂家发货订单信息，支持多供应商产品和临时产品管理
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 transition-transform duration-150 hover:scale-[1.02]"
            >
              <Link href={`/factory-shipments/${orderId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* 表单 */}
      <FactoryShipmentOrderForm
        orderId={orderId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </>
  );
}
