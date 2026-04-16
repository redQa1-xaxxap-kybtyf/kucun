'use client';

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Receipt,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
  PAYMENT_OUT_METHOD_LABELS,
  type PayableRecordDetail,
} from '@/lib/types/payable';
import { formatDateTime } from '@/lib/utils/datetime';
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

  const _canEdit = payable.status === 'pending' || payable.status === 'partial';

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 顶部操作栏 */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/finance/payables">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回应付款
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">应付款详情</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            {payable.remainingAmount > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  router.push(
                    `/finance/payments-out/create?payableId=${payable.id}`
                  )
                }
                className="w-full gap-1.5 bg-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-dark))] sm:w-auto"
              >
                <ChineseYuan className="h-3.5 w-3.5" />
                登记付款
              </Button>
            )}
          </div>
        </div>

        {/* 顶部核心信息卡片 */}
        <Card className="overflow-hidden border border-[hsl(var(--color-border-secondary))] shadow-lg">
          <CardContent className="p-0">
            <div className="border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary))] shadow-md sm:h-12 sm:w-12">
                      <Receipt className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold break-all text-[hsl(var(--color-text-primary))] sm:text-2xl">
                          {payable.payableNumber}
                        </h2>
                        <Badge
                          variant={PAYABLE_STATUS_VARIANTS[payable.status]}
                          className="gap-1"
                        >
                          {payable.status === 'paid' && (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          {(payable.status === 'pending' ||
                            payable.status === 'partial') && (
                            <Clock className="h-3 w-3" />
                          )}
                          {PAYABLE_STATUS_LABELS[payable.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{payable.supplier.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                    <div className="rounded-xl border border-[hsl(var(--color-border-secondary))]/60 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        应付金额
                      </p>
                      <p className="mt-1 text-xl font-bold text-[hsl(var(--color-primary))] sm:text-2xl">
                        {formatCurrency(payable.payableAmount)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--color-border-secondary))]/60 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        剩余应付
                      </p>
                      <p className="mt-1 text-xl font-bold text-[hsl(var(--color-warning))] sm:text-2xl">
                        {formatCurrency(payable.remainingAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* 左侧：基本信息和付款明细 */}
          <div className="space-y-6 xl:col-span-2">
            {/* 基本信息 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      来源类型
                    </span>
                    <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      <Badge variant="outline" className="font-normal">
                        {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
                      </Badge>
                    </div>
                  </div>

                  {payable.sourceNumber && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                        来源单号
                      </span>
                      <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        <CopyableText text={payable.sourceNumber} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建人
                    </span>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <User className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {payable.user.name}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      创建时间
                    </span>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {formatDateTime(payable.createdAt)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      更新时间
                    </span>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-primary))]">
                      <Clock className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                      {formatDateTime(payable.updatedAt)}
                    </div>
                  </div>
                </div>

                {(payable.description || payable.remarks) && (
                  <>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {payable.description && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                            描述
                          </span>
                          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                            {payable.description}
                          </p>
                        </div>
                      )}
                      {payable.remarks && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                            备注
                          </span>
                          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                            {payable.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 付款明细 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-success))]" />
                  付款明细
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payable.paymentOutRecords &&
                payable.paymentOutRecords.length > 0 ? (
                  <>
                    <div className="hidden 2xl:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[hsl(var(--color-bg-tertiary))]/50 hover:bg-[hsl(var(--color-bg-tertiary))]/50">
                            <TableHead className="h-9">付款单号</TableHead>
                            <TableHead className="h-9">付款方式</TableHead>
                            <TableHead className="h-9">付款日期</TableHead>
                            <TableHead className="h-9 text-right">
                              金额
                            </TableHead>
                            <TableHead className="h-9 w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payable.paymentOutRecords.map(payment => (
                            <TableRow
                              key={payment.id}
                              className="hover:bg-muted/50"
                            >
                              <TableCell className="font-medium">
                                <Link
                                  href={`/finance/payments-out/${payment.id}`}
                                  className="text-primary font-mono hover:underline"
                                >
                                  {payment.paymentNumber}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="font-normal"
                                >
                                  {
                                    PAYMENT_OUT_METHOD_LABELS[
                                      payment.paymentMethod
                                    ]
                                  }
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <RelativeTime date={payment.paymentDate} />
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium text-[hsl(var(--color-success))]">
                                {formatCurrency(payment.paymentAmount)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <Link
                                    href={`/finance/payments-out/${payment.id}`}
                                  >
                                    <ArrowLeft className="h-4 w-4 rotate-180" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="space-y-3 p-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0 2xl:hidden">
                      {payable.paymentOutRecords.map(payment => (
                        <div
                          key={payment.id}
                          className="rounded-xl border border-[hsl(var(--color-border-secondary))] bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <Link
                                href={`/finance/payments-out/${payment.id}`}
                                className="text-primary block font-mono text-sm font-semibold break-all hover:underline"
                              >
                                {payment.paymentNumber}
                              </Link>
                              <div className="mt-1 flex items-center gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                                <Calendar className="h-3.5 w-3.5" />
                                <RelativeTime date={payment.paymentDate} />
                              </div>
                            </div>
                            <Badge variant="outline" className="w-fit">
                              {PAYMENT_OUT_METHOD_LABELS[payment.paymentMethod]}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-[hsl(var(--color-bg-secondary))]/50 px-3 py-2">
                            <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                              付款金额
                            </span>
                            <span className="font-semibold text-[hsl(var(--color-success))]">
                              {formatCurrency(payment.paymentAmount)}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            asChild
                          >
                            <Link href={`/finance/payments-out/${payment.id}`}>
                              查看付款详情
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8">
                    <EmptyState
                      icon={
                        <CreditCard className="h-8 w-8 text-[hsl(var(--color-border-secondary))]" />
                      }
                      title="暂无付款"
                      description="这笔应付款暂时还没有登记付款"
                      compact
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：金额汇总和供应商信息 */}
          <div className="space-y-6">
            {/* 金额汇总 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-warning))]" />
                  金额汇总
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      应付总额
                    </span>
                    <span className="font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatCurrency(payable.payableAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                      已付款金额
                    </span>
                    <span className="font-semibold text-[hsl(var(--color-success))]">
                      {formatCurrency(payable.paidAmount)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      剩余应付
                    </span>
                    <span className="text-lg font-bold text-[hsl(var(--color-warning))]">
                      {formatCurrency(payable.remainingAmount)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[hsl(var(--color-text-secondary))]">
                        结算进度
                      </span>
                      <span className="font-medium text-[hsl(var(--color-text-primary))]">
                        {paymentProgress.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={paymentProgress} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

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
                      href={`/suppliers/${payable.supplier.id}`}
                      className="font-semibold text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {payable.supplier.name}
                    </Link>
                    {payable.supplier.phone && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                          电话
                        </span>
                        {payable.supplier.phone}
                      </div>
                    )}
                    {payable.supplier.address && (
                      <div className="mt-1 flex items-start gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <span className="shrink-0 text-xs text-[hsl(var(--color-text-tertiary))]">
                          地址
                        </span>
                        {payable.supplier.address}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/suppliers/${payable.supplier.id}`}>
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
