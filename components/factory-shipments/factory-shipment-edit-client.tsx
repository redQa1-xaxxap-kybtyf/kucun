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
  initialData,
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
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  编辑厂家发货订单
                </h1>
                <p className="text-sm text-gray-600">
                  修改厂家发货订单信息，支持多供应商商品和临时商品管理
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
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
