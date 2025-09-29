'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Edit,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShoppingCart,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CustomerDetail {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  creditLimit?: number;
  status: string;
  tags?: string[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    salesOrders: number;
    returnOrders: number;
  };
  salesOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  returnOrders: Array<{
    id: string;
    returnNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
  const response = await fetch(`/api/customers/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取客户详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取客户详情失败');
  }

  return result.data;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: customer,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerDetail(id),
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
        message={error instanceof Error ? error.message : '获取客户详情失败'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!customer) {
    return (
      <ErrorMessage
        title="客户不存在"
        message="未找到指定的客户"
        onRetry={() => router.push('/customers')}
      />
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'blacklisted':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '非活跃';
      case 'blacklisted':
        return '黑名单';
      default:
        return status;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default">已确认</Badge>;
      case 'shipped':
        return <Badge variant="secondary">已发货</Badge>;
      case 'delivered':
        return <Badge variant="success">已交付</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalSalesAmount = customer.salesOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const totalReturnAmount = customer.returnOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
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
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">客户详情</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/customers/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button size="sm">
            <ShoppingCart className="mr-2 h-4 w-4" />
            创建订单
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    客户状态
                  </label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(customer.status)}>
                      {getStatusLabel(customer.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    联系人
                  </label>
                  <p className="mt-1">{customer.contactPerson || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    电话号码
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    {customer.phone ? (
                      <>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    邮箱地址
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    {customer.email ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.email}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    地址
                  </label>
                  <div className="mt-1 flex items-start space-x-2">
                    {customer.address ? (
                      <>
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{customer.address}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    信用额度
                  </label>
                  <p className="mt-1">
                    {customer.creditLimit
                      ? formatCurrency(customer.creditLimit)
                      : '无限制'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建时间
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              </div>
              {customer.tags && customer.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    标签
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {customer.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {customer.remarks && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    备注信息
                  </label>
                  <p className="mt-1 text-sm">{customer.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 统计信息 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>交易统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalSalesAmount)}
                </p>
                <p className="text-sm text-muted-foreground">累计销售金额</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold">
                    {customer._count.salesOrders}
                  </p>
                  <p className="text-xs text-muted-foreground">销售订单</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {customer._count.returnOrders}
                  </p>
                  <p className="text-xs text-muted-foreground">退货订单</p>
                </div>
              </div>
              {totalReturnAmount > 0 && (
                <div className="text-center">
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(totalReturnAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">累计退货金额</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 订单历史 */}
      <Card>
        <CardHeader>
          <CardTitle>订单历史</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sales" className="w-full">
            <TabsList>
              <TabsTrigger
                value="sales"
                className="flex items-center space-x-2"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>销售订单 ({customer._count.salesOrders})</span>
              </TabsTrigger>
              <TabsTrigger
                value="returns"
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>退货订单 ({customer._count.returnOrders})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="space-y-4">
              {customer.salesOrders.length > 0 ? (
                <div className="space-y-3">
                  {customer.salesOrders.map(order => (
                    <div
                      key={order.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                      onClick={() => router.push(`/sales-orders/${order.id}`)}
                    >
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  暂无销售订单
                </div>
              )}
            </TabsContent>

            <TabsContent value="returns" className="space-y-4">
              {customer.returnOrders.length > 0 ? (
                <div className="space-y-3">
                  {customer.returnOrders.map(order => (
                    <div
                      key={order.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                      onClick={() => router.push(`/return-orders/${order.id}`)}
                    >
                      <div>
                        <p className="font-medium">{order.returnNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-medium text-red-600">
                          -{formatCurrency(order.totalAmount)}
                        </p>
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  暂无退货订单
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
