'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  DollarSign,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  Receipt,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorMessage } from '@/components/ui/error-message';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import {
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_STATUS_VARIANTS,
  type ReturnOrderStatus,
} from '@/lib/types/return-order';
import {
  SALES_ORDER_STATUS_LABELS,
  TRANSFER_MODE_LABELS,
} from '@/lib/types/sales-order';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSalesOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}

interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  supplierId?: string;
  status: string;
  orderType: string;
  transferMode: string;
  itemsAmount: number;
  additionalFees: number;
  roundingAdjustment: number;
  totalAmount: number;
  costAmount: number;
  profitAmount: number;
  paidAmount: number;
  remainingAmount: number;
  remarks?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
  hasReturnOrder?: boolean;
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
    batchNumber?: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitCost?: number;
    costSubtotal?: number;
    profitAmount?: number;
    localQuantity?: number;
    transferQuantity?: number;
    isManualProduct: boolean;
    manualProductName?: string;
    manualSpecification?: string;
    manualWeight?: number;
    manualUnit?: string;
    displayUnit?: string;
    displayQuantity?: number;
    piecesPerUnit?: number;
    specification?: string;
    remarks?: string;
    product?: {
      id: string;
      code: string;
      name: string;
      unit: string;
      specification?: string;
      piecesPerUnit?: number;
      weight?: number;
    };
  }>;
  feeItems: Array<{
    id: string;
    feeType: string;
    feeName: string;
    feeAmount: number;
    remarks?: string;
  }>;
  returnOrders?: Array<{
    id: string;
    returnNumber: string;
    status: string;
    createdAt: string;
  }>;
  paymentRecords: PaymentRecord[];
}

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

function formatDecimal(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(4).replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

/**
 * 格式化数量显示，优先使用录入时的显示数量
 */
function formatQuantityDisplay(item: SalesOrderDetail['items'][0]): string {
  const value =
    typeof item.displayQuantity === 'number'
      ? item.displayQuantity
      : item.quantity;

  return formatDecimal(value);
}

function formatPiecesBreakdown(
  item: SalesOrderDetail['items'][0]
): string | null {
  const quantity = item.quantity;
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;

  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    return null;
  }

  if (!piecesPerUnit || piecesPerUnit <= 1) {
    // 如果没有件/片换算，则直接返回片数
    return `${formatDecimal(quantity)}片`;
  }

  const fullUnits = Math.floor(quantity / piecesPerUnit);
  const remainder = quantity % piecesPerUnit;

  if (remainder === 0) {
    return `${fullUnits}件`;
  }

  if (fullUnits === 0) {
    return `${remainder}片`;
  }

  return `${fullUnits}件${remainder}片`;
}

function resolveUnitLabel(item: SalesOrderDetail['items'][0]): string {
  if (typeof item.displayUnit === 'string' && item.displayUnit.trim()) {
    return item.displayUnit.trim();
  }

  if (
    item.isManualProduct &&
    typeof item.manualUnit === 'string' &&
    item.manualUnit.trim()
  ) {
    return item.manualUnit.trim();
  }

  if (item.product?.unit) {
    return item.product.unit;
  }

  return '片';
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

  const isReturnOrderStatus = (value: unknown): value is ReturnOrderStatus =>
    typeof value === 'string' && value in RETURN_ORDER_STATUS_LABELS;

  const getOrderTypeBadge = (orderType: string) =>
    orderType === 'TRANSFER' ? (
      <Badge variant="secondary">调货销售</Badge>
    ) : (
      <Badge variant="outline">正常销售</Badge>
    );
  const getTransferModeBadge = (mode: string | undefined) => {
    const label =
      mode === 'MIXED'
        ? TRANSFER_MODE_LABELS.MIXED
        : TRANSFER_MODE_LABELS.SUPPLIER_ONLY;

    return mode === 'MIXED' ? (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-700"
      >
        {label}
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        {label}
      </Badge>
    );
  };

  const orderItems = order.items ?? [];
  const relatedReturnOrders = order.returnOrders ?? [];
  const customerName = order.customer?.name ?? '未关联客户';
  const customerPhone = order.customer?.phone ?? '-';
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
  const canEditOrder = order.status === 'draft';
  const canDeleteOrder = canEditOrder;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 - 使用标准风格 */}
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    销售订单详情
                  </h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    <span className="font-medium">
                      订单号：{order.orderNumber}
                    </span>
                    <Badge
                      variant={getSalesOrderStatusBadgeVariant(order.status)}
                    >
                      {SALES_ORDER_STATUS_LABELS[
                        order.status as keyof typeof SALES_ORDER_STATUS_LABELS
                      ] || order.status}
                    </Badge>
                    {getOrderTypeBadge(order.orderType)}
                    {order.orderType === 'TRANSFER' &&
                      getTransferModeBadge(order.transferMode)}
                  </div>
                  {order.returnOrders && order.returnOrders.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                      <span className="font-medium">关联退货单：</span>
                      {order.returnOrders.map(returnOrder => (
                        <Button
                          key={returnOrder.id}
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-[hsl(var(--color-primary))]"
                          onClick={() =>
                            router.push(`/return-orders/${returnOrder.id}`)
                          }
                        >
                          {returnOrder.returnNumber}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="h-11"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (canEditOrder) {
                      router.push(`/sales-orders/${id}/edit`);
                    } else {
                      alert('只有草稿状态的订单才能编辑');
                    }
                  }}
                  disabled={!canEditOrder}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
                {order.status === 'confirmed' && (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleConfirmShipment}
                    disabled={isUpdatingStatus}
                    className="bg-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-dark))]"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    {isUpdatingStatus ? '处理中...' : '确认发货'}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="lg">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Printer className="mr-2 h-4 w-4" />
                      打印订单
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="mr-2 h-4 w-4" />
                      导出订单
                    </DropdownMenuItem>
                    <DropdownMenuItem>复制订单</DropdownMenuItem>
                    {canDeleteOrder && (
                      <DropdownMenuItem className="text-[hsl(var(--color-error))]">
                        删除订单
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 金额统计卡片 - 顶部突出显示 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="border border-[hsl(var(--color-border-primary))]"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                订单总金额
              </div>
              <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-primary))]">
                {formatCurrency(order.totalAmount)}
              </div>
            </CardContent>
          </Card>

          <Card
            className="border border-green-200 bg-green-50/50"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-600">已收金额</div>
              <div className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(order.paidAmount)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {
                  order.paymentRecords.filter(r => r.status === 'confirmed')
                    .length
                }{' '}
                笔收款
              </div>
            </CardContent>
          </Card>

          <Card
            className="border border-orange-200 bg-orange-50/50"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-600">待收金额</div>
              <div className="mt-2 text-2xl font-bold text-orange-600">
                {formatCurrency(order.remainingAmount)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {order.remainingAmount > 0 ? '未完成收款' : '已全部收款'}
              </div>
            </CardContent>
          </Card>

          {order.orderType === 'TRANSFER' && (
            <Card
              className="border border-[hsl(var(--color-border-primary))]"
              style={{ boxShadow: 'var(--shadow-light)' }}
            >
              <CardContent className="p-4">
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  毛利金额
                </div>
                <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-success))]">
                  {formatCurrency(order.profitAmount)}
                </div>
                <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                  毛利率：
                  {order.totalAmount > 0
                    ? ((order.profitAmount / order.totalAmount) * 100).toFixed(
                        1
                      )
                    : '0.0'}
                  %
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 基本信息 */}
          <div className="space-y-4 lg:col-span-2">
            <Card
              className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
              style={{ boxShadow: 'var(--shadow-medium)' }}
            >
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
                <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
                  <ShoppingCart className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      客户名称
                    </div>
                    <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                      {customerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      客户电话
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {customerPhone}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单状态
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant={getSalesOrderStatusBadgeVariant(order.status)}
                        className="text-xs"
                      >
                        {SALES_ORDER_STATUS_LABELS[
                          order.status as keyof typeof SALES_ORDER_STATUS_LABELS
                        ] || order.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单类型
                    </div>
                    <div className="mt-2 space-y-1">
                      {getOrderTypeBadge(order.orderType)}
                      {order.orderType === 'TRANSFER' && (
                        <div>{getTransferModeBadge(order.transferMode)}</div>
                      )}
                    </div>
                  </div>
                  {order.supplier && (
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        供应商
                      </div>
                      <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        {order.supplier.name}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建人
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {userName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建时间
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {formatDate(order.createdAt, 'datetime')}
                    </div>
                  </div>
                  {order.shippedAt && (
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        发货时间
                      </div>
                      <div className="mt-2 text-sm font-medium text-[hsl(var(--color-primary))]">
                        {formatDate(order.shippedAt, 'datetime')}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      更新时间
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {formatDate(order.updatedAt, 'datetime')}
                    </div>
                  </div>
                </div>
                {order.remarks && (
                  <div className="mt-4 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] p-4">
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      备注信息
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {order.remarks}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {relatedReturnOrders.length > 0 && (
              <Card
                className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
                style={{ boxShadow: 'var(--shadow-medium)' }}
              >
                <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
                  <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
                    <Receipt className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
                    关联退货单
                  </CardTitle>
                </CardHeader>
                <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] text-xs text-[hsl(var(--color-text-secondary))]">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">
                            退货单号
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            状态
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            创建时间
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--color-border-secondary))]">
                        {relatedReturnOrders.map(returnOrder => {
                          const status = isReturnOrderStatus(returnOrder.status)
                            ? returnOrder.status
                            : 'draft';

                          return (
                            <tr
                              key={returnOrder.id}
                              className="text-[hsl(var(--color-text-primary))]"
                            >
                              <td className="px-4 py-3 font-mono text-[hsl(var(--color-primary))]">
                                {returnOrder.returnNumber}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    RETURN_ORDER_STATUS_VARIANTS[status] ??
                                    'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {RETURN_ORDER_STATUS_LABELS[status] ?? status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                                {formatDate(returnOrder.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="px-0 text-[hsl(var(--color-primary))]"
                                  onClick={() =>
                                    router.push(
                                      `/return-orders/${returnOrder.id}`
                                    )
                                  }
                                >
                                  查看详情
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 订单明细 */}
            <Card
              className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
              style={{ boxShadow: 'var(--shadow-medium)' }}
            >
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                    <ShoppingCart className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                    订单明细
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-[hsl(var(--color-text-secondary))]">
                    <span>
                      共{' '}
                      <strong className="text-[hsl(var(--color-primary))]">
                        {orderItems.length}
                      </strong>{' '}
                      种产品
                    </span>
                    <span>
                      总数量：
                      <strong className="text-[hsl(var(--color-primary))]">
                        {formatDecimal(totalDisplayQuantity)}
                      </strong>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
                {/* ERP风格表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead
                      className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]"
                      style={{ boxShadow: 'var(--shadow-light)' }}
                    >
                      <tr className="text-xs text-[hsl(var(--color-text-secondary))]">
                        <th className="px-4 py-3 text-left font-medium">
                          产品信息
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          产品编码
                        </th>
                        <th className="px-4 py-3 text-center font-medium">
                          每件片数
                        </th>
                        <th className="px-4 py-3 text-center font-medium">
                          批次 / 生产日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          规格
                        </th>
                        <th className="px-4 py-3 text-center font-medium">
                          单位
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          数量
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          单价
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          小计
                        </th>
                        {order.orderType === 'TRANSFER' && (
                          <>
                            <th className="px-4 py-3 text-right font-medium">
                              本地发货
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              调货数量
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              成本
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              毛利
                            </th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left font-medium">
                          备注
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orderItems.map(item => {
                        const unitLabel = resolveUnitLabel(item);
                        const quantityDisplay = formatQuantityDisplay(item);
                        const piecesPerUnitDisplay =
                          item.piecesPerUnit ?? item.product?.piecesPerUnit;

                        const remarkParts: string[] = [];
                        const piecesBreakdown = formatPiecesBreakdown(item);
                        if (piecesBreakdown) {
                          remarkParts.push(piecesBreakdown);
                        }
                        const manualRemark =
                          typeof item.remarks === 'string'
                            ? item.remarks.trim()
                            : '';
                        if (manualRemark && manualRemark !== piecesBreakdown) {
                          remarkParts.push(manualRemark);
                        }
                        if (typeof item.manualWeight === 'number') {
                          remarkParts.push(
                            `重量：${formatDecimal(item.manualWeight)}${
                              item.manualUnit ? item.manualUnit : ''
                            }`
                          );
                        }
                        const remarkText =
                          remarkParts.length > 0 ? remarkParts.join('；') : '-';
                        const specificationText = item.isManualProduct
                          ? item.manualSpecification ||
                            item.specification ||
                            '-'
                          : item.specification ||
                            item.product?.specification ||
                            '-';

                        return (
                          <tr
                            key={item.id}
                            className="transition-colors hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {item.isManualProduct
                                  ? item.manualProductName
                                  : item.product?.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <div className="font-mono text-sm">
                                {!item.isManualProduct
                                  ? item.product?.code
                                  : '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {typeof piecesPerUnitDisplay === 'number'
                                ? formatDecimal(piecesPerUnitDisplay)
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              <div className="text-xs font-medium text-gray-900">
                                {item.batchNumber || '-'}
                              </div>
                              {item.productionDate && (
                                <div className="mt-0.5 text-[11px] text-gray-500">
                                  {formatDate(item.productionDate)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <div className="text-sm">{specificationText}</div>
                              {item.colorCode && (
                                <div className="mt-0.5 text-[11px] text-gray-500">
                                  色号：{item.colorCode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {unitLabel || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {quantityDisplay}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {formatCurrency(item.subtotal)}
                            </td>
                            {order.orderType === 'TRANSFER' && (
                              <>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {formatDecimal(item.localQuantity ?? 0)} 片
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {formatDecimal(item.transferQuantity ?? 0)} 片
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {item.costSubtotal
                                    ? formatCurrency(item.costSubtotal)
                                    : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-green-600">
                                  {item.profitAmount
                                    ? formatCurrency(item.profitAmount)
                                    : '-'}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-gray-700">
                              <div className="text-sm">{remarkText}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* 合计行 */}
                    <tfoot className="border-t-2 bg-gray-50/80 font-medium">
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-right text-gray-700"
                        >
                          合计
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          <div>{formatDecimal(totalDisplayQuantity)}</div>
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right text-lg text-blue-600">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        {order.orderType === 'TRANSFER' && (
                          <>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatDecimal(totalLocalQuantity)} 片
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatDecimal(totalTransferQuantity)} 片
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatCurrency(order.costAmount)}
                            </td>
                            <td className="px-4 py-3 text-right text-lg text-green-600">
                              {formatCurrency(order.profitAmount)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4">
            {/* 收款记录 */}
            <Card
              className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
              style={{ boxShadow: 'var(--shadow-medium)' }}
            >
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
                <CardTitle className="flex items-center justify-between text-base text-[hsl(var(--color-text-primary))]">
                  <div className="flex items-center">
                    <Receipt className="mr-2 h-4 w-4 text-[hsl(var(--color-success))]" />
                    收款记录
                  </div>
                  <span className="text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
                    {
                      order.paymentRecords.filter(r => r.status === 'confirmed')
                        .length
                    }{' '}
                    / {order.paymentRecords.length} 笔
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
                {/* 订单金额总览 */}
                <div className="mb-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                        <DollarSign className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        订单总金额
                      </span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(order.totalAmount)}
                    </div>
                  </div>

                  {/* 收款进度条 */}
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        收款进度
                      </span>
                      <span className="text-xs font-bold text-green-600">
                        {order.totalAmount > 0
                          ? (
                              (order.paidAmount / order.totalAmount) *
                              100
                            ).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                        style={{
                          width: `${order.totalAmount > 0 ? (order.paidAmount / order.totalAmount) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* 收款明细统计 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-white/60 p-2 text-center">
                      <div className="text-xs text-gray-600">已确认</div>
                      <div className="mt-1 text-sm font-bold text-green-600">
                        {formatCurrency(order.paidAmount)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {
                          order.paymentRecords.filter(
                            r => r.status === 'confirmed'
                          ).length
                        }{' '}
                        笔
                      </div>
                    </div>
                    <div className="rounded-md bg-white/60 p-2 text-center">
                      <div className="text-xs text-gray-600">待确认</div>
                      <div className="mt-1 text-sm font-bold text-yellow-600">
                        {formatCurrency(
                          order.paymentRecords
                            .filter(r => r.status === 'pending')
                            .reduce(
                              (sum, r) => sum + Number(r.paymentAmount),
                              0
                            )
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {
                          order.paymentRecords.filter(
                            r => r.status === 'pending'
                          ).length
                        }{' '}
                        笔
                      </div>
                    </div>
                    <div className="rounded-md bg-white/60 p-2 text-center">
                      <div className="text-xs text-gray-600">待收款</div>
                      <div className="mt-1 text-sm font-bold text-orange-600">
                        {formatCurrency(order.remainingAmount)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {order.remainingAmount > 0 ? '未完成' : '已完成'}
                      </div>
                    </div>
                  </div>
                </div>

                {order.paymentRecords.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[hsl(var(--color-text-tertiary))]">
                    暂无收款记录
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 待确认收款 */}
                    {order.paymentRecords.filter(r => r.status === 'pending')
                      .length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="h-px flex-1 bg-yellow-200"></div>
                          <span className="text-xs font-semibold text-yellow-700">
                            ⏱ 待确认收款
                          </span>
                          <div className="h-px flex-1 bg-yellow-200"></div>
                        </div>
                        <div className="space-y-2">
                          {order.paymentRecords
                            .filter(r => r.status === 'pending')
                            .map((record, index) => (
                              <div
                                key={record.id}
                                className="group relative overflow-hidden rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4 shadow-sm transition-all hover:border-yellow-400 hover:shadow-md"
                              >
                                <div className="absolute top-0 left-0 h-full w-1 bg-yellow-500"></div>
                                <div className="pl-3">
                                  <div className="mb-2 flex items-start justify-between">
                                    <div>
                                      <div className="text-lg font-bold text-gray-900">
                                        {formatCurrency(record.paymentAmount)}
                                      </div>
                                      <div className="mt-0.5 text-xs text-gray-600">
                                        待确认第 {index + 1} 笔
                                      </div>
                                    </div>
                                    <Badge className="border-yellow-300 bg-yellow-100 text-yellow-700">
                                      ⏱ 待确认
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 rounded-md bg-white/60 p-2 text-xs">
                                    <div>
                                      <span className="text-gray-600">
                                        收款日期
                                      </span>
                                      <div className="mt-0.5 font-medium text-gray-800">
                                        {formatDate(
                                          record.paymentDate,
                                          'datetime'
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">
                                        支付方式
                                      </span>
                                      <div className="mt-0.5 font-medium text-gray-800">
                                        {record.paymentMethod === 'cash'
                                          ? '💵 现金'
                                          : record.paymentMethod ===
                                              'bank_transfer'
                                            ? '🏦 银行转账'
                                            : record.paymentMethod === 'alipay'
                                              ? '🔵 支付宝'
                                              : record.paymentMethod ===
                                                  'wechat'
                                                ? '💚 微信支付'
                                                : record.paymentMethod ===
                                                    'check'
                                                  ? '📝 支票'
                                                  : '📌 其他'}
                                      </div>
                                    </div>
                                  </div>
                                  {record.paymentNumber && (
                                    <div className="mt-2 flex items-center gap-1 text-xs">
                                      <span className="text-gray-600">
                                        单号:
                                      </span>
                                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-700">
                                        {record.paymentNumber}
                                      </code>
                                    </div>
                                  )}
                                  {record.remarks && (
                                    <div className="mt-2 rounded border-l-2 border-yellow-400 bg-white px-2 py-1.5 text-xs text-gray-700">
                                      <span className="font-medium text-gray-600">
                                        备注：
                                      </span>
                                      {record.remarks}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 已确认收款 */}
                    {order.paymentRecords.filter(r => r.status === 'confirmed')
                      .length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="h-px flex-1 bg-green-200"></div>
                          <span className="text-xs font-semibold text-green-700">
                            ✓ 已确认收款
                          </span>
                          <div className="h-px flex-1 bg-green-200"></div>
                        </div>
                        <div className="space-y-2">
                          {order.paymentRecords
                            .filter(r => r.status === 'confirmed')
                            .map((record, index) => (
                              <div
                                key={record.id}
                                className="group relative overflow-hidden rounded-lg border-2 border-green-300 bg-green-50 p-4 shadow-sm transition-all hover:border-green-400 hover:shadow-md"
                              >
                                <div className="absolute top-0 left-0 h-full w-1 bg-green-500"></div>
                                <div className="pl-3">
                                  <div className="mb-2 flex items-start justify-between">
                                    <div>
                                      <div className="text-lg font-bold text-gray-900">
                                        {formatCurrency(record.paymentAmount)}
                                      </div>
                                      <div className="mt-0.5 text-xs text-gray-600">
                                        已确认第 {index + 1} 笔
                                      </div>
                                    </div>
                                    <Badge className="border-green-300 bg-green-100 text-green-700">
                                      ✓ 已确认
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 rounded-md bg-white/60 p-2 text-xs">
                                    <div>
                                      <span className="text-gray-600">
                                        收款日期
                                      </span>
                                      <div className="mt-0.5 font-medium text-gray-800">
                                        {formatDate(
                                          record.paymentDate,
                                          'datetime'
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">
                                        支付方式
                                      </span>
                                      <div className="mt-0.5 font-medium text-gray-800">
                                        {record.paymentMethod === 'cash'
                                          ? '💵 现金'
                                          : record.paymentMethod ===
                                              'bank_transfer'
                                            ? '🏦 银行转账'
                                            : record.paymentMethod === 'alipay'
                                              ? '🔵 支付宝'
                                              : record.paymentMethod ===
                                                  'wechat'
                                                ? '💚 微信支付'
                                                : record.paymentMethod ===
                                                    'check'
                                                  ? '📝 支票'
                                                  : '📌 其他'}
                                      </div>
                                    </div>
                                  </div>
                                  {record.paymentNumber && (
                                    <div className="mt-2 flex items-center gap-1 text-xs">
                                      <span className="text-gray-600">
                                        单号:
                                      </span>
                                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-700">
                                        {record.paymentNumber}
                                      </code>
                                    </div>
                                  )}
                                  {record.remarks && (
                                    <div className="mt-2 rounded border-l-2 border-green-400 bg-white px-2 py-1.5 text-xs text-gray-700">
                                      <span className="font-medium text-gray-600">
                                        备注：
                                      </span>
                                      {record.remarks}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 操作历史 */}
            <Card
              className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
              style={{ boxShadow: 'var(--shadow-medium)' }}
            >
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
                <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
                  <ShoppingCart className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
                  操作历史
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--color-primary))]"></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        订单创建
                      </div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                        {formatDate(order.createdAt, 'datetime')}
                      </div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                        创建人：{userName}
                      </div>
                    </div>
                  </div>
                  {order.updatedAt !== order.createdAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--color-success))]"></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          订单更新
                        </div>
                        <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                          {formatDate(order.updatedAt, 'datetime')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
