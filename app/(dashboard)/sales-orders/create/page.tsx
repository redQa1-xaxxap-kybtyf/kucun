import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

import { CreateSalesOrderPageClient } from '@/components/sales-orders/create-sales-order-page-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';

/**
 * 新建销售订单页面
 * 采用中国ERP系统标准布局
 * 优化：使用 Server Component 预先生成订单号，消除加载延迟
 */
export default async function CreateSalesOrderPage() {
  // 服务端预先生成订单号，无延迟
  const initialOrderNumber = await generateSalesOrderNumber();

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
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

        {/* 表单 - 传递预生成的订单号 */}
        <CreateSalesOrderPageClient initialOrderNumber={initialOrderNumber} />
      </div>
    </div>
  );
}
