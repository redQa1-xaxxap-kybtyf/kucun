'use client';

import { ArrowLeft, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ERPReturnOrderForm } from '@/components/return-orders/erp-return-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 新建退货订单页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CreateReturnOrderPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    router.push('/return-orders');
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600 shadow-lg shadow-orange-600/30">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    创建退货订单
                  </h1>
                  <p className="text-sm text-gray-600">
                    创建新的退货订单，处理客户退货申请
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Link href="/return-orders">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <ERPReturnOrderForm
          mode="create"
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
