'use client';

import { ArrowLeft, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PurchaseOrderForm } from '@/components/purchase-orders/purchase-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function CreatePurchaseOrderPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/purchase-orders');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]"
                  style={{ boxShadow: 'var(--shadow-light)' }}
                >
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    新建采购订单
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    创建新的采购订单，管理仓库进货和库存补充
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 transition-transform duration-150 hover:scale-[1.02]"
              >
                <Link href="/purchase-orders">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <PurchaseOrderForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </div>
  );
}
