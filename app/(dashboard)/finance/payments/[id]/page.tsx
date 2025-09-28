/**
 * 收款记录详情页面
 * 显示收款记录的详细信息，包含客户信息、订单信息和操作历史
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  DollarSign, 
  User, 
  Package, 
  Calendar,
  CreditCard,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Printer
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待确认', variant: 'secondary' as const, icon: Clock, color: 'text-orange-600' },
    confirmed: { label: '已确认', variant: 'secondary' as const, icon: CheckCircle, color: 'text-green-600' },
    cancelled: { label: '已取消', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <IconComponent className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 收款方式显示组件
 */
function PaymentMethodDisplay({ method }: { method: string }) {
  const methodConfig = {
    cash: { label: '现金', icon: DollarSign },
    bank_transfer: { label: '银行转账', icon: CreditCard },
    alipay: { label: '支付宝', icon: CreditCard },
    wechat: { label: '微信支付', icon: CreditCard },
    check: { label: '支票', icon: FileText },
    other: { label: '其他', icon: CreditCard },
  };

  const config = methodConfig[method as keyof typeof methodConfig] || methodConfig.other;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2">
      <IconComponent className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * 收款记录详情页面组件
 */
export default function PaymentDetailPage() {
  const params = useParams();
  const paymentId = params.id as string;

  // 获取收款记录详情
  const { data, isLoading, error } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const response = await fetch(`/api/payments/${paymentId}`);
      if (!response.ok) {
        throw new Error('获取收款记录失败');
      }
      return response.json();
    },
    enabled: !!paymentId,
  });

  const payment: PaymentRecord | null = data?.data || null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              {error ? (error as Error).message : '收款记录不存在'}
            </div>
            <Button asChild>
              <Link href="/finance/payments">返回列表</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/payments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">收款记录详情</h1>
            <p className="text-gray-600">{payment.paymentNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <StatusBadge status={payment.status} />
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            打印
          </Button>
          {payment.status === 'pending' && (
            <Button size="sm">
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 收款信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                收款信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">收款单号</label>
                  <p className="text-lg font-semibold">{payment.paymentNumber}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">收款金额</label>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(payment.paymentAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">收款方式</label>
                  <div className="mt-1">
                    <PaymentMethodDisplay method={payment.paymentMethod} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">收款日期</label>
                  <p className="text-sm font-medium">
                    {format(new Date(payment.paymentDate), 'yyyy年MM月dd日')}
                  </p>
                </div>

                {payment.receiptNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">收据号码</label>
                    <p className="text-sm font-medium">{payment.receiptNumber}</p>
                  </div>
                )}

                {payment.bankInfo && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">银行信息</label>
                    <p className="text-sm">{payment.bankInfo}</p>
                  </div>
                )}
              </div>

              {payment.remarks && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500">备注</label>
                    <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                      {payment.remarks}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 关联订单信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                关联订单
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">订单号</label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium">{payment.salesOrder.orderNumber}</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                        查看订单
                      </Link>
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">订单状态</label>
                  <p className="text-sm font-medium mt-1">{payment.salesOrder.status}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">订单金额</label>
                  <p className="text-lg font-bold">
                    {formatCurrency(payment.salesOrder.totalAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">已收金额</label>
                  <p className="text-sm text-green-600">
                    {formatCurrency(payment.salesOrder.paidAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">待收金额</label>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(payment.salesOrder.remainingAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">订单创建时间</label>
                  <p className="text-sm">
                    {format(new Date(payment.salesOrder.createdAt), 'yyyy-MM-dd HH:mm')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 客户信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">客户名称</label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium">{payment.customer.name}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/customers/${payment.customer.id}`}>
                      查看客户
                    </Link>
                  </Button>
                </div>
              </div>

              {payment.customer.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">联系电话</label>
                  <p className="text-sm">{payment.customer.phone}</p>
                </div>
              )}

              {payment.customer.email && (
                <div>
                  <label className="text-sm font-medium text-gray-500">邮箱地址</label>
                  <p className="text-sm">{payment.customer.email}</p>
                </div>
              )}

              {payment.customer.address && (
                <div>
                  <label className="text-sm font-medium text-gray-500">地址</label>
                  <p className="text-sm">{payment.customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作信息 */}
          <Card>
            <CardHeader>
              <CardTitle>操作信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">创建人</label>
                <p className="text-sm font-medium">{payment.user.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">创建时间</label>
                <p className="text-sm">
                  {format(new Date(payment.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">最后更新</label>
                <p className="text-sm">
                  {format(new Date(payment.updatedAt), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                  <Package className="mr-2 h-4 w-4" />
                  查看关联订单
                </Link>
              </Button>
              
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/customers/${payment.customer.id}`}>
                  <User className="mr-2 h-4 w-4" />
                  查看客户详情
                </Link>
              </Button>

              <Button variant="outline" className="w-full justify-start">
                <Printer className="mr-2 h-4 w-4" />
                打印收款单
              </Button>

              {payment.status === 'pending' && (
                <Button className="w-full justify-start">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  确认收款
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
