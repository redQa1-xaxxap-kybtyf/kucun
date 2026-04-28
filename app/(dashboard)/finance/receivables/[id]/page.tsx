'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Calendar, FileText, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ContentLoading } from '@/components/common/loading';
import {
  ReceivablePaymentDialog,
  type ReceivablePaymentTarget,
} from '@/components/finance/receivable-payment-dialog';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';
import { cn, formatCurrency } from '@/lib/utils';
import { getReceivableStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import { getErrorMessage } from '@/lib/utils/error-handler';

interface ReceivableDetail {
  id: string;
  receivableNumber: string;
  customerId: string;
  userId: string;
  salesOrderId: string;
  receivableAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  pendingAmount?: number;
  prepaymentApplied?: number;
  orderRoundingAdjustment?: number;
  paymentRoundingAmount?: number;
  pendingRoundingAmount?: number;
  dueDate: string;
  status: string;
  paymentTerms?: string;
  description?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  receivableConfirmation?: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    status: string;
    remarks?: string;
  };
  customer: {
    id: string;
    name: string;
    phone?: string;
    contactPerson?: string;
  };
  user: {
    id: string;
    name: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  paymentRecords: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    remarks?: string;
    status?: string;
    sourceType?: 'payment' | 'prepayment';
    roundingAmount?: number;
  }>;
}

const RECEIVABLE_STATUS_LABELS = {
  unpaid: '待收款',
  partial: '部分收款',
  pending: '待确认到账',
  paid: '已收款',
  cancelled: '已取消',
};

const PAYMENT_RECORD_STATUS_LABELS = {
  pending: '待确认到账',
  confirmed: '已到账',
  applied: '已抵扣',
  cancelled: '已取消',
};

async function fetchReceivableDetail(id: string): Promise<ReceivableDetail> {
  const response = await fetch(`/api/finance/receivables/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取待收款详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取待收款详情失败');
  }

  return result.data;
}

type RouterLike = { push: (href: string) => void };

function hasMeaningfulAmount(value?: number): boolean {
  return Math.abs(Number(value ?? 0)) > 0.000001;
}

function formatSignedCurrency(value: number): string {
  const absValue = Math.abs(value);
  return `${value >= 0 ? '+' : '-'}${formatCurrency(absValue)}`;
}

function formatPaymentMethod(method?: string): string {
  switch (method) {
    case 'cash':
      return '现金';
    case 'bank_transfer':
      return '银行转账';
    case 'alipay':
      return '支付宝';
    case 'wechat':
      return '微信';
    case 'check':
      return '支票';
    default:
      return method || '其他';
  }
}

function ReceivableHeaderActions({
  receivable,
  onOpenPaymentDialog,
}: {
  receivable: ReceivableDetail;
  onOpenPaymentDialog: () => void;
}) {
  return (
    <div className="bg-card rounded-md border p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">应收编号</span>
            <span className="font-medium">{receivable.receivableNumber}</span>
            <Badge variant={getReceivableStatusBadgeVariant(receivable.status)}>
              {RECEIVABLE_STATUS_LABELS[
                receivable.status as keyof typeof RECEIVABLE_STATUS_LABELS
              ] || receivable.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            这里按销售订单查看应收、已收、抹零和预收抵扣情况。
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:w-auto">
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href={`/sales-orders/${receivable.salesOrder.id}`}>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              查看销售订单
            </Link>
          </Button>
          {receivable.status === 'pending' ? (
            <Button size="sm" variant="outline" asChild className="w-full">
              <Link href="/finance/payments?status=pending">
                <ChineseYuan className="mr-2 h-4 w-4" />
                去收款管理确认
              </Link>
            </Button>
          ) : receivable.status !== 'paid' ? (
            <Button size="sm" className="w-full" onClick={onOpenPaymentDialog}>
              <ChineseYuan className="mr-2 h-4 w-4" />
              登记收款
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label className="text-muted-foreground text-sm font-medium">
        {label}
      </label>
      <div className="min-h-6 text-sm break-words">{children}</div>
    </div>
  );
}

function BasicInfoFields({
  receivable,
  router,
}: {
  receivable: ReceivableDetail;
  router: RouterLike;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <InfoField label="收款状态">
        <div className="flex items-center gap-2">
          <Badge variant={getReceivableStatusBadgeVariant(receivable.status)}>
            {RECEIVABLE_STATUS_LABELS[
              receivable.status as keyof typeof RECEIVABLE_STATUS_LABELS
            ] || receivable.status}
          </Badge>
        </div>
      </InfoField>

      <InfoField label="关联销售订单">
        <Button
          variant="link"
          className="h-auto p-0 text-left whitespace-normal"
          onClick={() =>
            router.push(`/sales-orders/${receivable.salesOrder.id}`)
          }
        >
          {receivable.salesOrder.orderNumber}
        </Button>
      </InfoField>

      <InfoField label="客户">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <span>{receivable.customer.name}</span>
        </div>
      </InfoField>

      <InfoField label="联系人">
        <span>{receivable.customer.contactPerson || '-'}</span>
      </InfoField>

      <InfoField label="付款条件">
        <span>{receivable.paymentTerms || '-'}</span>
      </InfoField>

      <InfoField label="到期日期">
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <span>{formatDate(receivable.dueDate)}</span>
        </div>
      </InfoField>

      <InfoField label="创建人">
        <span>{receivable.user.name}</span>
      </InfoField>

      <InfoField label="创建时间">
        <span>{formatDateTime(receivable.createdAt)}</span>
      </InfoField>

      <InfoField label="更新时间">
        <span>{formatDateTime(receivable.updatedAt)}</span>
      </InfoField>
    </div>
  );
}

function BasicInfoExtra({ receivable }: { receivable: ReceivableDetail }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {receivable.description && (
        <div className="bg-muted/30 rounded-md border p-4">
          <label className="text-muted-foreground text-sm font-medium">
            描述
          </label>
          <p className="mt-1 text-sm break-words">{receivable.description}</p>
        </div>
      )}
      {receivable.remarks && (
        <div className="bg-muted/30 rounded-md border p-4">
          <label className="text-muted-foreground text-sm font-medium">
            备注信息
          </label>
          <p className="mt-1 text-sm break-words">{receivable.remarks}</p>
        </div>
      )}
    </div>
  );
}

function BasicInfoCard({
  receivable,
  router,
}: {
  receivable: ReceivableDetail;
  router: RouterLike;
}) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <BasicInfoFields receivable={receivable} router={router} />
        <BasicInfoExtra receivable={receivable} />
      </CardContent>
    </Card>
  );
}

function ReceivableConfirmationCard({
  receivableConfirmation,
}: {
  receivableConfirmation: NonNullable<
    ReceivableDetail['receivableConfirmation']
  >;
}) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="text-base">应收记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        <div className="bg-muted/30 rounded-md border border-dashed p-4">
          <p className="text-muted-foreground text-sm">
            系统生成，不计入客户实付。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="登记编号">
            <span>{receivableConfirmation.paymentNumber}</span>
          </InfoField>
          <InfoField label="登记时间">
            <span>{formatDateTime(receivableConfirmation.paymentDate)}</span>
          </InfoField>
          <InfoField label="当前状态">
            <Badge
              variant={
                receivableConfirmation.status === 'pending'
                  ? 'warning'
                  : receivableConfirmation.status === 'cancelled'
                    ? 'outline'
                    : 'secondary'
              }
            >
              {PAYMENT_RECORD_STATUS_LABELS[
                receivableConfirmation.status as keyof typeof PAYMENT_RECORD_STATUS_LABELS
              ] || receivableConfirmation.status}
            </Badge>
          </InfoField>
          {receivableConfirmation.remarks && (
            <InfoField label="备注" className="sm:col-span-2">
              <span>{receivableConfirmation.remarks}</span>
            </InfoField>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentRecordsCard({ receivable }: { receivable: ReceivableDetail }) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <span>收款和抵扣记录</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {receivable.paymentRecords.length > 0 ? (
          <div className="space-y-3">
            {receivable.paymentRecords.map(payment => (
              <div
                key={payment.id}
                className="rounded-md border bg-slate-50/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium break-all">
                        {payment.paymentNumber}
                      </h4>
                      {payment.sourceType && (
                        <Badge variant="secondary">
                          {payment.sourceType === 'prepayment'
                            ? '预收抵扣'
                            : '订单收款'}
                        </Badge>
                      )}
                      {payment.status && (
                        <Badge
                          variant={
                            payment.status === 'pending'
                              ? 'warning'
                              : payment.status === 'cancelled'
                                ? 'outline'
                                : 'success'
                          }
                        >
                          {PAYMENT_RECORD_STATUS_LABELS[
                            payment.status as keyof typeof PAYMENT_RECORD_STATUS_LABELS
                          ] || payment.status}
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
                      <p>
                        收款方式：{formatPaymentMethod(payment.paymentMethod)}
                      </p>
                      <p>收款日期：{formatDate(payment.paymentDate)}</p>
                      {payment.remarks && (
                        <p className="break-words sm:col-span-2">
                          备注：{payment.remarks}
                        </p>
                      )}
                      {hasMeaningfulAmount(payment.roundingAmount) && (
                        <p className="sm:col-span-2">
                          收款抹零：
                          {formatSignedCurrency(payment.roundingAmount ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-muted-foreground text-xs">
                      {payment.sourceType === 'prepayment'
                        ? '抵扣金额'
                        : '实收金额'}
                    </p>
                    <p className="font-medium text-[hsl(var(--color-success))]">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            还没有实际收款或预收抵扣记录
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AmountSummaryCard({
  receivable,
  paymentProgress,
}: {
  receivable: ReceivableDetail;
  paymentProgress: number;
}) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>金额汇总</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">订单金额</span>
          <span className="font-medium">
            {formatCurrency(receivable.salesOrder.totalAmount)}
          </span>
        </div>

        {hasMeaningfulAmount(receivable.orderRoundingAdjustment) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">整单抹零</span>
            <span className="font-medium">
              {formatSignedCurrency(receivable.orderRoundingAdjustment ?? 0)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">应收金额</span>
          <span className="font-medium">
            {formatCurrency(receivable.receivableAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">实收金额</span>
          <span className="font-medium text-[hsl(var(--color-success))]">
            {formatCurrency(receivable.receivedAmount)}
          </span>
        </div>

        {hasMeaningfulAmount(receivable.prepaymentApplied) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">预收抵扣</span>
            <span className="font-medium text-[hsl(var(--color-success))]">
              {formatCurrency(receivable.prepaymentApplied ?? 0)}
            </span>
          </div>
        )}

        {hasMeaningfulAmount(receivable.paymentRoundingAmount) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">收款抹零</span>
            <span className="font-medium">
              {formatSignedCurrency(receivable.paymentRoundingAmount ?? 0)}
            </span>
          </div>
        )}

        {hasMeaningfulAmount(receivable.pendingAmount) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">待确认到账</span>
            <span className="font-medium text-amber-600">
              {formatCurrency(receivable.pendingAmount ?? 0)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">剩余金额</span>
          <span className="font-medium text-[hsl(var(--color-error))]">
            {formatCurrency(receivable.remainingAmount)}
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>收款进度</span>
            <span>{paymentProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[hsl(var(--color-border-secondary))]">
            <div
              className="h-2 rounded-full bg-[hsl(var(--color-success))] transition-all duration-300"
              style={{ width: `${paymentProgress}%` }}
            />
          </div>
        </div>

        <Separator />

        <div className="text-muted-foreground space-y-1 text-sm">
          <div className="flex justify-between">
            <span>已收合计</span>
            <span>
              {formatCurrency(
                receivable.receivableAmount - receivable.remainingAmount
              )}
            </span>
          </div>
          {hasMeaningfulAmount(receivable.pendingRoundingAmount) && (
            <div className="flex justify-between">
              <span>待确认抹零</span>
              <span>
                {formatSignedCurrency(receivable.pendingRoundingAmount ?? 0)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({
  receivable,
  onOpenPaymentDialog,
}: {
  receivable: ReceivableDetail;
  onOpenPaymentDialog: () => void;
}) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>快速操作</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-6">
        {receivable.status === 'pending' ? (
          <Button className="w-full" size="sm" variant="outline" asChild>
            <Link href="/finance/payments?status=pending">
              <ChineseYuan className="mr-2 h-4 w-4" />
              去收款管理确认
            </Link>
          </Button>
        ) : (
          <Button className="w-full" size="sm" onClick={onOpenPaymentDialog}>
            <ChineseYuan className="mr-2 h-4 w-4" />
            登记收款
          </Button>
        )}
        <Button variant="outline" className="w-full" size="sm" asChild>
          <Link href={`/sales-orders/${receivable.salesOrder.id}`}>
            <Receipt className="mr-2 h-4 w-4" />
            查看销售订单
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomerInfoCard({
  receivable,
  router,
}: {
  receivable: ReceivableDetail;
  router: RouterLike;
}) {
  return (
    <Card className="border-border rounded-md border shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>客户信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="font-medium">{receivable.customer.name}</p>
          {receivable.customer.contactPerson && (
            <p className="text-muted-foreground text-sm">
              联系人：{receivable.customer.contactPerson}
            </p>
          )}
          {receivable.customer.phone && (
            <p className="text-muted-foreground text-sm">
              电话：{receivable.customer.phone}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => router.push(`/customers/${receivable.customer.id}`)}
        >
          查看客户详情
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ReceivableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const {
    data: receivable,
    isLoading,
    error,
    refetch,
  } = useQuery<ReceivableDetail>({
    queryKey: queryKeys.finance.receivable(id),
    queryFn: () => fetchReceivableDetail(id),
    enabled: !!id,
  });

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

  if (!receivable) {
    return (
      <ErrorMessage
        title="待收款不存在"
        message="未找到这笔待收款"
        onRetry={() => router.push('/finance/receivables')}
      />
    );
  }

  const paymentProgress =
    receivable.receivableAmount > 0
      ? ((receivable.receivableAmount - receivable.remainingAmount) /
          receivable.receivableAmount) *
        100
      : 0;

  const paymentDialogReceivable: ReceivablePaymentTarget = {
    id: receivable.salesOrder.id,
    orderNumber: receivable.salesOrder.orderNumber,
    customerId: receivable.customerId,
    customerName: receivable.customer.name,
    totalAmount: receivable.salesOrder.totalAmount,
    paidAmount: receivable.receivedAmount,
    remainingAmount: receivable.remainingAmount,
    lastPaymentDate:
      receivable.paymentRecords[0]?.paymentDate ??
      receivable.receivableConfirmation?.paymentDate,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <ReceivableHeaderActions
        receivable={receivable}
        onOpenPaymentDialog={() => setIsPaymentDialogOpen(true)}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <BasicInfoCard receivable={receivable} router={router} />
          {receivable.receivableConfirmation && (
            <ReceivableConfirmationCard
              receivableConfirmation={receivable.receivableConfirmation}
            />
          )}
          <PaymentRecordsCard receivable={receivable} />
        </div>
        <div className="space-y-4">
          <AmountSummaryCard
            receivable={receivable}
            paymentProgress={paymentProgress}
          />
          {receivable.status !== 'paid' && (
            <QuickActionsCard
              receivable={receivable}
              onOpenPaymentDialog={() => setIsPaymentDialogOpen(true)}
            />
          )}
          <CustomerInfoCard receivable={receivable} router={router} />
        </div>
      </div>
      <ReceivablePaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        receivable={paymentDialogReceivable}
        onSuccess={() => {
          void refetch();
        }}
      />
    </div>
  );
}
