'use client';

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Package,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDateTime, formatPaymentDateTime } from '@/lib/utils/datetime';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  appliedAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  paymentType: string;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  isSystemReceivableConfirmation?: boolean;
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  salesOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  } | null;
  user: {
    id: string;
    name: string;
  };
  prepaymentUsages?: Array<{
    id: string;
    salesOrderId?: string;
    orderNumber?: string;
    orderStatus?: string;
    orderCreatedAt?: string;
    appliedAmount: number;
    createdAt: string;
  }>;
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
      label: '待确认到账',
      icon: Clock,
      className:
        'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
    },
    confirmed: {
      label: '已到账',
      icon: CheckCircle,
      className:
        'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
    },
    applied: {
      label: '已抵扣',
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelNotes, setCancelNotes] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const isSystemReceivableConfirmation =
    payment.isSystemReceivableConfirmation === true;
  const hasPrepaymentUsages = (payment.prepaymentUsages?.length ?? 0) > 0;
  const isSettledPayment =
    payment.status === 'confirmed' || payment.status === 'applied';
  const canReverseOrderPayment =
    !isSystemReceivableConfirmation &&
    isSettledPayment &&
    payment.paymentType === 'order_payment' &&
    !!payment.salesOrder &&
    (payment.salesOrder.status === 'draft' ||
      payment.salesOrder.status === 'confirmed');
  const canReversePrepayment =
    !isSystemReceivableConfirmation &&
    isSettledPayment &&
    payment.paymentType === 'prepayment' &&
    !hasPrepaymentUsages &&
    payment.appliedAmount <= 0.0001;
  const canCancelPayment =
    !isSystemReceivableConfirmation && payment.status === 'pending';
  const canRunCancelAction =
    canCancelPayment || canReverseOrderPayment || canReversePrepayment;
  const isReversalAction = canReverseOrderPayment || canReversePrepayment;
  const cancelActionText = isReversalAction
    ? payment.paymentType === 'prepayment'
      ? '撤销预收款'
      : '撤销收款'
    : '取消收款';

  // 确认收款
  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch(
        `/api/payments/${payment.id}/confirm`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '确认收款失败');
      }

      toast({
        title: '收款已到账',
        description: '这笔收款已经确认到账。',
        variant: 'success',
      });

      // 更新本地状态
      setPayment({
        ...payment,
        status: 'confirmed',
      });
      setShowConfirmDialog(false);

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      toast({
        title: '确认失败',
        description: getFriendlyErrorMessage(
          error,
          '这笔收款暂时无法确认，请稍后重试'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling || !canRunCancelAction) {
      return;
    }

    setIsCancelling(true);
    try {
      const trimmedNotes = cancelNotes.trim();
      const response = await fetch(
        `/api/payments/${payment.id}/cancel`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trimmedNotes ? { notes: trimmedNotes } : {}),
        })
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '取消收款失败');
      }

      toast({
        title: isReversalAction ? '撤销成功' : '取消成功',
        description: isReversalAction ? '这笔收款已撤销' : '这笔收款已取消',
        variant: 'success',
      });

      setPayment({
        ...payment,
        status: 'cancelled',
      });
      setShowCancelDialog(false);
      router.refresh();
    } catch (error) {
      toast({
        title: '取消失败',
        description: getFriendlyErrorMessage(
          error,
          '这笔收款暂时无法取消，请稍后重试'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 顶部操作栏 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/finance/payments">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回收款管理
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">
              {isSystemReceivableConfirmation ? '应收记录' : '收款详情'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isSystemReceivableConfirmation &&
              payment.status === 'pending' && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isConfirming || isCancelling}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {isConfirming ? '确认中...' : '确认到账'}
                </Button>
              )}
            {canRunCancelAction && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setCancelNotes('');
                  setShowCancelDialog(true);
                }}
                disabled={isConfirming || isCancelling}
              >
                <XCircle className="h-3.5 w-3.5" />
                {cancelActionText}
              </Button>
            )}
          </div>
        </div>

        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认这笔收款已经到账？</AlertDialogTitle>
              <AlertDialogDescription>
                将把收款单 <strong>{payment.paymentNumber}</strong> 记为已到账。
                <br />
                确认后，这笔收款会记入已收金额，对应订单的已收也会一起更新。
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isConfirming}>
                我再核对一下
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isConfirming || isCancelling}
              >
                {isConfirming ? '确认中...' : '确认收款到账'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isSystemReceivableConfirmation && (
          <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  应收记录
                </div>
                <p className="text-sm text-amber-900">
                  系统生成，不计入客户实付。
                </p>
              </div>
              {payment.salesOrder?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                >
                  <Link href={`/finance/receivables/${payment.salesOrder.id}`}>
                    查看应收详情
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isReversalAction ? '确认撤销这笔收款？' : '确认取消这笔收款？'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isReversalAction ? '将撤销' : '将取消'}收款单{' '}
                <strong>{payment.paymentNumber}</strong>。
                <br />
                {isReversalAction
                  ? '撤销后不再计入已收。'
                  : '取消后保留单据记录，但不会继续进入到账统计。'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <div className="text-sm font-medium">备注（可选）</div>
              <Textarea
                value={cancelNotes}
                onChange={event => setCancelNotes(event.target.value)}
                placeholder={
                  isReversalAction
                    ? '例如：订单取消 / 收款录错 / 重新登记...'
                    : '例如：误录收款 / 客户取消支付 / 重新登记...'
                }
                disabled={isCancelling}
                rows={3}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>
                先不取消
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling
                  ? isReversalAction
                    ? '撤销中...'
                    : '取消中...'
                  : isReversalAction
                    ? '确认撤销收款'
                    : '确认取消收款'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 收款金额卡片 */}
        <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
          <CardContent className="p-0">
            {/* 顶部标题区域 */}
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600">
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
                <span className="mb-1.5 text-xs font-semibold text-[hsl(var(--color-text-tertiary))]">
                  {isSystemReceivableConfirmation ? '应收金额' : '记账金额'}
                </span>
                <span className="text-xl font-bold tracking-tight text-[hsl(var(--color-primary))]">
                  {formatCurrency(payment.paymentAmount)}
                </span>
              </div>

              {/* 2. 收款差额 */}
              <div className="flex flex-col items-center justify-center bg-white px-4 py-4 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                <span className="mb-1.5 text-xs font-semibold text-[hsl(var(--color-text-tertiary))]">
                  {isSystemReceivableConfirmation ? '金额差额' : '抹零金额'}
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
              <div
                className={`flex flex-col items-center justify-center px-4 py-4 transition-all ${
                  isSystemReceivableConfirmation
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'bg-[hsl(var(--color-success))]/5 hover:bg-[hsl(var(--color-success))]/10'
                }`}
              >
                <span className="mb-1.5 text-xs font-semibold text-[hsl(var(--color-text-tertiary))]">
                  {isSystemReceivableConfirmation ? '客户实付' : '实际收款'}
                </span>
                <span
                  className={`text-xl font-bold tracking-tight ${
                    isSystemReceivableConfirmation
                      ? 'text-amber-700'
                      : 'text-[hsl(var(--color-success))]'
                  }`}
                >
                  {formatCurrency(payment.actualPaymentAmount)}
                </span>
              </div>
            </div>

            {/* 收款信息 - 2列网格 */}
            <div className="grid grid-cols-2 gap-3 bg-[hsl(var(--color-bg-tertiary))]/30 px-4 py-3">
              <div className="rounded-md bg-white p-2.5 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  {isSystemReceivableConfirmation ? '记录类型' : '收款方式'}
                </p>
                {isSystemReceivableConfirmation ? (
                  <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    应收记录
                  </p>
                ) : (
                  <PaymentMethodDisplay method={payment.paymentMethod} />
                )}
              </div>
              <div className="rounded-md bg-white p-2.5 shadow-sm">
                <p className="mb-1 text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  {isSystemReceivableConfirmation ? '登记时间' : '收款日期'}
                </p>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {formatPaymentDateTime(
                    payment.paymentDate,
                    payment.createdAt
                  )}
                </p>
              </div>
              {payment.receiptNumber && (
                <div className="col-span-2 rounded-md bg-white p-2.5 shadow-sm">
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
          {/* 关联订单信息 / 预收款说明 */}
          {payment.salesOrder ? (
            <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Package className="h-4 w-4 text-blue-600" />
                  关联订单
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3">
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 shadow-sm">
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
                    <div className="rounded-md bg-white p-2.5 shadow-sm">
                      <p className="mb-0.5 text-xs text-gray-500">订单金额</p>
                      <p className="text-base font-bold text-blue-600">
                        {formatCurrency(payment.salesOrder.totalAmount)}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-2.5 shadow-sm">
                      <p className="mb-0.5 text-xs text-gray-500">
                        {isSystemReceivableConfirmation
                          ? '真实已收/冲抵'
                          : '已收金额'}
                      </p>
                      <p className="text-base font-bold text-green-600">
                        {formatCurrency(payment.salesOrder.paidAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 rounded-md border-t border-blue-100 bg-white/50 pt-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500">
                        待收金额
                      </p>
                      <p className="text-xs font-medium">
                        {payment.salesOrder.remainingAmount <= 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                            已收款
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
                    {isSystemReceivableConfirmation && (
                      <p className="mt-1 text-xs text-gray-500">
                        系统生成，不计实收。
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Package className="h-4 w-4 text-amber-600" />
                  预收款信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3">
                <div className="rounded-md border border-amber-100 bg-amber-50 p-3 shadow-sm">
                  <p className="text-sm text-gray-700">
                    客户预收款，可在后续订单中抵扣。
                  </p>
                  {payment.paymentType === 'prepayment' &&
                    isSettledPayment &&
                    hasPrepaymentUsages && (
                      <p className="mt-2 rounded-md bg-amber-100 px-2.5 py-2 text-xs font-medium text-amber-800">
                        这笔预收款已被订单抵扣，需要先到关联订单回滚抵扣后再撤销。
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 客户信息 */}
          <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-purple-600" />
                客户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3">
              <div className="rounded-md border border-purple-100 bg-purple-50 p-3 shadow-sm">
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
                  <div className="mb-2 rounded-md bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">联系电话</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
                      {payment.customer.phone}
                    </p>
                  </div>
                )}
                {payment.customer.address && (
                  <div className="rounded-md bg-white p-2.5 shadow-sm">
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

        {/* 预收款使用明细（仅预收款类型展示） */}
        {payment.paymentType === 'prepayment' &&
          (payment.prepaymentUsages?.length ?? 0) > 0 && (
            <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Package className="h-4 w-4 text-amber-600" />
                  预收款使用明细
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                <div className="rounded-md bg-amber-50/80 p-3 text-xs text-amber-800 sm:text-sm">
                  本笔预收款总额{' '}
                  <span className="font-semibold">
                    {formatCurrency(payment.paymentAmount)}
                  </span>
                  ，已入账{' '}
                  <span className="font-semibold">
                    {formatCurrency(payment.appliedAmount)}
                  </span>
                  ，剩余可用{' '}
                  <span className="font-semibold">
                    {formatCurrency(
                      payment.paymentAmount - payment.appliedAmount
                    )}
                  </span>
                  。
                </div>

                <div className="space-y-3">
                  {payment.prepaymentUsages?.map(usage => (
                    <div
                      key={usage.id}
                      className="border-border/60 bg-card/40 flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-800">
                          订单{' '}
                          {usage.orderNumber ? (
                            <Link
                              href={`/sales-orders/${usage.salesOrderId}`}
                              className="font-mono text-blue-600 hover:underline"
                            >
                              {usage.orderNumber}
                            </Link>
                          ) : (
                            <span className="font-mono text-gray-500">
                              未知订单
                            </span>
                          )}
                        </p>
                        {usage.orderStatus && (
                          <p className="text-xs text-gray-500">
                            订单状态：{usage.orderStatus}
                          </p>
                        )}
                        {usage.orderCreatedAt && (
                          <p className="text-xs text-gray-500">
                            订单创建时间：{formatDateTime(usage.orderCreatedAt)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          抵扣时间：{formatDateTime(usage.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">
                          抵扣金额
                        </p>
                        <p className="text-base font-semibold text-emerald-600">
                          -{formatCurrency(usage.appliedAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {/* 备注和其他信息 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {payment.remarks && (
            <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <FileText className="h-4 w-4 text-amber-600" />
                  备注
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">
                    {payment.remarks}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {payment.bankInfo && (
            <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  银行信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="rounded-md border border-green-100 bg-green-50 p-3 shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700">
                    {payment.bankInfo}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作记录 */}
          <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] shadow-sm">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] pb-2.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-indigo-600" />
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3">
              <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3 shadow-sm">
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
                  <div className="rounded-md bg-white p-2.5 shadow-sm">
                    <p className="mb-0.5 text-xs text-gray-500">创建时间</p>
                    <p className="font-mono text-sm font-medium text-gray-700">
                      {formatDateTime(payment.createdAt)}
                    </p>
                  </div>
                  {payment.status === 'confirmed' && (
                    <div className="rounded-md bg-green-50 p-2.5 shadow-sm">
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
