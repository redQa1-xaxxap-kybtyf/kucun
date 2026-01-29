'use client';

import { ArrowLeft, Truck } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
 * 创建厂家发货订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function CreateFactoryShipmentPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    // 厂家发货订单创建成功，跳转到列表页
    router.push('/factory-shipments');
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
          <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    创建厂家发货订单
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    创建新的厂家发货订单，支持多供应商产品和临时产品管理
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 transition-transform duration-150 hover:scale-[1.02]"
              >
                <Link href="/factory-shipments">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <FactoryShipmentOrderForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
