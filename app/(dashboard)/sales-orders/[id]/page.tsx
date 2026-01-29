/* eslint-disable max-lines-per-function */
'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { ContentLoading } from '@/components/common/loading';
import { ErrorMessage } from '@/components/ui/error-message';
import { useToast } from '@/components/ui/use-toast';
import { useUpdateSalesOrderStatus } from '@/lib/api/sales-orders';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/utils/error-handler';

import { AmountSummaryCards } from './components/AmountSummaryCards';
import { BasicInfoCard } from './components/BasicInfoCard';
import { HeaderCard } from './components/HeaderCard';
import { OrderReconciliationSummaryCard } from './components/OrderReconciliationSummaryCard';
import { TransferModeInfoCard } from './components/TransferModeInfoCard';
import type { SalesOrderDetail } from './components/types';

const RelatedReturnOrdersCard = dynamic(
  () =>
    import('./components/RelatedReturnOrdersCard').then(
      mod => mod.RelatedReturnOrdersCard
    ),
  { ssr: false, loading: () => null }
);

const OrderItemsTable = dynamic(
  () => import('./components/OrderItemsTable').then(mod => mod.OrderItemsTable),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        明细加载中...
      </div>
    ),
  }
);

const FeeItemsCard = dynamic(
  () => import('./components/FeeItemsCard').then(mod => mod.FeeItemsCard),
  { ssr: false, loading: () => null }
);

const PaymentsCard = dynamic(
  () => import('./components/PaymentsCard').then(mod => mod.PaymentsCard),
  { ssr: false, loading: () => null }
);

const PrepaymentUsageCard = dynamic(
  () =>
    import('./components/PrepaymentUsageCard').then(mod => mod.PrepaymentUsageCard),
  { ssr: false, loading: () => null }
);

const OperationHistoryCard = dynamic(
  () =>
    import('./components/OperationHistoryCard').then(
      mod => mod.OperationHistoryCard
    ),
  { ssr: false, loading: () => null }
);

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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>(
    'comfortable'
  );

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<SalesOrderDetail>({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => fetchSalesOrderDetail(id),
    enabled: !!id,
  });

  // 设置动态面包屑标题：显示订单号
  useBreadcrumbTitle(order ? `订单 ${order.orderNumber}` : null);

  // ✅ 使用新的 useUpdateSalesOrderStatus Hook，自动处理缓存刷新
  const updateStatusMutation = useUpdateSalesOrderStatus({
    onSuccess: () => {
      toast({
        title: '操作成功',
        description: '订单状态已更新',
        variant: 'success',
      });
      setIsUpdatingStatus(false);

      // ✅ 缓存自动刷新，无需手动调用 refetchQueries
      // useUpdateSalesOrderStatus Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单详情、列表、统计
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款、库存预警）
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
    updateStatusMutation.mutate({
      id,
      status: 'shipped',
      idempotencyKey: crypto.randomUUID(),
    });
  };

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => router.push('/sales-orders')}
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

  // 统一以“片”为基准统计总数量：quantity 始终存储为总片数
  const totalDisplayQuantity = orderItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
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
    <div className="flex h-full flex-col overflow-auto bg-slate-50/30">
      <div
        id="sales-order-export-content"
        className="mx-auto w-full max-w-[1680px] space-y-8 p-4 lg:p-10 xl:p-14"
      >
        <HeaderCard
          order={order}
          id={id}
          canEditOrder={canEditOrder}
          isUpdatingStatus={isUpdatingStatus}
          onConfirmShipment={handleConfirmShipment}
          onShowToast={(title, description, variant = 'default') =>
            toast({ title, description, variant })
          }
          density={density}
          onDensityChange={setDensity}
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

        <OrderReconciliationSummaryCard order={order} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-8">
          <div className="space-y-6 lg:col-span-3">
            <BasicInfoCard order={order} />
            <RelatedReturnOrdersCard order={order} />
            <OrderItemsTable
              order={order}
              totalDisplayQuantity={totalDisplayQuantity}
              totalLocalQuantity={totalLocalQuantity}
              totalTransferQuantity={totalTransferQuantity}
              productSubtotal={productSubtotal}
              density={density}
            />
            <FeeItemsCard order={order} productSubtotal={productSubtotal} />
          </div>
          <div className="space-y-4">
            <PaymentsCard order={order} />
            <PrepaymentUsageCard order={order} />
            <OperationHistoryCard order={order} userName={userName} />
          </div>
        </div>
      </div>
    </div>
  );
}
