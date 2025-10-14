'use client';

import { format } from 'date-fns';
import {
  CheckCircle,
  Clock,
  DollarSign,
  Receipt,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/format';
import type { PaymentStatus } from '@/lib/types/payment';
import { useConfirmPayment } from '@/lib/api/payments';
import { useToast } from '@/components/ui/use-toast';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: PaymentStatus;
  remarks?: string;
  receiptNumber?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    remainingAmount: number;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsClientProps {
  initialData: {
    payments: PaymentRecord[];
    statistics: {
      totalAmount: number;
      confirmedAmount: number;
      pendingAmount: number;
      recordCount: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams?: {
    page: number;
    limit: number;
    search?: string;
    status?: PaymentStatus;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: PaymentStatus | string | undefined) => void;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: PaymentStatus }) {
  const statusConfig = {
    pending: { label: '待确认', variant: 'secondary' as const, icon: Clock },
    confirmed: {
      label: '已确认',
      variant: 'default' as const,
      icon: CheckCircle,
    },
    applied: {
      label: '已冲抵',
      variant: 'outline' as const,
      icon: Receipt,
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
    },
  };

  const config = statusConfig[status] || {
    label: '未知',
    variant: 'secondary' as const,
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 收款记录客户端交互组件
 */
export function PaymentsClient({
  initialData,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onPageChange: externalOnPageChange,
  onRefresh: externalOnRefresh,
}: PaymentsClientProps) {
  const { payments, statistics, pagination } = initialData;
  const { toast } = useToast();
  const confirmPaymentMutation = useConfirmPayment();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  // 处理搜索
  const handleSearch = React.useCallback(
    (value: string) => {
      if (externalOnSearch) {
        externalOnSearch(value);
      }
    },
    [externalOnSearch]
  );

  // 处理筛选
  const handleFilterChange = React.useCallback(
    (key: string, value: string) => {
      if (!externalOnFilter) {
        return;
      }
      if (value === 'all' || !value) {
        externalOnFilter(key, undefined);
        return;
      }
      externalOnFilter(
        key,
        key === 'status' ? (value as PaymentStatus) : value
      );
    },
    [externalOnFilter]
  );

  // 处理分页
  const handlePageChange = React.useCallback(
    (page: number) => {
      if (externalOnPageChange) {
        externalOnPageChange(page);
      }
    },
    [externalOnPageChange]
  );

  const handleConfirm = React.useCallback(
    async (paymentId: string) => {
      try {
        setConfirmingId(paymentId);
        await confirmPaymentMutation.mutateAsync({ id: paymentId });
        toast({
          title: '收款已确认',
          description: '该收款记录已成功确认到账。',
        });
        externalOnRefresh?.();
      } catch (error) {
        toast({
          title: '确认失败',
          description: error instanceof Error ? error.message : '请稍后重试',
          variant: 'destructive',
        });
      } finally {
        setConfirmingId(null);
      }
    },
    [confirmPaymentMutation, toast, externalOnRefresh]
  );

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收款金额</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(statistics.totalAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.recordCount} 条收款记录
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              已确认 / 冲抵金额
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {formatCurrency(statistics.confirmedAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              含预收款冲抵，确认率{' '}
              {statistics.totalAmount > 0
                ? (
                    (statistics.confirmedAmount / statistics.totalAmount) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待确认金额</CardTitle>
            <Clock className="h-4 w-4 text-[hsl(var(--color-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(statistics.pendingAmount)}
            </div>
            <p className="text-muted-foreground text-xs">需要及时确认</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">收款率</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--color-purple))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-purple))]">
              {statistics.totalAmount > 0
                ? (
                    (statistics.confirmedAmount / statistics.totalAmount) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-muted-foreground text-xs">较上月提升 5%</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <UnifiedSearchBar
                searchValue={initialParams?.search ?? ''}
                onSearchChange={handleSearch}
                searchPlaceholder="搜索收款单号、客户名称或订单号..."
              />
            </div>
            <Select
              value={initialParams?.status || 'all'}
              onValueChange={value => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待确认</SelectItem>
                <SelectItem value="confirmed">已确认</SelectItem>
                <SelectItem value="applied">已冲抵</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={initialParams?.paymentMethod || 'all'}
              onValueChange={value =>
                handleFilterChange('paymentMethod', value)
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="支付方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方式</SelectItem>
                <SelectItem value="cash">现金</SelectItem>
                <SelectItem value="bank_transfer">银行转账</SelectItem>
                <SelectItem value="alipay">支付宝</SelectItem>
                <SelectItem value="wechat">微信支付</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 收款记录列表 */}
          {payments.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">暂无收款记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map(payment => {
                const orderTotal = payment.salesOrder.totalAmount;
                const orderPaid = payment.salesOrder.paidAmount;
                const orderPending = payment.salesOrder.pendingAmount;
                const orderRemaining = payment.salesOrder.remainingAmount;
                const progressPercent =
                  orderTotal > 0 ? (orderPaid / orderTotal) * 100 : 0;
                const paymentStatusLabel =
                  payment.status === 'pending'
                    ? '待确认'
                    : payment.status === 'cancelled'
                      ? '已取消'
                      : payment.status === 'applied'
                        ? '已冲抵'
                        : '已确认';

                return (
                  <Card key={payment.id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-6">
                        {/* 左侧信息区 */}
                        <div className="flex-1 space-y-3">
                          {/* 收款单号和状态 */}
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">
                              {payment.paymentNumber}
                            </h3>
                            <StatusBadge status={payment.status} />
                            {(payment.status === 'confirmed' ||
                              payment.status === 'applied') && (
                              <>
                                {orderRemaining <= 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-green-300 bg-green-50 text-green-700"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    订单已收款
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-yellow-300 bg-yellow-50 text-yellow-700"
                                  >
                                    <Clock className="h-3 w-3" />
                                    订单部分收款
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>

                          {/* 客户和订单信息 */}
                          <div className="space-y-1.5 text-sm text-[hsl(var(--color-text-secondary))]">
                            <p className="flex items-center gap-1">
                              <span className="text-[hsl(var(--color-text-tertiary))]">
                                客户:
                              </span>
                              <span className="font-medium">
                                {payment.customer.name}
                              </span>
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="text-[hsl(var(--color-text-tertiary))]">
                                订单:
                              </span>
                              <span className="font-medium">
                                {payment.salesOrder.orderNumber}
                              </span>
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="text-[hsl(var(--color-text-tertiary))]">
                                收款时间:
                              </span>
                              <span className="font-medium">
                                {format(
                                  new Date(payment.paymentDate),
                                  'yyyy-MM-dd HH:mm'
                                )}
                              </span>
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="text-[hsl(var(--color-text-tertiary))]">
                                创建时间:
                              </span>
                              <span className="text-xs">
                                {format(
                                  new Date(payment.createdAt),
                                  'yyyy-MM-dd HH:mm'
                                )}
                              </span>
                            </p>
                            {payment.status === 'confirmed' && (
                              <p className="flex items-center gap-1">
                                <span className="text-[hsl(var(--color-text-tertiary))]">
                                  确认时间:
                                </span>
                                <span className="text-xs font-medium text-[hsl(var(--color-success))]">
                                  {format(
                                    new Date(payment.updatedAt),
                                    'yyyy-MM-dd HH:mm'
                                  )}
                                </span>
                              </p>
                            )}
                            {payment.receiptNumber && (
                              <p className="flex items-center gap-1">
                                <span className="text-[hsl(var(--color-text-tertiary))]">
                                  收据号:
                                </span>
                                <span className="font-mono text-xs">
                                  {payment.receiptNumber}
                                </span>
                              </p>
                            )}
                          </div>

                          {/* 订单收款情况 */}
                          <div className="space-y-2 rounded-md border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/30 p-3">
                            <div className="mb-2 text-xs font-semibold text-gray-700">
                              订单收款情况
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div className="rounded bg-white/80 p-2 text-center">
                                <div className="mb-0.5 text-[10px] text-gray-600">
                                  订单总额
                                </div>
                                <div className="font-bold text-blue-600">
                                  {formatCurrency(orderTotal)}
                                </div>
                              </div>
                              <div className="rounded bg-white/80 p-2 text-center">
                                <div className="mb-0.5 text-[10px] text-gray-600">
                                  已确认
                                </div>
                                <div className="font-bold text-green-600">
                                  {formatCurrency(orderPaid)}
                                </div>
                              </div>
                              <div className="rounded bg-white/80 p-2 text-center">
                                <div className="mb-0.5 text-[10px] text-gray-600">
                                  待确认
                                </div>
                                <div className="font-bold text-yellow-600">
                                  {formatCurrency(orderPending)}
                                </div>
                              </div>
                              <div className="rounded bg-white/80 p-2 text-center">
                                <div className="mb-0.5 text-[10px] text-gray-600">
                                  待收款
                                </div>
                                <div className="font-bold text-orange-600">
                                  {formatCurrency(orderRemaining)}
                                </div>
                              </div>
                            </div>

                            {/* 进度条 */}
                            <div className="mt-2">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[10px] text-gray-600">
                                  收款进度
                                </span>
                                <span className="text-[10px] font-bold text-green-600">
                                  {progressPercent.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                                  style={{
                                    width: `${Math.min(progressPercent, 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 右侧操作区 */}
                        <div className="flex flex-col items-end justify-between">
                          <div className="mb-3 text-right">
                            <div className="mb-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                              本次收款
                            </div>
                            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
                              {formatCurrency(payment.paymentAmount)}
                            </div>
                            <div className="mt-1 text-[10px] text-[hsl(var(--color-text-tertiary))]">
                              {paymentStatusLabel}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {payment.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleConfirm(payment.id)}
                                disabled={
                                  confirmingId === payment.id ||
                                  confirmPaymentMutation.isPending
                                }
                              >
                                {confirmingId === payment.id
                                  ? '确认中...'
                                  : '确认收款'}
                              </Button>
                            )}
                            <Button size="sm" asChild>
                              <Link href={`/finance/payments/${payment.id}`}>
                                查看详情
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {pagination && (
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              showTotal
              containerClassName="mt-6"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
