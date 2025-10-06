'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency, formatDate } from '@/lib/utils';
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
  overdue: '逾期',
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'received':
        return 'success';
      case 'partial':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
    }
  };

  const isOverdue =
    new Date(receivable.dueDate) < new Date() &&
    receivable.status !== 'received';
  const paymentProgress =
    receivable.receivableAmount > 0
      ? (receivable.receivedAmount / receivable.receivableAmount) * 100
      : 0;

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面头部卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    应收款详情
                  </h1>
                  <p className="text-sm text-gray-600">
                    应收款单号：{receivable.receivableNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
                {receivable.status !== 'received' && (
                  <Button
                    size="lg"
                    className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    记录收款
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 基本信息 */}
          <div className="space-y-4 lg:col-span-2">
            <Card className="shadow-md shadow-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">
                      收款状态
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(receivable.status)}>
                        {RECEIVABLE_STATUS_LABELS[
                          receivable.status as keyof typeof RECEIVABLE_STATUS_LABELS
                        ] || receivable.status}
                      </Badge>
                      {isOverdue && <Badge variant="destructive">逾期</Badge>}
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
                          router.push(
                            `/sales-orders/${receivable.salesOrder.id}`
                          )
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
                    <p className="mt-1">
                      {receivable.customer.contactPerson || '-'}
                    </p>
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
                    <div className="mt-1 flex items-center space-x-2">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      <span className={isOverdue ? 'text-red-600' : ''}>
                        {formatDate(receivable.dueDate)}
                      </span>
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
                    <p className="mt-1">{formatDate(receivable.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">
                      更新时间
                    </label>
                    <p className="mt-1">{formatDate(receivable.updatedAt)}</p>
                  </div>
                </div>
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
              </CardContent>
            </Card>

            {/* 收款记录 */}
            <Card className="shadow-md shadow-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
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
                            <h4 className="font-medium">
                              {payment.paymentNumber}
                            </h4>
                            <div className="text-muted-foreground space-y-1 text-sm">
                              <p>收款方式：{payment.paymentMethod}</p>
                              <p>收款日期：{formatDate(payment.paymentDate)}</p>
                              {payment.remarks && (
                                <p>备注：{payment.remarks}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">
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
          </div>

          {/* 金额汇总 */}
          <div className="space-y-4">
            <Card className="shadow-md shadow-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
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
                  <span className="font-medium text-green-600">
                    {formatCurrency(receivable.receivedAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">剩余金额</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(receivable.remainingAmount)}
                  </span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>收款进度</span>
                    <span>{paymentProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-green-600 transition-all duration-300"
                      style={{ width: `${paymentProgress}%` }}
                    ></div>
                  </div>
                </div>
                <Separator />
                <div className="text-muted-foreground flex justify-between text-sm">
                  <span>订单总金额</span>
                  <span>
                    {formatCurrency(receivable.salesOrder.totalAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 快速操作 */}
            {receivable.status !== 'received' && (
              <Card className="shadow-md shadow-gray-200/50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
                  <CardTitle>快速操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-6">
                  <Button className="w-full" size="sm">
                    <DollarSign className="mr-2 h-4 w-4" />
                    记录收款
                  </Button>
                  <Button variant="outline" className="w-full" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    编辑应收款
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 客户信息 */}
            <Card className="shadow-md shadow-gray-200/50">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
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
                  onClick={() =>
                    router.push(`/customers/${receivable.customer.id}`)
                  }
                >
                  查看客户详情
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
