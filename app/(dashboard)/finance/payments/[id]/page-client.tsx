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
// eslint-disable-next-line max-lines-per-function
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
        variant: 'success',
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

        {/* 收款金额卡片 - 优化为卡片式设计 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-lg">
          <CardContent className="p-0">
            {/* 顶部标题区域 */}
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[hsl(var(--color-text-tertiary))]">收款单号</p>
                  <p className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
                    {payment.paymentNumber}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
            </div>

            {/* 金额信息 - 3列网格布局 */}
            <div className="grid gap-px bg-[hsl(var(--color-border-secondary))]/30 grid-cols-3 border-b border-[hsl(var(--color-border-secondary))]/30">
              {/* 1. 记账金额 */}
              <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  记账金额
                </span>
                <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-primary))]">
                  {formatCurrency(payment.paymentAmount)}
                </span>
              </div>

              {/* 2. 收款差额 */}
              <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  收款差额
                </span>
                {payment.roundingAmount !== 0 ? (
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-2xl font-bold tracking-tight ${
                        payment.roundingAmount < 0
                          ? 'text-[hsl(var(--color-error))]'
                          : 'text-[hsl(var(--color-success))]'
                      }`}
                    >
                      {payment.roundingAmount < 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(payment.roundingAmount))}
                    </span>
                    <span
                      className={`mt-1 text-xs ${
                        payment.roundingAmount < 0
                          ? 'text-[hsl(var(--color-error))]'
                          : 'text-[hsl(var(--color-success))]'
                      }`}
                    >
                      {payment.roundingAmount < 0 ? '多收' : '少收'}
                    </span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-tertiary))]">
                    -
                  </span>
                )}
              </div>

              {/* 3. 实际收款 */}
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(var(--color-success))]/5 to-white px-6 py-6 transition-all hover:from-[hsl(var(--color-success))]/10">
                <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  实际收款
                </span>
                <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-success))]">
                  {formatCurrency(payment.actualPaymentAmount)}
                </span>
              </div>
            </div>

            {/* 收款信息 - 2列网格 */}
            <div className="grid grid-cols-2 gap-4 bg-[hsl(var(--color-bg-tertiary))]/30 px-6 py-5">
              <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">收款方式</p>
                <PaymentMethodDisplay method={payment.paymentMethod} />
              </div>
              <div className="rounded-lg bg-white/80 p-3 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">收款日期</p>
                <p className="font-medium text-[hsl(var(--color-text-primary))]">
                  {formatPaymentDateTime(
                    payment.paymentDate,
                    payment.createdAt
                  )}
                </p>
              </div>
              {payment.receiptNumber && (
                <div className="col-span-2 rounded-lg bg-white/80 p-3 shadow-sm">
                  <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">收据号码</p>
                  <p className="font-mono text-sm text-[hsl(var(--color-text-secondary))]">
                    {payment.receiptNumber}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 关联信息 - 两列布局 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 关联订单信息 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-blue-600" />
                关联订单
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">订单号</p>
                    <p className="font-mono text-sm font-semibold text-blue-600">
                      {payment.salesOrder.orderNumber}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="border-blue-200 hover:bg-blue-50">
                    <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-gray-500">订单金额</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(payment.salesOrder.totalAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-gray-500">已收金额</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(payment.salesOrder.paidAmount)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border-t border-blue-100 bg-white/50 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">待收金额</p>
                    <p className="text-xs font-medium">
                      {payment.salesOrder.remainingAmount <= 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">✓ 已收款</span>
                      ) : payment.salesOrder.paidAmount > 0 ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">部分收款</span>
                      ) : (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">未收款</span>
                      )}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(payment.salesOrder.remainingAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 客户信息 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-purple-600" />
                客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">客户名称</p>
                    <p className="text-base font-semibold text-purple-600">
                      {payment.customer.name}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="border-purple-200 hover:bg-purple-50">
                    <Link href={`/customers/${payment.customer.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                {payment.customer.phone && (
                  <div className="mb-2 rounded-lg bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-gray-500">联系电话</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
                      {payment.customer.phone}
                    </p>
                  </div>
                )}
                {payment.customer.address && (
                  <div className="rounded-lg bg-white p-3 shadow-sm">
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
            <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-amber-600" />
                  备注信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">{payment.remarks}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {payment.bankInfo && (
            <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  银行信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="rounded-lg border border-green-100 bg-gradient-to-br from-green-50 to-white p-4 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">{payment.bankInfo}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作记录 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-indigo-600" />
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="mb-1 text-xs font-medium text-gray-500">创建人</p>
                      <p className="text-sm font-semibold text-indigo-600">
                        {payment.user.name}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="mb-1 text-xs text-gray-500">创建时间</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
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
                    <div className="rounded-lg bg-green-50 p-3 shadow-sm">
                      <p className="mb-1 text-xs text-gray-500">确认时间</p>
                      <p className="font-mono text-sm font-semibold text-green-600">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
