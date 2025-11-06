'use client';

import { ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PurchaseOrderForm } from '@/components/purchase-orders/purchase-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PurchaseOrder } from '@/lib/types/purchase-order';

interface PurchaseOrderEditClientProps {
  orderId: string;
  initialData: PurchaseOrder;
}

export function PurchaseOrderEditClient({
  orderId,
  initialData,
}: PurchaseOrderEditClientProps) {
  const router = useRouter();

  if (initialData.status !== 'draft') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">只能编辑草稿状态的订单</p>
            <Button
              variant="outline"
              onClick={() => router.push(`/purchase-orders/${orderId}`)}
              className="mt-4"
            >
              返回详情页
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  编辑采购订单
                </h1>
                <p className="text-sm text-gray-600">
                  订单号：{initialData.orderNumber}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Link href={`/purchase-orders/${orderId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PurchaseOrderForm
        mode="edit"
        orderId={orderId}
        initialData={initialData}
        onSuccess={() => {
          router.push(`/purchase-orders/${orderId}`);
        }}
        onCancel={() => {
          router.push(`/purchase-orders/${orderId}`);
        }}
      />
    </>
  );
}
