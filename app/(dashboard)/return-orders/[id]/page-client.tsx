'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import {
  getActionableRefundForReturnOrder,
  getReturnOrderDisplayStatus,
  getReturnOrderPendingRefundAmount,
  RETURN_ORDER_MODE_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  type ReturnOrderStatus,
  type ReturnProcessType,
  type ReturnOrderRefundSummary,
} from '@/lib/types/return-order';
import { formatCurrency } from '@/lib/utils';
import { csrfFetch } from '@/lib/utils/csrf';
import { formatDateTime } from '@/lib/utils/datetime';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

const ReturnOrderHeaderActions = dynamic(
  () =>
    import('./ReturnOrderHeaderActions').then(mod => mod.ReturnOrderHeaderActions),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
        <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
        <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
        <div className="bg-muted h-8 w-8 animate-pulse rounded-md" />
      </div>
    ),
  }
);

const PrintTemplatePreviewDialog = dynamic(
  () =>
    import('@/components/print-designer/renderer/PrintTemplatePreviewDialog').then(
      mod => mod.PrintTemplatePreviewDialog
    ),
  { ssr: false, loading: () => null }
);

interface ReturnOrderDetail {
  id: string;
  returnNumber: string;
  returnMode: 'single_order' | 'multi_order';
  salesOrderId?: string;
  customerId: string;
  userId: string;
  status: ReturnOrderStatus;
  type: string;
  processType: ReturnProcessType;
  reason: string;
  totalAmount: number;
  refundAmount: number;
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
  salesOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  refunds?: ReturnOrderRefundSummary[];
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
      specification?: string;
      piecesPerUnit?: number;
    };
    salesOrderItem?: {
      id: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      displayUnit?: string | null;
      displayQuantity?: number | null;
      piecesPerUnit?: number | null;
      specification?: string | null;
      batchNumber?: string | null;
    };
  }>;
}

// 单位标签规范化：将英文单位转换为中文标签
function normalizeUnitLabel(unit?: string): string {
  if (!unit) return '片';
  const trimmed = unit.trim();
  if (!trimmed) return '片';
  if (trimmed === '件' || trimmed === '片') return trimmed;

  const lower = trimmed.toLowerCase();
  if (['piece', 'pieces', 'sheet', 'sheets', 'pc', 'pcs'].includes(lower)) {
    return '片';
  }
  if (['box', 'boxes', 'pack', 'package', 'unit', 'units'].includes(lower)) {
    return '件';
  }

  return trimmed;
}

type ReturnOrderItemDetail = ReturnOrderDetail['items'][number];

function formatQuantityWithPieces(
  rawQuantity: number,
  item: ReturnOrderItemDetail
): string {
  const qty = Math.floor(rawQuantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    return '0';
  }

  // 优先使用销售订单明细上的每件片数，其次使用产品上的 piecesPerUnit
  const ppuFromItem =
    typeof item.salesOrderItem?.piecesPerUnit === 'number' &&
    item.salesOrderItem.piecesPerUnit > 0
      ? item.salesOrderItem.piecesPerUnit
      : undefined;
  const ppuFromProduct =
    typeof item.product.piecesPerUnit === 'number' &&
    item.product.piecesPerUnit > 0
      ? item.product.piecesPerUnit
      : undefined;

  const piecesPerUnit = ppuFromItem ?? ppuFromProduct;

  if (piecesPerUnit && piecesPerUnit > 0) {
    const { fullUnits, remainingPieces, totalPieces } = calculatePieceDisplay(
      qty,
      piecesPerUnit
    );

    if (fullUnits === 0) {
      return `${totalPieces}片`;
    }
    if (remainingPieces === 0) {
      return `${fullUnits}件（共${totalPieces}片）`;
    }

    return `${fullUnits}件${remainingPieces}片（共${totalPieces}片）`;
  }

  // 没有每件片数时，退回到“数量 + 单位”
  const unitLabel = normalizeUnitLabel(item.product.unit);
  return `${qty}${unitLabel}`;
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

interface ReturnOrderDetailPageClientProps {
  id: string;
}

export function ReturnOrderDetailPageClient({
  id,
}: ReturnOrderDetailPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isGeneratingRefund, setIsGeneratingRefund] = useState(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<ReturnOrderDetail>({
    queryKey: queryKeys.returnOrders.detail(id),
    queryFn: () => fetchReturnOrderDetail(id),
    enabled: !!id,
  });

  // 设置动态面包屑标题：显示退货单号
  useBreadcrumbTitle(order ? `退货单 ${order.returnNumber}` : null);

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

  const writeOffAmount = order.totalAmount - order.refundAmount;
  const hasWriteOff = Math.abs(writeOffAmount) > 0.005;
  const displayStatus = getReturnOrderDisplayStatus(order);
  const actionableRefund = getActionableRefundForReturnOrder(order);
  const pendingRefundAmount = getReturnOrderPendingRefundAmount(order);
  const showRefundActionCard =
    order.processType === 'refund' &&
    order.status === 'completed' &&
    pendingRefundAmount > 0.005;

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleRefundAction = async () => {
    if (actionableRefund?.id) {
      router.push(`/finance/refunds/${actionableRefund.id}/process`);
      return;
    }

    try {
      setIsGeneratingRefund(true);
      const response = await csrfFetch(`/api/return-orders/${id}/refund`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success || !result.data?.refundId) {
        throw new Error(result.error || result.message || '生成退款处理单失败');
      }

      router.push(`/finance/refunds/${result.data.refundId}/process`);
    } catch (error) {
      toast({
        title: '处理失败',
        description: error instanceof Error ? error.message : '生成退款处理单失败',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingRefund(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 - 统一风格 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl">
                    退货订单详情
                  </h1>
                  <Badge
                    variant={displayStatus.variant}
                    className="text-xs sm:text-sm"
                  >
                    {getStatusIcon(displayStatus.value)}
                    <span className="ml-1">
                      {displayStatus.label}
                    </span>
                  </Badge>
                </div>
                <p className="text-[10px] text-[hsl(var(--color-text-secondary))] sm:text-xs">
                  退货单号：{order.returnNumber}
                </p>
              </div>
              <ReturnOrderHeaderActions
                id={id}
                processType={order.processType}
                returnNumber={order.returnNumber}
                status={order.status}
                onPrint={() => setIsPrintDialogOpen(true)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {/* 基本信息 */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))]">
                <CardTitle className="text-lg">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* 客户信息 */}
                  <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      客户信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          客户名称
                        </label>
                        <p className="mt-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {order.customer.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          联系电话
                        </label>
                        <p className="mt-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {order.customer.phone || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 订单信息 */}
                  <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      订单信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          退货模式
                        </label>
                        <p className="mt-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {RETURN_ORDER_MODE_LABELS[
                            order.returnMode as keyof typeof RETURN_ORDER_MODE_LABELS
                          ] || order.returnMode}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          退货类型
                        </label>
                        <p className="mt-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {RETURN_ORDER_TYPE_LABELS[
                            order.type as keyof typeof RETURN_ORDER_TYPE_LABELS
                          ] || order.type}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          处理方式
                        </label>
                        <p className="mt-1 font-medium text-[hsl(var(--color-text-primary))]">
                          {RETURN_PROCESS_TYPE_LABELS[
                            order.processType as keyof typeof RETURN_PROCESS_TYPE_LABELS
                          ] || order.processType}
                        </p>
                      </div>
                      {order.salesOrder && (
                        <div>
                          <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                            关联销售订单
                          </label>
                          <p className="mt-1">
                            <Button
                              variant="link"
                              className="h-auto p-0 text-[hsl(var(--color-primary))] hover:underline"
                              onClick={() => {
                                if (!order.salesOrder) {
                                  return;
                                }
                                router.push(
                                  `/sales-orders/${order.salesOrder.id}`
                                );
                              }}
                            >
                              {order.salesOrder.orderNumber}
                            </Button>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 其他信息 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        退货原因
                      </label>
                      <p className="mt-1 text-[hsl(var(--color-text-secondary))]">
                        {order.reason}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        创建人
                      </label>
                      <p className="mt-1 text-[hsl(var(--color-text-secondary))]">
                        {order.user.name}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        创建时间
                      </label>
                      <p className="mt-1 text-[hsl(var(--color-text-secondary))]">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        更新时间
                      </label>
                      <p className="mt-1 text-[hsl(var(--color-text-secondary))]">
                        {formatDateTime(order.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {order.remarks && (
                    <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] p-3">
                      <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        备注信息
                      </label>
                      <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                        {order.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 退货明细 */}
            <Card>
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))]">
                <CardTitle className="text-lg">退货明细</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[hsl(var(--color-bg-tertiary))]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          产品信息
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          规格/色号
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          原始数量
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          退货数量
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          破损数量
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          单价
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                          小计
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--color-border-secondary))]">
                      {order.items.map(item => (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-[hsl(var(--color-bg-tertiary))]"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-[hsl(var(--color-text-primary))]">
                                {item.product.name}
                              </p>
                              <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                                {item.product.code}
                              </p>
                              {item.reason && (
                                <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                                  原因：{item.reason}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 text-sm">
                              {(() => {
                                const specification =
                                  item.product.specification ||
                                  item.salesOrderItem?.specification ||
                                  '';
                                const hasSpec = Boolean(specification);
                                const hasColor = Boolean(item.colorCode);
                                const hasBatch = Boolean(
                                  item.salesOrderItem?.batchNumber
                                );
                                const hasDate = Boolean(item.productionDate);

                                return (
                                  <>
                                    {hasSpec && (
                                      <p className="text-[hsl(var(--color-text-secondary))]">
                                        {specification}
                                      </p>
                                    )}
                                    {hasColor && (
                                      <p className="text-[hsl(var(--color-text-secondary))]">
                                        色号：{item.colorCode}
                                      </p>
                                    )}
                                    {hasBatch && (
                                      <p className="text-[hsl(var(--color-text-secondary))]">
                                        批次号：
                                        {item.salesOrderItem?.batchNumber}
                                      </p>
                                    )}
                                    {hasDate && (
                                      <p className="text-[hsl(var(--color-text-tertiary))]">
                                        {item.productionDate}
                                      </p>
                                    )}
                                    {!hasSpec &&
                                      !hasColor &&
                                      !hasBatch &&
                                      !hasDate && (
                                        <span className="text-[hsl(var(--color-text-tertiary))]">
                                          -
                                        </span>
                                      )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                              {formatQuantityWithPieces(
                                item.originalQuantity || 0,
                                item
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-[hsl(var(--color-error))]">
                              {formatQuantityWithPieces(
                                item.returnQuantity || 0,
                                item
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                            {formatQuantityWithPieces(
                              item.damagedQuantity || 0,
                              item
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-[hsl(var(--color-text-primary))]">
                              {formatCurrency(item.subtotal)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))]">
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-right text-sm font-medium text-[hsl(var(--color-text-primary))]"
                        >
                          退货总金额：
                        </td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-[hsl(var(--color-error))]">
                          {formatCurrency(order.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 金额汇总 */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))]">
                <CardTitle className="text-lg">金额汇总</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      退货总金额
                    </span>
                    <span className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      实际退款金额
                    </span>
                    <div className="text-right">
                      <span className="block text-lg font-bold text-[hsl(var(--color-error))]">
                        {formatCurrency(order.refundAmount)}
                      </span>
                      {hasWriteOff && (
                        <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          已核销 {formatCurrency(Math.abs(writeOffAmount))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                {order.salesOrder && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--color-text-tertiary))]">
                      原销售订单金额
                    </span>
                    <span className="font-medium text-[hsl(var(--color-text-secondary))]">
                      {formatCurrency(order.salesOrder.totalAmount)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {showRefundActionCard && (
              <Card className="border-[hsl(var(--color-warning))]/30 bg-[hsl(var(--color-warning-light))]/40">
                <CardHeader className="border-b border-[hsl(var(--color-warning))]/20">
                  <CardTitle className="text-lg">退款处理</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="rounded-xl border border-[hsl(var(--color-warning))]/25 bg-white/80 p-4">
                    <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                      这张退货单已经完成，库存已回补。
                    </p>
                    <p className="mt-2 text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      待退款金额：{formatCurrency(pendingRefundAmount)}
                    </p>
                    {actionableRefund?.id ? (
                      <p className="mt-2 text-xs text-[hsl(var(--color-text-tertiary))]">
                        已生成退款单，继续处理资金即可，不会再次改库存。
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-[hsl(var(--color-text-tertiary))]">
                        还没有退款处理单，点击下方按钮可自动生成并进入处理页面。
                      </p>
                    )}
                  </div>
                  <Button
                    size="lg"
                    className="h-11 w-full"
                    onClick={handleRefundAction}
                    disabled={isGeneratingRefund}
                  >
                    {isGeneratingRefund
                      ? '处理中...'
                      : actionableRefund?.id
                        ? '去处理退款'
                        : '生成并处理退款'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 操作历史 */}
            <Card>
              <CardHeader>
                <CardTitle>操作历史</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">退货申请创建</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  {order.updatedAt !== order.createdAt && (
                    <div className="flex items-center space-x-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          displayStatus.value === 'completed'
                            ? 'bg-green-500'
                            : displayStatus.value === 'rejected' ||
                                displayStatus.value === 'cancelled'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                        }`}
                      ></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          状态更新为：
                          {displayStatus.label}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(order.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {isPrintDialogOpen && (
        <PrintTemplatePreviewDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          templateType="return-order"
          documentId={id}
          title="退货订单打印"
        />
      )}
    </div>
  );
}
