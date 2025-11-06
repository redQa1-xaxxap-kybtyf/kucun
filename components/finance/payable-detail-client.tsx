'use client';

import { ArrowLeft, Building2, Edit, FileText, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
  PAYMENT_OUT_METHOD_LABELS,
  type PayableRecordDetail,
} from '@/lib/types/payable';
import { formatPaymentDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface PayableDetailClientProps {
  payable: PayableRecordDetail;
}

/**
 * 应付款详情客户端组件
 * 展示应付款的详细信息和操作按钮
 */
export function PayableDetailClient({ payable }: PayableDetailClientProps) {
  const router = useRouter();

  const paymentProgress =
    payable.payableAmount > 0
      ? (payable.paidAmount / payable.payableAmount) * 100
      : 0;

  const canEdit = payable.status === 'pending' || payable.status === 'partial';

  return (
    <div className="space-y-6">
      {/* 返回按钮和操作按钮 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                router.push(`/finance/payables/${payable.id}/edit`)
              }
              className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
          {payable.remainingAmount > 0 && (
            <Button
              size="lg"
              onClick={() =>
                router.push(
                  `/finance/payments-out/create?payableId=${payable.id}`
                )
              }
              className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
            >
              <ChineseYuan className="mr-2 h-4 w-4" />
              记录付款
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：基本信息和付款记录 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 基本信息 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <FileText className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    付款状态
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={PAYABLE_STATUS_VARIANTS[payable.status]}>
                      {PAYABLE_STATUS_LABELS[payable.status]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    来源类型
                  </div>
                  <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                    {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    供应商
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[hsl(var(--color-text-disabled))]" />
                    <span className="font-medium text-[hsl(var(--color-primary))]">
                      {payable.supplier.name}
                    </span>
                  </div>
                </div>

                {payable.sourceNumber && (
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      来源单号
                    </div>
                    <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                      {payable.sourceNumber}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    创建人
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <User className="h-4 w-4 text-[hsl(var(--color-text-disabled))]" />
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      {payable.user.name}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    创建时间
                  </div>
                  <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    {new Date(payable.createdAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    更新时间
                  </div>
                  <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    {new Date(payable.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {payable.description && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      描述
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {payable.description}
                    </div>
                  </div>
                </>
              )}

              {payable.remarks && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      备注
                    </div>
                    <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      {payable.remarks}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 付款记录 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <ChineseYuan className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                付款记录
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {payable.paymentOutRecords &&
              payable.paymentOutRecords.length > 0 ? (
                <div className="space-y-4">
                  {payable.paymentOutRecords.map((payment, index) => (
                    <div key={payment.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-[hsl(var(--color-text-primary))]">
                            {payment.paymentNumber}
                          </h4>
                          <div className="mt-2 space-y-1 text-sm text-[hsl(var(--color-text-secondary))]">
                            <p>
                              付款方式：
                              {PAYMENT_OUT_METHOD_LABELS[payment.paymentMethod]}
                            </p>
                            <p>
                              <span className="font-medium">付款日期：</span>
                              {formatPaymentDateTime(
                                payment.paymentDate,
                                payment.createdAt
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[hsl(var(--color-success))]">
                            {formatCurrency(payment.paymentAmount)}
                          </p>
                        </div>
                      </div>
                      {index < payable.paymentOutRecords.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={
                    <ChineseYuan className="h-8 w-8 text-[hsl(var(--color-border-secondary))]" />
                  }
                  title="暂无付款记录"
                  compact
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：金额汇总和供应商信息 */}
        <div className="space-y-6">
          {/* 金额汇总 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="text-[hsl(var(--color-text-primary))]">
                金额汇总
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                    应付金额
                  </span>
                  <span className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                    {formatCurrency(payable.payableAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                    已付金额
                  </span>
                  <span className="text-lg font-semibold text-[hsl(var(--color-success))]">
                    {formatCurrency(payable.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                    剩余金额
                  </span>
                  <span className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                    {formatCurrency(payable.remainingAmount)}
                  </span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--color-text-secondary))]">
                      付款进度
                    </span>
                    <span className="font-medium text-[hsl(var(--color-text-primary))]">
                      {paymentProgress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--color-border-secondary))]">
                    <div
                      className="h-2 rounded-full bg-[hsl(var(--color-success))] transition-all duration-300"
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 供应商信息 */}
          <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
              <CardTitle className="text-[hsl(var(--color-text-primary))]">
                供应商信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-[hsl(var(--color-text-primary))]">
                    {payable.supplier.name}
                  </p>
                  {payable.supplier.phone && (
                    <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                      电话：{payable.supplier.phone}
                    </p>
                  )}
                  {payable.supplier.address && (
                    <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
                      地址：{payable.supplier.address}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    router.push(`/suppliers/${payable.supplier.id}`)
                  }
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  查看供应商详情
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
