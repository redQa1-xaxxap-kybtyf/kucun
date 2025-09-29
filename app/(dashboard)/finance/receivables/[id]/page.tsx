'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  FileText,
  Users,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/utils';

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
  } = useQuery({
    queryKey: ['receivable', id],
    queryFn: () => fetchReceivableDetail(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={error instanceof Error ? error.message : '获取应收款详情失败'}
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
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">应收款详情</h1>
            <p className="text-muted-foreground">
              应收款单号：{receivable.receivableNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          {receivable.status !== 'received' && (
            <Button size="sm">
              <DollarSign className="mr-2 h-4 w-4" />
              记录收款
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
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
                  <label className="text-sm font-medium text-muted-foreground">
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
                  <label className="text-sm font-medium text-muted-foreground">
                    客户
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{receivable.customer.name}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    联系人
                  </label>
                  <p className="mt-1">
                    {receivable.customer.contactPerson || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    付款条件
                  </label>
                  <p className="mt-1">{receivable.paymentTerms || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    到期日期
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={isOverdue ? 'text-red-600' : ''}>
                      {formatDate(receivable.dueDate)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建人
                  </label>
                  <p className="mt-1">{receivable.user.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建时间
                  </label>
                  <p className="mt-1">{formatDate(receivable.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    更新时间
                  </label>
                  <p className="mt-1">{formatDate(receivable.updatedAt)}</p>
                </div>
              </div>
              {receivable.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    描述
                  </label>
                  <p className="mt-1 text-sm">{receivable.description}</p>
                </div>
              )}
              {receivable.remarks && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    备注信息
                  </label>
                  <p className="mt-1 text-sm">{receivable.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 收款记录 */}
          <Card>
            <CardHeader>
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
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>收款方式：{payment.paymentMethod}</p>
                            <p>收款日期：{formatDate(payment.paymentDate)}</p>
                            {payment.remarks && <p>备注：{payment.remarks}</p>}
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
                <div className="py-8 text-center text-muted-foreground">
                  暂无收款记录
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 金额汇总 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>金额汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>订单总金额</span>
                <span>{formatCurrency(receivable.salesOrder.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          {receivable.status !== 'received' && (
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
          <Card>
            <CardHeader>
              <CardTitle>客户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{receivable.customer.name}</p>
                {receivable.customer.contactPerson && (
                  <p className="text-sm text-muted-foreground">
                    联系人：{receivable.customer.contactPerson}
                  </p>
                )}
                {receivable.customer.phone && (
                  <p className="text-sm text-muted-foreground">
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
  );
}
