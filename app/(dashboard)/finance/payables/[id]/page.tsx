'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building,
  Calendar,
  DollarSign,
  Edit,
  FileText,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
} from '@/lib/types/payable';
import { formatCurrency, formatDate } from '@/lib/utils';

import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface PayableDetail {
  id: string;
  payableNumber: string;
  supplierId: string;
  userId: string;
  sourceType: string;
  sourceId?: string;
  sourceNumber?: string;
  payableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
  paymentTerms?: string;
  description?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
    phone?: string;
    contactPerson?: string;
  };
  user: {
    id: string;
    name: string;
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

async function fetchPayableDetail(id: string): Promise<PayableDetail> {
  const response = await fetch(`/api/finance/payables/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取应付款详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取应付款详情失败');
  }

  return result.data;
}

export default function PayableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: payable,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['payable', id],
    queryFn: () => fetchPayableDetail(id),
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
        message={error instanceof Error ? error.message : '获取应付款详情失败'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!payable) {
    return (
      <ErrorMessage
        title="应付款不存在"
        message="未找到指定的应付款记录"
        onRetry={() => router.push('/finance/payables')}
      />
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
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
    new Date(payable.dueDate) < new Date() && payable.status !== 'paid';
  const paymentProgress =
    payable.payableAmount > 0
      ? (payable.paidAmount / payable.payableAmount) * 100
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
            <h1 className="text-2xl font-bold">应付款详情</h1>
            <p className="text-muted-foreground">
              应付款单号：{payable.payableNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          {payable.status !== 'paid' && (
            <Button size="sm">
              <DollarSign className="mr-2 h-4 w-4" />
              记录付款
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
                    付款状态
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Badge variant={getStatusBadgeVariant(payable.status)}>
                      {PAYABLE_STATUS_LABELS[payable.status] || payable.status}
                    </Badge>
                    {isOverdue && <Badge variant="destructive">逾期</Badge>}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    来源类型
                  </label>
                  <p className="mt-1">
                    {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType] ||
                      payable.sourceType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    供应商
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{payable.supplier.name}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    联系人
                  </label>
                  <p className="mt-1">
                    {payable.supplier.contactPerson || '-'}
                  </p>
                </div>
                {payable.sourceNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      关联单号
                    </label>
                    <p className="mt-1">
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => {
                          if (payable.sourceType === 'sales_order') {
                            router.push(`/sales-orders/${payable.sourceId}`);
                          }
                        }}
                      >
                        {payable.sourceNumber}
                      </Button>
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    付款条件
                  </label>
                  <p className="mt-1">{payable.paymentTerms || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    到期日期
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={isOverdue ? 'text-red-600' : ''}>
                      {formatDate(payable.dueDate)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建人
                  </label>
                  <p className="mt-1">{payable.user.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    创建时间
                  </label>
                  <p className="mt-1">{formatDate(payable.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    更新时间
                  </label>
                  <p className="mt-1">{formatDate(payable.updatedAt)}</p>
                </div>
              </div>
              {payable.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    描述
                  </label>
                  <p className="mt-1 text-sm">{payable.description}</p>
                </div>
              )}
              {payable.remarks && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    备注信息
                  </label>
                  <p className="mt-1 text-sm">{payable.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 付款记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>付款记录</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payable.paymentRecords.length > 0 ? (
                <div className="space-y-4">
                  {payable.paymentRecords.map((payment, index) => (
                    <div key={payment.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {payment.paymentNumber}
                          </h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>付款方式：{payment.paymentMethod}</p>
                            <p>付款日期：{formatDate(payment.paymentDate)}</p>
                            {payment.remarks && <p>备注：{payment.remarks}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                      </div>
                      {index < payable.paymentRecords.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  暂无付款记录
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
                <span className="text-muted-foreground">应付金额</span>
                <span className="font-medium">
                  {formatCurrency(payable.payableAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已付金额</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(payable.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">剩余金额</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(payable.remainingAmount)}
                </span>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>付款进度</span>
                  <span>{paymentProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${paymentProgress}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          {payable.status !== 'paid' && (
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" size="sm">
                  <DollarSign className="mr-2 h-4 w-4" />
                  记录付款
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  编辑应付款
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 供应商信息 */}
          <Card>
            <CardHeader>
              <CardTitle>供应商信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{payable.supplier.name}</p>
                {payable.supplier.contactPerson && (
                  <p className="text-sm text-muted-foreground">
                    联系人：{payable.supplier.contactPerson}
                  </p>
                )}
                {payable.supplier.phone && (
                  <p className="text-sm text-muted-foreground">
                    电话：{payable.supplier.phone}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push(`/suppliers/${payable.supplier.id}`)}
              >
                查看供应商详情
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
