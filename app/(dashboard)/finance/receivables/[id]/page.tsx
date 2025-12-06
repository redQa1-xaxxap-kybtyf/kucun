'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, Edit, FileText, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils';
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
  dueDate: string;
  status: string;
  paymentTerms?: string;
  description?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
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
  }>;
}

const RECEIVABLE_STATUS_LABELS = {
  pending: '待收款',
  partial: '部分收款',
  received: '已收款',
  cancelled: '已取消',
};

async function fetchReceivableDetail(id: string): Promise<ReceivableDetail> {
  const response = await fetch(`/api/finance/receivables/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取应收款详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取应收款详情失败');
  }

  return result.data;
}

type RouterLike = { push: (href: string) => void };

function ReceivableHeaderActions({
  receivable,
}: {
  receivable: ReceivableDetail;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 sm:space-x-2">
        <span className="text-muted-foreground">
          应收款单号：{receivable.receivableNumber}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          编辑
        </Button>
        {receivable.status !== 'received' && (
          <Button size="sm">
            <ChineseYuan className="mr-2 h-4 w-4" />
            记录收款
          </Button>
        )}
      </div>
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
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          收款状态
        </label>
        <div className="mt-1 flex items-center space-x-2">
          <Badge variant={getReceivableStatusBadgeVariant(receivable.status)}>
            {RECEIVABLE_STATUS_LABELS[
              receivable.status as keyof typeof RECEIVABLE_STATUS_LABELS
            ] || receivable.status}
          </Badge>
        </div>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          关联销售订单
        </label>
        <p className="mt-1">
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              router.push(`/sales-orders/${receivable.salesOrder.id}`)
            }
          >
            {receivable.salesOrder.orderNumber}
          </Button>
        </p>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          客户
        </label>
        <div className="mt-1 flex items-center space-x-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <span>{receivable.customer.name}</span>
        </div>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          联系人
        </label>
        <p className="mt-1">{receivable.customer.contactPerson || '-'}</p>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          付款条件
        </label>
        <p className="mt-1">{receivable.paymentTerms || '-'}</p>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          到期日期
        </label>
        <div className="items中心 mt-1 flex space-x-2">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <span>{formatDate(receivable.dueDate)}</span>
        </div>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          创建人
        </label>
        <p className="mt-1">{receivable.user.name}</p>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          创建时间
        </label>
        <p className="mt-1">{formatDateTime(receivable.createdAt)}</p>
      </div>
      <div>
        <label className="text-muted-foreground text-sm font-medium">
          更新时间
        </label>
        <p className="mt-1">{formatDateTime(receivable.updatedAt)}</p>
      </div>
    </div>
  );
}

function BasicInfoExtra({ receivable }: { receivable: ReceivableDetail }) {
  return (
    <>
      {receivable.description && (
        <div>
          <label className="text-muted-foreground text-sm font-medium">
            描述
          </label>
          <p className="mt-1 text-sm">{receivable.description}</p>
        </div>
      )}
      {receivable.remarks && (
        <div>
          <label className="text-muted-foreground text-sm font-medium">
            备注信息
          </label>
          <p className="mt-1 text-sm">{receivable.remarks}</p>
        </div>
      )}
    </>
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
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <BasicInfoFields receivable={receivable} router={router} />
        <BasicInfoExtra receivable={receivable} />
      </CardContent>
    </Card>
  );
}

function PaymentRecordsCard({ receivable }: { receivable: ReceivableDetail }) {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>收款记录</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {receivable.paymentRecords.length > 0 ? (
          <div className="space-y-4">
            {receivable.paymentRecords.map((payment, index) => (
              <div key={payment.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{payment.paymentNumber}</h4>
                    <div className="text-muted-foreground space-y-1 text-sm">
                      <p>收款方式：{payment.paymentMethod}</p>
                      <p>收款日期：{formatDate(payment.paymentDate)}</p>
                      {payment.remarks && <p>备注：{payment.remarks}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[hsl(var(--color-success))]">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                </div>
                {index < receivable.paymentRecords.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            暂无收款记录
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
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle>金额汇总</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">应收金额</span>
          <span className="font-medium">
            {formatCurrency(receivable.receivableAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">已收金额</span>
          <span className="font-medium text-[hsl(var(--color-success))]">
            {formatCurrency(receivable.receivedAmount)}
          </span>
        </div>
        <div className="flex justify-between">
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
            ></div>
          </div>
        </div>
        <Separator />
        <div className="text-muted-foreground flex justify-between text-sm">
          <span>订单总金额</span>
          <span>{formatCurrency(receivable.salesOrder.totalAmount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard() {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle>快速操作</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-6">
        <Button className="w-full" size="sm">
          <ChineseYuan className="mr-2 h-4 w-4" />
          记录收款
        </Button>
        <Button variant="outline" className="w-full" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          编辑应收款
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
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
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

  const {
    data: receivable,
    isLoading,
    error,
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
        title="应收款不存在"
        message="未找到指定的应收款记录"
        onRetry={() => router.push('/finance/receivables')}
      />
    );
  }

  const paymentProgress =
    receivable.receivableAmount > 0
      ? (receivable.receivedAmount / receivable.receivableAmount) * 100
      : 0;

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      <ReceivableHeaderActions receivable={receivable} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BasicInfoCard receivable={receivable} router={router} />
          <PaymentRecordsCard receivable={receivable} />
        </div>
        <div className="space-y-4">
          <AmountSummaryCard
            receivable={receivable}
            paymentProgress={paymentProgress}
          />
          {receivable.status !== 'received' && <QuickActionsCard />}
          <CustomerInfoCard receivable={receivable} router={router} />
        </div>
      </div>
    </div>
  );
}
