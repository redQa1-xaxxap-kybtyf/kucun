'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  supplierId?: string;
  status: string;
  orderType: string;
  totalAmount: number;
  costAmount: number;
  profitAmount: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productCode?: string;
    batchNumber?: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitCost?: number;
    costSubtotal?: number;
    profitAmount?: number;
    isManualProduct: boolean;
    manualProductName?: string;
    manualSpecification?: string;
    manualWeight?: number;
    manualUnit?: string;
    product?: {
      id: string;
      code: string;
      name: string;
      specification?: string;
      unit: string;
      piecesPerUnit?: number;
    };
  }>;
}

async function fetchSalesOrderDetail(id: string): Promise<SalesOrderDetail> {
  const response = await fetch(`/api/sales-orders/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取销售订单详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取销售订单详情失败');
  }

  return result.data;
}

/**
 * 编辑销售订单页面
 * 仅允许编辑草稿状态的订单
 */
export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const hasRedirectedRef = React.useRef(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<SalesOrderDetail>({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => fetchSalesOrderDetail(id),
    enabled: !!id,
  });

  // 检查订单状态：只允许编辑草稿状态的订单（必须在所有 Hooks 之后，条件返回之前）
  React.useEffect(() => {
    if (!hasRedirectedRef.current && order && order.status !== 'draft') {
      hasRedirectedRef.current = true;
      // 非草稿状态，跳转回详情页
      router.replace(`/sales-orders/${id}`);
    }
  }, [order, id, router]);

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!order) {
    return (
      <ErrorMessage
        title="订单不存在"
        message="未找到指定的销售订单"
        onRetry={() => router.push('/sales-orders')}
      />
    );
  }

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
                    编辑销售订单
                  </h1>
                  <p className="text-sm text-gray-600">
                    订单号：{order.orderNumber}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Link href={`/sales-orders/${id}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <ERPSalesOrderForm
          mode="edit"
          orderId={id}
          initialData={order}
          onSuccess={() => {
            // 编辑成功后返回订单列表
            router.push('/sales-orders');
          }}
          onCancel={() => {
            router.push(`/sales-orders/${id}`);
          }}
        />
      </div>
    </div>
  );
}
