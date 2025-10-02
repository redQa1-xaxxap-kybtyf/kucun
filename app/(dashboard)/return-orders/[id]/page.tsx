'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import { RETURN_ORDER_STATUS_LABELS } from '@/lib/types/return-order';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ReturnOrderDetail {
  id: string;
  returnNumber: string;
  salesOrderId: string;
  customerId: string;
  userId: string;
  status: string;
  returnReason: string;
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
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  items: Array<{
    id: string;
    productId: string;
    returnQuantity: number;
    unitPrice: number;
    subtotal: number;
    returnReason?: string;
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

export default function ReturnOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['return-order', id],
    queryFn: () => fetchReturnOrderDetail(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={
          error instanceof Error ? error.message : '获取退货订单详情失败'
        }
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'completed':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

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
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">退货订单详情</h1>
            <p className="text-muted-foreground">
              退货单号：{order.returnNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            打印
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          {order.status === 'pending' && (
            <Button variant="outline" size="sm">
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
              <DropdownMenuItem>复制订单</DropdownMenuItem>
              <DropdownMenuItem>发送邮件</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    退货状态
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">
                        {RETURN_ORDER_STATUS_LABELS[
                          order.status as keyof typeof RETURN_ORDER_STATUS_LABELS
                        ] || order.status}
                      </span>
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    关联销售订单
                  </label>
                  <p className="mt-1">
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() =>
                        router.push(`/sales-orders/${order.salesOrder.id}`)
                      }
                    >
                      {order.salesOrder.orderNumber}
                    </Button>
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    客户名称
                  </label>
                  <p className="mt-1">{order.customer.name}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    客户电话
                  </label>
                  <p className="mt-1">{order.customer.phone || '-'}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    退货原因
                  </label>
                  <p className="mt-1">{order.returnReason}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    创建人
                  </label>
                  <p className="mt-1">{order.user.name}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    创建时间
                  </label>
                  <p className="mt-1">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    更新时间
                  </label>
                  <p className="mt-1">{formatDate(order.updatedAt)}</p>
                </div>
              </div>
              {order.remarks && (
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    备注信息
                  </label>
                  <p className="mt-1 text-sm">{order.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 退货明细 */}
          <Card>
            <CardHeader>
              <CardTitle>退货明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.product.name}</h4>
                        <div className="text-muted-foreground space-y-1 text-sm">
                          <p>产品编码：{item.product.code}</p>
                          <p>单位：{item.product.unit}</p>
                          {item.returnReason && (
                            <p>退货原因：{item.returnReason}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium">
                          {formatCurrency(item.subtotal)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {item.returnQuantity} ×{' '}
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                    {index < order.items.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 金额汇总 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>金额汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">退货总金额</span>
                <span className="font-medium">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">实际退款金额</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(order.refundAmount)}
                </span>
              </div>
              <Separator />
              <div className="text-muted-foreground flex justify-between text-sm">
                <span>原销售订单金额</span>
                <span>{formatCurrency(order.salesOrder.totalAmount)}</span>
              </div>
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
    </div>
  );
}
