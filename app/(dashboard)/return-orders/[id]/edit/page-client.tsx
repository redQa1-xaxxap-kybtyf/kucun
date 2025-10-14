'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { ERPReturnOrderForm } from '@/components/return-orders/erp-return-order-form';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import type { ReturnOrder } from '@/lib/types/return-order';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface ReturnOrderDetail {
  id: string;
  returnNumber: string;
  returnMode: 'single_order' | 'multi_order';
  salesOrderId?: string;
  customerId: string;
  userId: string;
  type: string;
  processType: string;
  status: string;
  reason: string;
  totalAmount: number;
  refundAmount: number;
  remarks?: string;
  submittedAt?: string;
  approvedAt?: string;
  processedAt?: string;
  completedAt?: string;
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
  salesOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  items: Array<{
    id: string;
    salesOrderItemId: string;
    productId: string;
    colorCode?: string;
    productionDate?: string;
    returnQuantity: number;
    damagedQuantity: number;
    originalQuantity: number;
    unitPrice: number;
    subtotal: number;
    reason?: string;
    product: {
      id: string;
      code: string;
      name: string;
      unit: string;
    };
  }>;
}

async function fetchReturnOrderDetail(id: string): Promise<ReturnOrderDetail> {
  const response = await fetch(`/api/return-orders/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取退货订单详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取退货订单详情失败');
  }

  return result.data;
}

interface ReturnOrderEditPageClientProps {
  id: string;
}

export function ReturnOrderEditPageClient({
  id,
}: ReturnOrderEditPageClientProps) {
  const router = useRouter();

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<ReturnOrderDetail>({
    queryKey: queryKeys.returnOrders.detail(id),
    queryFn: () => fetchReturnOrderDetail(id),
    enabled: !!id,
  });

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
        message="未找到指定的退货订单"
        onRetry={() => router.push('/return-orders')}
      />
    );
  }

  // 检查是否可以编辑
  if (!['draft', 'submitted'].includes(order.status)) {
    return (
      <ErrorMessage
        title="无法编辑"
        message={`当前状态（${order.status}）的退货订单不允许编辑`}
        onRetry={() => router.push(`/return-orders/${id}`)}
      />
    );
  }

  return (
    <ERPReturnOrderForm
      mode="edit"
      initialData={order as unknown as ReturnOrder}
      onSuccess={() => {
        router.push(`/return-orders/${id}`);
      }}
      onCancel={() => {
        router.push(`/return-orders/${id}`);
      }}
    />
  );
}
