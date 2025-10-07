'use client';

import { ArrowLeft, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderForm } from '@/components/factory-shipments/factory-shipment-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    创建厂家发货订单
                  </h1>
                  <p className="text-sm text-gray-600">
                    创建新的厂家发货订单，支持多供应商商品和临时商品管理
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
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
