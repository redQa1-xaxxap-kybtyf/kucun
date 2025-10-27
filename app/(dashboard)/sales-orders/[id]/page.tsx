/* eslint-disable max-lines-per-function */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ErrorMessage } from '@/components/ui/error-message';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/utils/error-handler';

import { AmountSummaryCards } from './components/AmountSummaryCards';
import { BasicInfoCard } from './components/BasicInfoCard';
import { FeeItemsCard } from './components/FeeItemsCard';
import { HeaderCard } from './components/HeaderCard';
import { OperationHistoryCard } from './components/OperationHistoryCard';
import { OrderItemsTable } from './components/OrderItemsTable';
import { PaymentsCard } from './components/PaymentsCard';
import { RelatedReturnOrdersCard } from './components/RelatedReturnOrdersCard';
import { TransferModeInfoCard } from './components/TransferModeInfoCard';
import type { SalesOrderDetail } from './components/types';

async function fetchSalesOrderDetail(id: string): Promise<SalesOrderDetail> {
  const response = await fetch(`/api/sales-orders/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const errorResult = await response.json();
      if (errorResult?.error) {
        throw new Error(errorResult.error);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }
    throw new Error('获取销售订单详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取销售订单详情失败');
  }

  return result.data;
}


export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<SalesOrderDetail>({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => fetchSalesOrderDetail(id),
    enabled: !!id,
  });

  // 更新订单状态
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      try {
        const response = await fetch(`/api/sales-orders/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: newStatus,
            idempotencyKey: crypto.randomUUID(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = '更新订单状态失败';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // JSON解析失败，使用默认错误消息
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || '更新订单状态失败');
        }

        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('操作超时，请重试');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.lists(),
      });
      toast({
        title: '操作成功',
        description: '订单状态已更新',
      });
      setIsUpdatingStatus(false);
    },
    onError: (error: Error) => {
      toast({
        title: '操作失败',
        description: error.message,
        variant: 'destructive',
      });
      setIsUpdatingStatus(false);
    },
    onSettled: () => {
      // 确保无论成功还是失败都重置状态
      setIsUpdatingStatus(false);
    },
  });

  // 确认发货
  const handleConfirmShipment = () => {
    if (order?.status !== 'confirmed') {
      toast({
        title: '操作失败',
        description: '只有已确认的订单才能发货',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingStatus(true);
    updateStatusMutation.mutate('shipped');
  };

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


  const orderItems = order.items ?? [];
        const userName = order.user?.name ?? '-';

  const totalDisplayQuantity = orderItems.reduce(
    (sum, item) =>
      sum +
      (typeof item.displayQuantity === 'number'
        ? item.displayQuantity
        : item.quantity || 0),
    0
  );
  const totalLocalQuantity = orderItems.reduce(
    (sum, item) => sum + (item.localQuantity ?? 0),
    0
  );
  const totalTransferQuantity = orderItems.reduce(
    (sum, item) => sum + (item.transferQuantity ?? 0),
    0
  );
  // 计算产品小计（不含额外费用）
  const productSubtotal = orderItems.reduce(
    (sum, item) => sum + (item.subtotal || 0),
    0
  );

  // 计算调货部分的销售额（用于毛利率计算）
  const transferSalesAmount = orderItems.reduce((sum, item) => {
    const transferQty = item.transferQuantity ?? 0;
    const totalQty = item.quantity || 1;
    const transferRatio = totalQty > 0 ? transferQty / totalQty : 0;
    return sum + (item.subtotal || 0) * transferRatio;
  }, 0);

  // 计算纯调货毛利（排除本地发货收入）
  const pureTransferProfit = transferSalesAmount - (order.costAmount || 0);

  const canEditOrder = order.status === 'draft';
  
    return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <HeaderCard
          order={order}
          id={id}
          canEditOrder={canEditOrder}
          isUpdatingStatus={isUpdatingStatus}
          onConfirmShipment={handleConfirmShipment}
          onShowToast={(title, description, variant = 'default') => toast({ title, description, variant })}
        />

        <TransferModeInfoCard order={order} />

        <AmountSummaryCards
          order={order}
          totalDisplayQuantity={totalDisplayQuantity}
          totalLocalQuantity={totalLocalQuantity}
          totalTransferQuantity={totalTransferQuantity}
          productSubtotal={productSubtotal}
          transferSalesAmount={transferSalesAmount}
          pureTransferProfit={pureTransferProfit}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <BasicInfoCard order={order} />
            <RelatedReturnOrdersCard order={order} />
            <OrderItemsTable
              order={order}
              totalDisplayQuantity={totalDisplayQuantity}
              totalLocalQuantity={totalLocalQuantity}
              totalTransferQuantity={totalTransferQuantity}
              productSubtotal={productSubtotal}
            />
            <FeeItemsCard order={order} productSubtotal={productSubtotal} />
          </div>
          <div className="space-y-4">
            <PaymentsCard order={order} />
            <OperationHistoryCard order={order} userName={userName} />
          </div>
        </div>
      </div>
    </div>
  );
}
