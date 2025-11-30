'use client';

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Package,
  Printer,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { formatDateTime, formatPaymentDateTime } from '@/lib/utils/datetime';

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
 * ✅ 使用CSS变量统一颜色
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: '待确认',
      icon: Clock,
      className:
        'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
    },
    confirmed: {
      label: '已确认',
      icon: CheckCircle,
      className:
        'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
    },
    cancelled: {
      label: '已取消',
      icon: Clock,
      className:
        'border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]',
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
  const methodConfig: Record<
    string,
    { label: string; icon: React.ElementType }
  > = {
    cash: { label: '现金', icon: ChineseYuan },
    wechat_transfer: { label: '微信转账', icon: CreditCard },
    abc_qr: { label: '农行码', icon: CreditCard },
    icbc_qr: { label: '工行码', icon: CreditCard },
    ccb_qr: { label: '建行码', icon: CreditCard },
    cib_qr: { label: '兴业码', icon: CreditCard },
    bank_transfer: { label: '银行转账', icon: CreditCard },
    alipay: { label: '支付宝', icon: CreditCard },
    wechat: { label: '微信支付', icon: CreditCard },
    check: { label: '支票', icon: FileText },
    other: { label: '其他', icon: CreditCard },
  };

  const config = methodConfig[method] || methodConfig.other;
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
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="space-y-4">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/finance/payments">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回列表
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">
              收款记录详情
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              打印
            </Button>
            {payment.status === 'pending' && (
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={isConfirming}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {isConfirming ? '确认中...' : '确认收款'}
              </Button>
            )}
          </div>
        </div>

        {/* 收款金额卡片 - 优化为卡片式设计 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-lg">
          <CardContent className="p-0">
            {/* 顶部标题区域 */}
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                  <ChineseYuan className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    收款单号
                  </p>
                  <p className="text-base font-bold text-[hsl(var(--color-text-primary))]">
                    {payment.paymentNumber}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
            </div>

            {/* 金额信息 - 3列网格布局 */}
            <div className="grid grid-cols-3 gap-px border-b border-[hsl(var(--color-border-secondary))]/30 bg-[hsl(var(--color-border-secondary))]/30">
              {/* 1. 记账金额 */}
              <div className="flex flex-col items-center justify-center bg-white px-4 py-4 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                <span className="mb-1.5 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  记账金额
                </span>
                <span className="text-xl font-bold tracking-tight text-[hsl(var(--color-primary))]">
                  {formatCurrency(payment.paymentAmount)}
                </span>
              </div>

              {/* 2. 收款差额 */}
              <div className="flex flex-col items-center justify-center bg-white px-4 py-4 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                <span className="mb-1.5 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  收款差额
                </span>
                {payment.roundingAmount !== 0 ? (
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-xl font-bold tracking-tight ${
                        payment.roundingAmount < 0
                          ? 'text-[hsl(var(--color-error))]'
                          : 'text-[hsl(var(--color-success))]'
                      }`}
                    >
                      {payment.roundingAmount < 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(payment.roundingAmount))}
                    </span>
                    <span
                      className={`mt-0.5 text-xs ${
                        payment.roundingAmount < 0
                          ? 'text-[hsl(var(--color-error))]'
                          : 'text-[hsl(var(--color-success))]'
                      }`}
                    >
                      {payment.roundingAmount < 0 ? '多收' : '少收'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xl font-bold tracking-tight text-[hsl(var(--color-text-tertiary))]">
                    -
                  </span>
                )}
              </div>

              {/* 3. 实际收款 */}
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(var(--color-success))]/5 to-white px-4 py-4 transition-all hover:from-[hsl(var(--color-success))]/10">
                <span className="mb-1.5 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                  实际收款
                </span>
                <span className="text-xl font-bold tracking-tight text-[hsl(var(--color-success))]">
                  {formatCurrency(payment.actualPaymentAmount)}
                </span>
              </div>
            </div>

            {/* 收款信息 - 2列网格 */}
            <div className="grid grid-cols-2 gap-3 bg-[hsl(var(--color-bg-tertiary))]/30 px-4 py-3">
              <div className="rounded-lg bg-white/80 p-2.5 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  收款方式
                </p>
                <PaymentMethodDisplay method={payment.paymentMethod} />
              </div>
              <div className="rounded-lg bg-white/80 p-2.5 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  收款日期
                </p>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {formatPaymentDateTime(
                    payment.paymentDate,
                    payment.createdAt
                  )}
                </p>
              </div>
              {payment.receiptNumber && (
                <div className="col-span-2 rounded-lg bg-white/80 p-2.5 shadow-sm">
                  <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    收据号码
                  </p>
                  <p className="font-mono text-sm text-[hsl(var(--color-text-secondary))]">
                    {payment.receiptNumber}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 关联信息 - 两列布局 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 关联订单信息 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Package className="h-4 w-4 text-blue-600" />
                关联订单
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3">
              <div className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 shadow-sm">
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <p className="mb-0.5 text-xs font-medium text-gray-500">
                      订单号
                    </p>
                    <p className="font-mono text-sm font-semibold text-blue-600">
                      {payment.salesOrder.orderNumber}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 border-blue-200 text-xs hover:bg-blue-50"
                  >
                    <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">订单金额</p>
                    <p className="text-base font-bold text-blue-600">
                      {formatCurrency(payment.salesOrder.totalAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">已收金额</p>
                    <p className="text-base font-bold text-green-600">
                      {formatCurrency(payment.salesOrder.paidAmount)}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 rounded-lg border-t border-blue-100 bg-white/50 pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">
                      待收金额
                    </p>
                    <p className="text-xs font-medium">
                      {payment.salesOrder.remainingAmount <= 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                          ✓ 已收款
                        </span>
                      ) : payment.salesOrder.paidAmount > 0 ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
                          部分收款
                        </span>
                      ) : (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">
                          未收款
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(payment.salesOrder.remainingAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 客户信息 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-purple-600" />
                客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3">
              <div className="rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-3 shadow-sm">
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <p className="mb-0.5 text-xs font-medium text-gray-500">
                      客户名称
                    </p>
                    <p className="text-sm font-semibold text-purple-600">
                      {payment.customer.name}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 border-purple-200 text-xs hover:bg-purple-50"
                  >
                    <Link href={`/customers/${payment.customer.id}`}>
                      查看详情
                    </Link>
                  </Button>
                </div>
                {payment.customer.phone && (
                  <div className="mb-2 rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">联系电话</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
                      {payment.customer.phone}
                    </p>
                  </div>
                )}
                {payment.customer.address && (
                  <div className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">地址</p>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {payment.remarks && (
            <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <FileText className="h-4 w-4 text-amber-600" />
                  备注信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">
                    {payment.remarks}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {payment.bankInfo && (
            <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  银行信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="rounded-lg border border-green-100 bg-gradient-to-br from-green-50 to-white p-3 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">
                    {payment.bankInfo}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作记录 */}
          <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-md">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-indigo-600" />
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3">
              <div className="rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3 shadow-sm">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100">
                      <User className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="mb-0.5 text-xs font-medium text-gray-500">
                        创建人
                      </p>
                      <p className="text-sm font-semibold text-indigo-600">
                        {payment.user.name}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">创建时间</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
                      {formatDateTime(payment.createdAt)}
                    </p>
                  </div>
                  {payment.status === 'confirmed' && (
                    <div className="rounded-lg bg-green-50 p-2.5 shadow-sm">
                      <p className="mb-0.5 text-xs text-gray-500">确认时间</p>
                      <p className="font-mono text-sm font-semibold text-green-600">
                        {formatDateTime(payment.updatedAt)}
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
