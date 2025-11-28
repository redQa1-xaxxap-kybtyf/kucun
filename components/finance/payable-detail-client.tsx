'use client';

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Printer,
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
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="space-y-4">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/finance/payables">
                <ArrowLeft className="h-3.5 w-3.5" />
                返回列表
              </Link>
            </Button>
            <div className="h-5 w-px bg-gray-300"></div>
            <h1 className="text-lg font-semibold text-gray-900">应付款详情</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              打印
            </Button>
            {payable.remainingAmount > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  router.push(
                    `/finance/payments-out/create?payableId=${payable.id}`
                  )
                }
                className="gap-1.5 bg-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-dark))]"
              >
                <ChineseYuan className="h-3.5 w-3.5" />
                记录付款
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary))] shadow-md">
                    <Receipt className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
                        {payable.payableNumber}
                      </h2>
                      <Badge
                        variant={PAYABLE_STATUS_VARIANTS[payable.status]}
                        className="gap-1"
                      >
                        {payable.status === 'paid' && (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        {payable.status === 'pending' && (
                          <Clock className="h-3 w-3" />
                        )}
                        {payable.status === 'partial' && (
                          <Clock className="h-3 w-3" />
                        )}
                        {PAYABLE_STATUS_LABELS[payable.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{payable.supplier.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      应付金额
                    </p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                      {formatCurrency(payable.payableAmount)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-[hsl(var(--color-border-secondary))]"></div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                      剩余应付
                    </p>
                    <p className="text-2xl font-bold text-[hsl(var(--color-warning))]">
                      {formatCurrency(payable.remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：基本信息和付款记录 */}
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

            {/* 付款记录 */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-[hsl(var(--color-bg-secondary))]/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-success))]" />
                  付款记录
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payable.paymentOutRecords &&
                payable.paymentOutRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[hsl(var(--color-bg-tertiary))]/50 hover:bg-[hsl(var(--color-bg-tertiary))]/50">
                        <TableHead className="h-9">付款单号</TableHead>
                        <TableHead className="h-9">付款方式</TableHead>
                        <TableHead className="h-9">付款日期</TableHead>
                        <TableHead className="h-9 text-right">金额</TableHead>
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
                            <Badge variant="outline" className="font-normal">
                              {PAYMENT_OUT_METHOD_LABELS[payment.paymentMethod]}
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
                ) : (
                  <div className="py-8">
                    <EmptyState
                      icon={
                        <CreditCard className="h-8 w-8 text-[hsl(var(--color-border-secondary))]" />
                      }
                      title="暂无付款记录"
                      description="该应付账款尚未进行任何付款"
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
                      已付金额
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
                        付款进度
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
