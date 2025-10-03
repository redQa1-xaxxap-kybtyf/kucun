'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
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
import { queryKeys } from '@/lib/queryKeys';
import { SALES_ORDER_STATUS_LABELS } from '@/lib/types/sales-order';
import { formatCurrency, formatDate } from '@/lib/utils';

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
      unit: string;
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

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<SalesOrderDetail>({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => fetchSalesOrderDetail(id),
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
          error instanceof Error ? error.message : '获取销售订单详情失败'
        }
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'shipped':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getOrderTypeBadge = (orderType: string) =>
    orderType === 'TRANSFER' ? (
      <Badge variant="secondary">调货销售</Badge>
    ) : (
      <Badge variant="outline">正常销售</Badge>
    );

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
            <h1 className="text-2xl font-bold">销售订单详情</h1>
            <p className="text-muted-foreground">订单号：{order.orderNumber}</p>
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
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>复制订单</DropdownMenuItem>
              <DropdownMenuItem>发送邮件</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                删除订单
              </DropdownMenuItem>
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
                    订单状态
                  </label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {SALES_ORDER_STATUS_LABELS[
                        order.status as keyof typeof SALES_ORDER_STATUS_LABELS
                      ] || order.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    订单类型
                  </label>
                  <div className="mt-1">
                    {getOrderTypeBadge(order.orderType)}
                  </div>
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
                {order.supplier && (
                  <>
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        供应商
                      </label>
                      <p className="mt-1">{order.supplier.name}</p>
                    </div>
                  </>
                )}
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

          {/* 订单明细 */}
          <Card>
            <CardHeader>
              <CardTitle>订单明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {item.isManualProduct
                            ? item.manualProductName
                            : item.product?.name}
                        </h4>
                        <div className="text-muted-foreground space-y-1 text-sm">
                          {!item.isManualProduct && (
                            <p>产品编码：{item.product?.code}</p>
                          )}
                          {item.colorCode && <p>颜色：{item.colorCode}</p>}
                          {item.productionDate && (
                            <p>生产日期：{formatDate(item.productionDate)}</p>
                          )}
                          {item.isManualProduct && item.manualSpecification && (
                            <p>规格：{item.manualSpecification}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium">
                          {formatCurrency(item.subtotal)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </p>
                        {item.costSubtotal && (
                          <p className="text-muted-foreground text-xs">
                            成本：{formatCurrency(item.costSubtotal)}
                          </p>
                        )}
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
                <span className="text-muted-foreground">订单总金额</span>
                <span className="font-medium">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
              {order.orderType === 'TRANSFER' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总成本</span>
                    <span className="font-medium">
                      {formatCurrency(order.costAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总毛利</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(order.profitAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">毛利率</span>
                    <span className="font-medium text-green-600">
                      {order.totalAmount > 0
                        ? (
                            (order.profitAmount / order.totalAmount) *
                            100
                          ).toFixed(1)
                        : '0.0'}
                      %
                    </span>
                  </div>
                </>
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
                    <p className="text-sm font-medium">订单创建</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
                {order.updatedAt !== order.createdAt && (
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">订单更新</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(order.updatedAt)}
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
  );
}
