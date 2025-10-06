'use client';

import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 新建销售订单页面
 * 采用中国ERP系统标准布局
 */
export default function CreateSalesOrderPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    新建销售订单
                  </h1>
                  <p className="text-sm text-gray-600">创建新的销售订单</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Link href="/sales-orders">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <ERPSalesOrderForm
          onSuccess={(order: { id: string }) => {
            // 创建成功后跳转到订单详情页或列表页
            router.push(`/sales-orders/${order.id}`);
          }}
          onCancel={() => {
            router.back();
          }}
        />
      </div>
    </div>
  );
}
