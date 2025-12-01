'use client';

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Edit,
  FileText,
  Printer,
  Receipt,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDateTime, formatPaymentDateTime } from '@/lib/utils/datetime';

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
    status: string;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentOutDetailClientProps {
  initialPayment: PaymentOutRecord;
}

/**
 * 状态显示组件
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
      icon: XCircle,
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
 * 付款方式显示组件
 */
function PaymentMethodDisplay({ method }: { method: string }) {
  const methodConfig = {
    cash: { label: '现金', icon: ChineseYuan },
    bank_transfer: { label: '银行转账', icon: CreditCard },
    alipay: { label: '支付宝', icon: CreditCard },
    wechat: { label: '微信', icon: CreditCard },
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
 * 付款记录详情客户端组件
 */
export function PaymentOutDetailClient({
  initialPayment,
}: PaymentOutDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [payment, setPayment] = useState(initialPayment);
  const [isConfirming, setIsConfirming] = useState(false);

  // 确认付款
  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch(
        `/api/finance/payments-out/${payment.id}`,
        getCsrfTokenHeader({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'confirmed',
          }),
        })
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '确认付款失败');
      }

      toast({
        title: '确认成功',
        description: '付款记录已确认',
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
        description: error instanceof Error ? error.message : '确认付款失败',
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
              <Link href="/finance/payments-out">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回列表
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">
              付款记录详情
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              打印
            </Button>
            {payment.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  router.push(`/finance/payments-out/${payment.id}/edit`)
                }
              >
                <Edit className="h-3.5 w-3.5" />
                编辑
              </Button>
            )}
            {payment.status === 'pending' && (
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={isConfirming}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {isConfirming ? '确认中...' : '确认付款'}
              </Button>
            )}
          </div>
        </div>

        {/* 顶部核心信息卡片 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-lg">
          <CardContent className="p-0">
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-6 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                    <ChineseYuan className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
                        {payment.paymentNumber}
                      </h2>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{payment.supplier.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      付款金额
                    </p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                      {formatCurrency(payment.paymentAmount)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-[hsl(var(--color-border-secondary))]"></div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      付款方式
                    </p>
                    <div className="flex justify-end font-medium text-[hsl(var(--color-text-primary))]">
                      <PaymentMethodDisplay method={payment.paymentMethod} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：基本信息和操作记录 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 基本信息 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      付款日期
                    </span>
                    <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {formatPaymentDateTime(
                        payment.paymentDate,
                        payment.createdAt
                      )}
                    </div>
                  </div>

                  {payment.voucherNumber && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        凭证号
                      </span>
                      <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        <CopyableText text={payment.voucherNumber} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建人
                    </span>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <User className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {payment.user.name}
                    </div>
                  </div>
                </div>

                {payment.remarks && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        备注
                      </span>
                      <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                        {payment.remarks}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 操作记录 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  操作记录
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        创建记录
                      </p>
                      <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {payment.user.name} 于{' '}
                        {formatDateTime(payment.createdAt)} 创建
                      </p>
                    </div>
                  </div>

                  {payment.status === 'confirmed' && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          确认付款
                        </p>
                        <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                          于 {formatDateTime(payment.updatedAt)} 确认
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：关联信息 */}
          <div className="space-y-6">
            {/* 关联应付账款 */}
            {payment.payableRecord && (
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                    关联应付账款
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Link
                        href={`/finance/payables/${payment.payableRecord.id}`}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {payment.payableRecord.payableNumber}
                      </Link>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                            应付金额
                          </p>
                          <p className="font-medium text-[hsl(var(--color-text-primary))]">
                            {formatCurrency(
                              payment.payableRecord.payableAmount
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                            剩余应付
                          </p>
                          <p className="font-medium text-[hsl(var(--color-warning))]">
                            {formatCurrency(
                              payment.payableRecord.remainingAmount
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link
                        href={`/finance/payables/${payment.payableRecord.id}`}
                      >
                        查看应付详情
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 供应商信息 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  供应商信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Link
                      href={`/suppliers/${payment.supplier.id}`}
                      className="font-semibold text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {payment.supplier.name}
                    </Link>
                    {payment.supplier.phone && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          电话
                        </span>
                        {payment.supplier.phone}
                      </div>
                    )}
                    {payment.supplier.address && (
                      <div className="mt-1 flex items-start gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <span className="shrink-0 text-xs text-[hsl(var(--color-text-tertiary))]">
                          地址
                        </span>
                        {payment.supplier.address}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/suppliers/${payment.supplier.id}`}>
                      查看供应商详情
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
