'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Edit,
  Mail,
  MapPin,
  RotateCcw,
  ShoppingCart,
  User,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils';
import {
  getCommonStatusBadgeVariant,
  getReturnOrderStatusBadgeVariant,
  getSalesOrderStatusBadgeVariant,
} from '@/lib/utils/badge-helpers';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface CustomerExtendedInfo {
  contactPerson?: string;
  email?: string;
  fax?: string;
  website?: string;
  businessLicense?: string;
  taxNumber?: string;
  bankAccount?: string;
  creditLimit?: number;
  paymentTerms?: string;
  customerType?: 'company' | 'store' | 'individual';
  industry?: string;
  region?: string;
  level?: 'A' | 'B' | 'C' | 'D';
  notes?: string;
  tags?: string[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  extendedInfo?: string;
  status: string;
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
    paidAmount: number;
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
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => fetchCustomerDetail(id),
    enabled: !!id,
  });

  // 格式化日期时间（显示到分钟）
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/\//g, '-');
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

  if (!customer) {
    return (
      <ErrorMessage
        title="客户不存在"
        message="未找到指定的客户"
        onRetry={() => router.push('/customers')}
      />
    );
  }

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

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '已确认';
      case 'shipped':
        return '已发货';
      case 'delivered':
        return '已交付';
      case 'completed':
        return '已完成';
      case 'cancelled':
        return '已取消';
      default:
        return status;
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

  // 筛选未付款订单（未完全付款的订单）
  const unpaidOrders = customer.salesOrders.filter(
    order =>
      order.paidAmount < order.totalAmount && order.status !== 'cancelled'
  );

  const totalUnpaidAmount = unpaidOrders.reduce(
    (sum, order) => sum + (order.totalAmount - order.paidAmount),
    0
  );

  // 解析扩展信息
  let extendedInfo: CustomerExtendedInfo = {};
  try {
    if (customer.extendedInfo) {
      extendedInfo = JSON.parse(customer.extendedInfo);
    }
  } catch (error) {
    console.error('Failed to parse extendedInfo:', error);
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card
          className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    {customer.name}
                  </h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    <Badge
                      variant={getCommonStatusBadgeVariant(customer.status)}
                    >
                      {getStatusLabel(customer.status)}
                    </Badge>
                    {customer.phone && (
                      <span className="font-medium">
                        电话：{customer.phone}
                      </span>
                    )}
                  </div>
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
                  onClick={() => router.push(`/customers/${id}/edit`)}
                  className="h-11"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
                <Button size="lg" className="h-11">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  创建订单
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 联系信息 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>联系信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">
                      联系人
                    </label>
                    <p className="mt-1">{extendedInfo.contactPerson || '-'}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">
                      邮箱地址
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      {extendedInfo.email ? (
                        <>
                          <Mail className="text-muted-foreground h-4 w-4" />
                          <span>{extendedInfo.email}</span>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-muted-foreground text-sm font-medium">
                      地址
                    </label>
                    <div className="mt-1 flex items-start space-x-2">
                      {customer.address ? (
                        <>
                          <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                          <span>{customer.address}</span>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </div>
                  {extendedInfo.fax && (
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        传真
                      </label>
                      <p className="mt-1">{extendedInfo.fax}</p>
                    </div>
                  )}
                  {extendedInfo.website && (
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        网站
                      </label>
                      <p className="mt-1">{extendedInfo.website}</p>
                    </div>
                  )}
                </div>

                {/* 客户类型和等级 */}
                {(extendedInfo.customerType ||
                  extendedInfo.level ||
                  extendedInfo.industry ||
                  extendedInfo.region) && (
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {extendedInfo.customerType && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            客户类型
                          </label>
                          <p className="mt-1">
                            {extendedInfo.customerType === 'company'
                              ? '公司'
                              : extendedInfo.customerType === 'store'
                                ? '门店'
                                : extendedInfo.customerType === 'individual'
                                  ? '个人'
                                  : extendedInfo.customerType}
                          </p>
                        </div>
                      )}
                      {extendedInfo.level && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            客户等级
                          </label>
                          <p className="mt-1">{extendedInfo.level}级</p>
                        </div>
                      )}
                      {extendedInfo.industry && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            所属行业
                          </label>
                          <p className="mt-1">{extendedInfo.industry}</p>
                        </div>
                      )}
                      {extendedInfo.region && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            所属区域
                          </label>
                          <p className="mt-1">{extendedInfo.region}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 财务信息 */}
                {(extendedInfo.creditLimit ||
                  extendedInfo.paymentTerms ||
                  extendedInfo.taxNumber ||
                  extendedInfo.bankAccount) && (
                  <div className="border-t pt-4">
                    <h4 className="mb-3 text-sm font-semibold">财务信息</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {extendedInfo.creditLimit && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            信用额度
                          </label>
                          <p className="mt-1">
                            {formatCurrency(extendedInfo.creditLimit)}
                          </p>
                        </div>
                      )}
                      {extendedInfo.paymentTerms && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            付款条款
                          </label>
                          <p className="mt-1">{extendedInfo.paymentTerms}</p>
                        </div>
                      )}
                      {extendedInfo.taxNumber && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            税号
                          </label>
                          <p className="mt-1 font-mono text-sm">
                            {extendedInfo.taxNumber}
                          </p>
                        </div>
                      )}
                      {extendedInfo.bankAccount && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            银行账号
                          </label>
                          <p className="mt-1 font-mono text-sm">
                            {extendedInfo.bankAccount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {extendedInfo.notes && (
                  <div className="border-t pt-4">
                    <label className="text-muted-foreground text-sm font-medium">
                      备注信息
                    </label>
                    <p className="mt-1 text-sm">{extendedInfo.notes}</p>
                  </div>
                )}

                {/* 创建时间 */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        创建时间
                      </label>
                      <div className="mt-1 flex items-center space-x-2">
                        <Calendar className="text-muted-foreground h-4 w-4" />
                        <span>{formatDateTime(customer.createdAt)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        最后更新
                      </label>
                      <div className="mt-1 flex items-center space-x-2">
                        <Calendar className="text-muted-foreground h-4 w-4" />
                        <span>{formatDateTime(customer.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
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
                  <p className="text-2xl font-bold text-[hsl(var(--color-success))]">
                    {formatCurrency(totalSalesAmount)}
                  </p>
                  <p className="text-muted-foreground text-sm">累计销售金额</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-semibold">
                      {customer._count.salesOrders}
                    </p>
                    <p className="text-muted-foreground text-xs">销售订单</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {customer._count.returnOrders}
                    </p>
                    <p className="text-muted-foreground text-xs">退货订单</p>
                  </div>
                </div>
                {totalReturnAmount > 0 && (
                  <div className="text-center">
                    <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
                      {formatCurrency(totalReturnAmount)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      累计退货金额
                    </p>
                  </div>
                )}
                {totalUnpaidAmount > 0 && (
                  <div className="border-t pt-4 text-center">
                    <p className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                      {formatCurrency(totalUnpaidAmount)}
                    </p>
                    <p className="text-muted-foreground text-xs">未付款金额</p>
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
            <Tabs defaultValue="unpaid" className="w-full">
              <TabsList>
                <TabsTrigger
                  value="unpaid"
                  className="flex items-center space-x-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>未付款订单 ({unpaidOrders.length})</span>
                </TabsTrigger>
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

              <TabsContent value="unpaid" className="space-y-4">
                {unpaidOrders.length > 0 ? (
                  <div className="space-y-3">
                    {unpaidOrders.map(order => {
                      const unpaidAmount = order.totalAmount - order.paidAmount;
                      return (
                        <div
                          key={order.id}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-bg-card))] p-4 transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                          onClick={() =>
                            router.push(`/sales-orders/${order.id}`)
                          }
                        >
                          <div>
                            <p className="font-medium">{order.orderNumber}</p>
                            <p className="text-muted-foreground text-sm">
                              {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                          <div className="space-y-1 text-right">
                            <div>
                              <p className="text-muted-foreground text-sm">
                                订单金额: {formatCurrency(order.totalAmount)}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                已付: {formatCurrency(order.paidAmount)}
                              </p>
                              <p className="font-medium text-[hsl(var(--color-warning))]">
                                未付: {formatCurrency(unpaidAmount)}
                              </p>
                            </div>
                            <Badge
                              variant={getSalesOrderStatusBadgeVariant(
                                order.status
                              )}
                            >
                              {getOrderStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    暂无未付款订单
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-4">
                {customer.salesOrders.length > 0 ? (
                  <div className="space-y-3">
                    {customer.salesOrders.map(order => (
                      <div
                        key={order.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                        onClick={() => router.push(`/sales-orders/${order.id}`)}
                      >
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-muted-foreground text-sm">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="font-medium">
                            {formatCurrency(order.totalAmount)}
                          </p>
                          <Badge
                            variant={getSalesOrderStatusBadgeVariant(
                              order.status
                            )}
                          >
                            {getOrderStatusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
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
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                        onClick={() =>
                          router.push(`/return-orders/${order.id}`)
                        }
                      >
                        <div>
                          <p className="font-medium">{order.returnNumber}</p>
                          <p className="text-muted-foreground text-sm">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="font-medium text-[hsl(var(--color-error))]">
                            -{formatCurrency(order.totalAmount)}
                          </p>
                          <Badge
                            variant={getReturnOrderStatusBadgeVariant(
                              order.status
                            )}
                          >
                            {getOrderStatusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    暂无退货订单
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
