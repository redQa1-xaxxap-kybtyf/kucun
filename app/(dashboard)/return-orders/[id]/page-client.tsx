'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getReturnOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { queryKeys } from '@/lib/queryKeys';
import {
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  RETURN_ORDER_MODE_LABELS,
} from '@/lib/types/return-order';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface ReturnOrderDetail {
  id: string;
  returnNumber: string;
  returnMode: 'single_order' | 'multi_order';
  salesOrderId?: string;
  customerId: string;
  userId: string;
  status: string;
  type: string;
  processType: string;
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

interface ReturnOrderDetailPageClientProps {
  id: string;
}

export function ReturnOrderDetailPageClient({
  id,
}: ReturnOrderDetailPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<ReturnOrderDetail>({
    queryKey: queryKeys.returnOrders.detail(id),
    queryFn: () => fetchReturnOrderDetail(id),
    enabled: !!id,
  });

  // 取消退货订单
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/return-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'cancelled',
          idempotencyKey: crypto.randomUUID(),
          remarks: '用户取消退货订单',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '取消退货订单失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '取消成功',
        description: '退货订单已取消',
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.returnOrders.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.returnOrders.all });
      setShowCancelDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: '取消失败',
        description: error.message,
        variant: 'destructive',
      });
    },
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

  const writeOffAmount = order.totalAmount - order.refundAmount;
  const hasWriteOff = Math.abs(writeOffAmount) > 0.005;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题卡片 - 统一风格 */}
      <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
        <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                  退货订单详情
                </h1>
                <Badge
                  variant={getReturnOrderStatusBadgeVariant(order.status)}
                  className="text-sm"
                >
                  {getStatusIcon(order.status)}
                  <span className="ml-1">
                    {RETURN_ORDER_STATUS_LABELS[
                      order.status as keyof typeof RETURN_ORDER_STATUS_LABELS
                    ] || order.status}
                  </span>
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Printer className="mr-2 h-4 w-4" />
                打印
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
              {['draft', 'submitted'].includes(order.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/return-orders/${order.id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {order.status === 'pending' && (
                    <>
                      <DropdownMenuItem>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        批准退货
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <XCircle className="mr-2 h-4 w-4" />
                        拒绝退货
                      </DropdownMenuItem>
                    </>
                  )}
                  {['draft', 'submitted', 'approved', 'processing'].includes(
                    order.status
                  ) && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      取消退货
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>复制订单</DropdownMenuItem>
                  <DropdownMenuItem>发送邮件</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
            退货单号：{order.returnNumber}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                            onClick={() =>
                              router.push(
                                `/sales-orders/${order.salesOrder!.id}`
                              )
                            }
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
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                      更新时间
                    </label>
                    <p className="mt-1 text-[hsl(var(--color-text-secondary))]">
                      {formatDate(order.updatedAt)}
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
                            {item.product.specification && (
                              <p className="text-[hsl(var(--color-text-secondary))]">
                                {item.product.specification}
                              </p>
                            )}
                            {item.colorCode && (
                              <p className="text-[hsl(var(--color-text-secondary))]">
                                色号：{item.colorCode}
                              </p>
                            )}
                            {item.productionDate && (
                              <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                                {item.productionDate}
                              </p>
                            )}
                            {!item.product.specification &&
                              !item.colorCode &&
                              !item.productionDate && (
                                <span className="text-[hsl(var(--color-text-tertiary))]">
                                  -
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                            {item.originalQuantity}
                          </span>
                          <span className="ml-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                            {item.product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-[hsl(var(--color-error))]">
                            {item.returnQuantity}
                          </span>
                          <span className="ml-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                            {item.product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                          {item.damagedQuantity || 0}
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
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
                {order.updatedAt !== order.createdAt && (
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        order.status === 'approved' ||
                        order.status === 'completed'
                          ? 'bg-green-500'
                          : order.status === 'rejected'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        状态更新为：
                        {
                          RETURN_ORDER_STATUS_LABELS[
                            order.status as keyof typeof RETURN_ORDER_STATUS_LABELS
                          ]
                        }
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(order.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          {order.status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" size="sm">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  批准退货
                </Button>
                <Button variant="destructive" className="w-full" size="sm">
                  <XCircle className="mr-2 h-4 w-4" />
                  拒绝退货
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 取消确认对话框 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消退货订单</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要取消退货订单 <strong>{order.returnNumber}</strong> 吗？
              <br />
              <br />
              取消后：
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>该退货订单将被标记为已取消状态</li>
                <li>已取消的订单不会影响往来账单余额</li>
                <li>订单记录仍会保留在系统中用于审计追踪</li>
                <li>此操作不可撤销</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              我再想想
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? '取消中...' : '确认取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
