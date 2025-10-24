'use client';

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  Printer,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { formatPaymentDateTime } from '@/lib/utils/datetime';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
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

interface PaymentDetailClientProps {
  initialPayment: PaymentRecord;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: '待确认',
      icon: Clock,
      className: 'border-yellow-300 bg-yellow-100 text-yellow-700',
    },
    confirmed: {
      label: '已确认',
      icon: CheckCircle,
      className: 'border-green-300 bg-green-100 text-green-700',
    },
    cancelled: {
      label: '已取消',
      icon: Clock,
      className: 'border-gray-300 bg-gray-100 text-gray-700',
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <IconComponent className="mr-1 h-3 w-3" />
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

  const config =
    methodConfig[method as keyof typeof methodConfig] || methodConfig.other;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2">
      <IconComponent className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * 收款记录详情客户端组件
 */
export function PaymentDetailClient({
  initialPayment,
}: PaymentDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [payment, setPayment] = useState(initialPayment);
  const [isConfirming, setIsConfirming] = useState(false);

  // 确认收款
  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch(`/api/payments/${payment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'confirmed',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '确认收款失败');
      }

      toast({
        title: '确认成功',
        description: '收款记录已确认',
      });

      // 更新本地状态
      setPayment({
        ...payment,
        status: 'confirmed',
      });

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      toast({
        title: '确认失败',
        description: error instanceof Error ? error.message : '确认收款失败',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href="/finance/payments">
                <ArrowLeft className="h-4 w-4" />
                返回列表
              </Link>
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-xl font-semibold text-gray-900">
              收款记录详情
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              打印
            </Button>
            {payment.status === 'pending' && (
              <Button
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={isConfirming}
              >
                <CheckCircle className="h-4 w-4" />
                {isConfirming ? '确认中...' : '确认收款'}
              </Button>
            )}
          </div>
        </div>

        {/* 收款金额卡片 - 采用左右布局 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              {/* 左侧：主要信息 */}
              <div className="flex-1 space-y-4">
                {/* 标题行 */}
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[hsl(var(--color-text-tertiary))]">收款单号</p>
                    <p className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
                      {payment.paymentNumber}
                    </p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>

                {/* 金额信息 - 横向排列,顺序:记账金额 → 抹零 → 实际收款 */}
                <div className="flex items-center gap-6 border-t border-[hsl(var(--color-border-secondary))] pt-4">
                  <div>
                    <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">记账金额</p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                      {formatCurrency(payment.paymentAmount)}
                    </p>
                  </div>
                  {payment.roundingAmount !== 0 && (
                    <div>
                      <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">抹零</p>
                      <p
                        className={`text-2xl font-bold ${
                          payment.roundingAmount > 0
                            ? 'text-orange-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {formatCurrency(Math.abs(payment.roundingAmount))}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">实际收款</p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-success))]">
                      {formatCurrency(payment.actualPaymentAmount)}
                    </p>
                  </div>
                </div>

                {/* 收款信息 - 2列网格 */}
                <div className="grid grid-cols-2 gap-4 border-t border-[hsl(var(--color-border-secondary))] pt-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">收款方式</p>
                    <PaymentMethodDisplay method={payment.paymentMethod} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">收款日期</p>
                    <p className="font-medium text-[hsl(var(--color-text-primary))]">
                      {formatPaymentDateTime(
                        payment.paymentDate,
                        payment.createdAt
                      )}
                    </p>
                  </div>
                  {payment.receiptNumber && (
                    <div className="col-span-2">
                      <p className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">收据号码</p>
                      <p className="font-mono text-sm text-[hsl(var(--color-text-secondary))]">
                        {payment.receiptNumber}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：操作按钮 - 仅在详情页顶部显示 */}
            </div>
          </CardContent>
        </Card>

        {/* 关联信息 - 两列布局 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 关联订单信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-blue-600" />
                关联订单
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-xs text-gray-500">订单号</p>
                    <p className="font-semibold text-gray-900">
                      {payment.salesOrder.orderNumber}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-xs text-gray-500">订单金额</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(payment.salesOrder.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-gray-500">已收金额</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(payment.salesOrder.paidAmount)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="mb-1 text-xs text-gray-500">待收金额</p>
                    <p className="mb-1 text-xs font-medium">
                      {payment.salesOrder.remainingAmount <= 0 ? (
                        <span className="text-green-600">✓ 已收款</span>
                      ) : payment.salesOrder.paidAmount > 0 ? (
                        <span className="text-yellow-600">部分收款</span>
                      ) : (
                        <span className="text-orange-600">未收款</span>
                      )}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-orange-600">
                    {formatCurrency(payment.salesOrder.remainingAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 客户信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-purple-600" />
                客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-xs text-gray-500">客户名称</p>
                    <p className="font-semibold text-gray-900">
                      {payment.customer.name}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/customers/${payment.customer.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                {payment.customer.phone && (
                  <div className="mb-2">
                    <p className="mb-1 text-xs text-gray-500">联系电话</p>
                    <p className="text-sm text-gray-700">
                      {payment.customer.phone}
                    </p>
                  </div>
                )}
                {payment.customer.address && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">地址</p>
                    <p className="text-sm text-gray-700">
                      {payment.customer.address}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 备注和其他信息 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {payment.remarks && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-gray-600" />
                  备注信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-gray-700">{payment.remarks}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {payment.bankInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-5 w-5 text-gray-600" />
                  银行信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">{payment.bankInfo}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作记录 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-gray-600" />
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-gray-500">创建人</p>
                <p className="text-sm font-medium text-gray-900">
                  {payment.user.name}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-500">创建时间</p>
                <p className="text-sm text-gray-700">
                  {new Date(payment.createdAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {payment.status === 'confirmed' && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">确认时间</p>
                  <p className="text-sm font-medium text-green-600">
                    {new Date(payment.updatedAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
