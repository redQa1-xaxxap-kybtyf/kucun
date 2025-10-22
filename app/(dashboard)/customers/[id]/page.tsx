'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Edit,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShoppingCart,
  Star,
  User,
  Wallet,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils';
import {
  getCommonStatusBadgeVariant,
  getReturnOrderStatusBadgeVariant,
  getSalesOrderStatusBadgeVariant,
} from '@/lib/utils/badge-helpers';
import { logger } from '@/lib/utils/console-logger';
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
    logger.error('Failed to parse extendedInfo:', error);
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 - 精简版 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
                  {customer.name}
                </h1>
                <Badge variant={getCommonStatusBadgeVariant(customer.status)}>
                  {getStatusLabel(customer.status)}
                </Badge>
              </div>
              {customer.phone && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {customer.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/customers/${id}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
            <Button>
              <ShoppingCart className="mr-2 h-4 w-4" />
              创建订单
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 联系信息 - 优化版 */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-5">
                  {/* 基本联系方式 */}
                  <div className="space-y-3">
                    {extendedInfo.contactPerson && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            联系人
                          </p>
                          <p className="text-sm font-medium">
                            {extendedInfo.contactPerson}
                          </p>
                        </div>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                          <Phone className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            联系电话
                          </p>
                          <p className="font-mono text-sm font-medium">
                            {customer.phone}
                          </p>
                        </div>
                      </div>
                    )}
                    {extendedInfo.email && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                          <Mail className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            邮箱地址
                          </p>
                          <p className="font-mono text-sm">
                            {extendedInfo.email}
                          </p>
                        </div>
                      </div>
                    )}
                    {extendedInfo.fax && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <Phone className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            传真号码
                          </p>
                          <p className="font-mono text-sm">
                            {extendedInfo.fax}
                          </p>
                        </div>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                          <MapPin className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">地址</p>
                          <p className="text-sm">{customer.address}</p>
                        </div>
                      </div>
                    )}
                    {extendedInfo.website && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100">
                          <Globe className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">网站</p>
                          <p className="text-sm">{extendedInfo.website}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 客户类型和等级 */}
                  {(extendedInfo.customerType ||
                    extendedInfo.level ||
                    extendedInfo.industry ||
                    extendedInfo.region) && (
                    <>
                      <Separator />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {extendedInfo.customerType && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100">
                              <Building2 className="h-4 w-4 text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                客户类型
                              </p>
                              <p className="text-sm font-medium">
                                {extendedInfo.customerType === 'company'
                                  ? '公司'
                                  : extendedInfo.customerType === 'store'
                                    ? '门店'
                                    : extendedInfo.customerType === 'individual'
                                      ? '个人'
                                      : extendedInfo.customerType}
                              </p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.level && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                              <Star className="h-4 w-4 text-orange-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                客户等级
                              </p>
                              <p className="text-sm font-medium">
                                {extendedInfo.level}级
                              </p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.industry && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100">
                              <Briefcase className="h-4 w-4 text-teal-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                所属行业
                              </p>
                              <p className="text-sm">{extendedInfo.industry}</p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.region && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
                              <MapPin className="h-4 w-4 text-pink-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                所属区域
                              </p>
                              <p className="text-sm">{extendedInfo.region}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* 财务信息 */}
                  {(extendedInfo.creditLimit ||
                    extendedInfo.paymentTerms ||
                    extendedInfo.taxNumber ||
                    extendedInfo.bankAccount) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {extendedInfo.creditLimit && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                              <Wallet className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                信用额度
                              </p>
                              <p className="text-sm font-semibold text-emerald-600">
                                {formatCurrency(extendedInfo.creditLimit)}
                              </p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.paymentTerms && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                              <FileText className="h-4 w-4 text-violet-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                付款条款
                              </p>
                              <p className="text-sm">
                                {extendedInfo.paymentTerms}
                              </p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.taxNumber && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                              <FileText className="h-4 w-4 text-slate-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                税号
                              </p>
                              <p className="font-mono text-sm">
                                {extendedInfo.taxNumber}
                              </p>
                            </div>
                          </div>
                        )}
                        {extendedInfo.bankAccount && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                              <CreditCard className="h-4 w-4 text-sky-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-muted-foreground text-xs">
                                银行账号
                              </p>
                              <p className="font-mono text-sm">
                                {extendedInfo.bankAccount}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* 备注 */}
                  {extendedInfo.notes && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                          <FileText className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            备注信息
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {extendedInfo.notes}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 创建时间 */}
                  <Separator />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-muted-foreground text-xs">
                          创建时间
                        </p>
                        <p className="text-sm">
                          {formatDateTime(customer.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-muted-foreground text-xs">
                          最后更新
                        </p>
                        <p className="text-sm">
                          {formatDateTime(customer.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 统计信息 - 优化版 */}
          <div className="space-y-4">
            {/* 累计销售 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <ShoppingCart className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">累计销售</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(totalSalesAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {customer._count.salesOrders}
                    </p>
                    <p className="text-muted-foreground text-xs">订单数</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 退货统计 */}
            {totalReturnAmount > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                        <RotateCcw className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          累计退货
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(totalReturnAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {customer._count.returnOrders}
                      </p>
                      <p className="text-muted-foreground text-xs">退货单数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 未付款提醒 */}
            {totalUnpaidAmount > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <div className="flex-1">
                      <p className="text-xs text-orange-600">未付款金额</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(totalUnpaidAmount)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {unpaidOrders.length} 个订单待收款
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 订单历史 - 优化版 */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="unpaid" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="unpaid" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>未付款 ({unpaidOrders.length})</span>
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>销售 ({customer._count.salesOrders})</span>
                </TabsTrigger>
                <TabsTrigger value="returns" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  <span>退货 ({customer._count.returnOrders})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unpaid" className="mt-4 space-y-3">
                {unpaidOrders.length > 0 ? (
                  <div className="space-y-2">
                    {unpaidOrders.map(order => {
                      const unpaidAmount = order.totalAmount - order.paidAmount;
                      return (
                        <div
                          key={order.id}
                          className="group cursor-pointer rounded-lg border border-orange-200 bg-orange-50/50 p-4 transition-all hover:border-orange-300 hover:bg-orange-50 hover:shadow-sm"
                          onClick={() =>
                            router.push(`/sales-orders/${order.id}`)
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm font-semibold">
                                  {order.orderNumber}
                                </p>
                                <Badge
                                  variant={getSalesOrderStatusBadgeVariant(
                                    order.status
                                  )}
                                  className="text-xs"
                                >
                                  {getOrderStatusLabel(order.status)}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="space-y-0.5 text-xs">
                                <p className="text-muted-foreground">
                                  总额: {formatCurrency(order.totalAmount)}
                                </p>
                                <p className="text-green-600">
                                  已付: {formatCurrency(order.paidAmount)}
                                </p>
                                <p className="font-semibold text-orange-600">
                                  欠款: {formatCurrency(unpaidAmount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    暂无未付款订单
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="mt-4 space-y-3">
                {customer.salesOrders.length > 0 ? (
                  <div className="space-y-2">
                    {customer.salesOrders.map(order => (
                      <div
                        key={order.id}
                        className="group hover:border-primary cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm"
                        onClick={() => router.push(`/sales-orders/${order.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-semibold">
                                {order.orderNumber}
                              </p>
                              <Badge
                                variant={getSalesOrderStatusBadgeVariant(
                                  order.status
                                )}
                                className="text-xs"
                              >
                                {getOrderStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(order.totalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    暂无销售订单
                  </div>
                )}
              </TabsContent>

              <TabsContent value="returns" className="mt-4 space-y-3">
                {customer.returnOrders.length > 0 ? (
                  <div className="space-y-2">
                    {customer.returnOrders.map(order => (
                      <div
                        key={order.id}
                        className="group cursor-pointer rounded-lg border border-red-200 bg-red-50/50 p-4 transition-all hover:border-red-300 hover:bg-red-50 hover:shadow-sm"
                        onClick={() =>
                          router.push(`/return-orders/${order.id}`)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-semibold">
                                {order.returnNumber}
                              </p>
                              <Badge
                                variant={getReturnOrderStatusBadgeVariant(
                                  order.status
                                )}
                                className="text-xs"
                              >
                                {getOrderStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-600">
                              -{formatCurrency(order.totalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-12 text-center text-sm">
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
