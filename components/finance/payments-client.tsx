'use client';
import { CheckCircle, Clock, Receipt, TrendingUp, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';


import { EmptyState } from '@/components/common/empty-state';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmPayment } from '@/lib/api/payments';
import type { PaymentStatus } from '@/lib/types/payment';
import { formatPaymentDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
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
    roundingAdjustment: number; // ✅ 新增: 订单抹零金额
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
      collectionRate: number;
      currentMonthCollectionRate?: number | null;
      previousMonthCollectionRate?: number | null;
      collectionRateChange?: number | null;
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
    startDate?: string;
    endDate?: string;
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: PaymentStatus | string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
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
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
  onRefresh: externalOnRefresh,
}: PaymentsClientProps) {
  const { payments, statistics, pagination } = initialData;
  const { toast } = useToast();
  const confirmPaymentMutation = useConfirmPayment();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState(
    initialParams?.search ?? ''
  );

  React.useEffect(() => {
    setSearchValue(initialParams?.search ?? '');
  }, [initialParams?.search]);

  const overallCollectionRate =
    typeof statistics.collectionRate === 'number'
      ? statistics.collectionRate
      : statistics.totalAmount > 0
        ? (statistics.confirmedAmount / statistics.totalAmount) * 100
        : 0;

  const currentMonthCollectionRate =
    typeof statistics.currentMonthCollectionRate === 'number'
      ? statistics.currentMonthCollectionRate
      : null;

  const hasPreviousMonthData =
    typeof statistics.previousMonthCollectionRate === 'number';

  const displayedCollectionRate =
    currentMonthCollectionRate ?? overallCollectionRate;

  const collectionRateChange =
    typeof statistics.collectionRateChange === 'number'
      ? statistics.collectionRateChange
      : null;

  const collectionRateChangeLabel = React.useMemo(() => {
    if (!hasPreviousMonthData || collectionRateChange === null) {
      return '暂无上月数据';
    }

    const TOLERANCE = 0.1;
    if (Math.abs(collectionRateChange) < TOLERANCE) {
      return '较上月持平';
    }

    const value = Math.abs(collectionRateChange).toFixed(1);
    return collectionRateChange > 0
      ? `较上月提升 ${value}%`
      : `较上月下降 ${value}%`;
  }, [collectionRateChange, hasPreviousMonthData]);

  // 处理搜索
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      externalOnSearch?.(value);
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

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      externalOnDateRangeChange?.(range);
    },
    [externalOnDateRangeChange]
  );

  const handleConfirm = React.useCallback(
    async (paymentId: string) => {
      try {
        setConfirmingId(paymentId);
        await confirmPaymentMutation.mutateAsync({ id: paymentId });
        toast({
          title: '收款已确认',
          description: '该收款记录已成功确认到账。',
          variant: 'success',
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
            <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-success))]" />
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
              {displayedCollectionRate.toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-xs">
              {collectionRateChangeLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <UnifiedSearchBar
                searchValue={searchValue}
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
            <DateRangePicker
              value={{
                startDate: initialParams?.startDate,
                endDate: initialParams?.endDate,
              }}
              onChange={handleDateRangeChange}
              label=""
              placeholder="选择收款日期范围"
              showPresets
              className="w-full sm:w-auto sm:min-w-[240px]"
            />
          </div>

          {/* 收款记录列表 */}
          {payments.length === 0 ? (
            <EmptyState
              icon={<Receipt className="text-muted-foreground h-8 w-8" />}
              title="暂无收款记录"
              compact
            />
          ) : (
            <div className="space-y-4">
              {payments.map(payment => {
                const orderTotal = payment.salesOrder.totalAmount;
                const orderRoundingRaw =
                  payment.salesOrder.roundingAdjustment ?? 0;
                const orderPaid = payment.salesOrder.paidAmount;
                const orderPending = payment.salesOrder.pendingAmount;
                const orderRemaining = payment.salesOrder.remainingAmount;

                // 计算订单实际应收金额
                const orderActualAmount = orderTotal + orderRoundingRaw;
                const progressPercent =
                  orderActualAmount > 0
                    ? (orderPaid / orderActualAmount) * 100
                    : 0;

                return (
                  <Card
                    key={payment.id}
                    className="group overflow-hidden border border-[hsl(var(--color-border-secondary))] bg-white transition-all duration-300 hover:border-[hsl(var(--color-primary))]/40 hover:shadow-lg"
                  >
                    <CardContent className="p-0">
                      {/* 顶部信息栏 */}
                      <div className="relative flex items-center justify-between border-b border-[hsl(var(--color-border-secondary))]/50 bg-gradient-to-br from-[hsl(var(--color-bg-secondary))] via-[hsl(var(--color-bg-tertiary))] to-white px-6 py-5">
                        {/* 装饰性渐变条 */}
                        <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold tracking-tight text-[hsl(var(--color-text-primary))] transition-colors group-hover:text-[hsl(var(--color-primary))]">
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
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                                客户
                              </span>
                              <span className="font-semibold text-[hsl(var(--color-text-secondary))]">
                                {payment.customer.name}
                              </span>
                            </div>
                            <span className="text-[hsl(var(--color-border-primary))]">
                              •
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                                订单
                              </span>
                              <span className="font-semibold text-[hsl(var(--color-text-secondary))]">
                                {payment.salesOrder.orderNumber}
                              </span>
                            </div>
                            <span className="text-[hsl(var(--color-border-primary))]">
                              •
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                                收款时间
                              </span>
                              <span className="font-medium text-[hsl(var(--color-text-secondary))]">
                                {formatPaymentDateTime(
                                  payment.paymentDate,
                                  payment.createdAt
                                )}
                              </span>
                            </div>
                            {payment.status === 'confirmed' &&
                              payment.updatedAt && (
                                <>
                                  <span className="text-[hsl(var(--color-border-primary))]">
                                    •
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                                      确认时间
                                    </span>
                                    <span className="font-medium text-[hsl(var(--color-success))]">
                                      {formatPaymentDateTime(
                                        payment.updatedAt,
                                        payment.updatedAt
                                      )}
                                    </span>
                                  </div>
                                </>
                              )}
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          {payment.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(payment.id)}
                              disabled={
                                confirmingId === payment.id ||
                                confirmPaymentMutation.isPending
                              }
                              className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                            >
                              {confirmingId === payment.id
                                ? '确认中...'
                                : '确认收款'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="border-[hsl(var(--color-border-primary))] hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary))]/5 hover:text-[hsl(var(--color-primary))]"
                          >
                            <Link href={`/finance/payments/${payment.id}`}>
                              查看详情
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {/* 收款金额信息区域 */}
                      <div className="grid grid-cols-3 gap-px border-b border-[hsl(var(--color-border-secondary))]/30 bg-[hsl(var(--color-border-secondary))]/30">
                        {/* 1. 记账金额 */}
                        <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                          <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                            记账金额
                          </span>
                          <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-primary))]">
                            {formatCurrency(payment.paymentAmount)}
                          </span>
                        </div>

                        {/* 2. 收款差额 */}
                        <div className="flex flex-col items-center justify-center bg-white px-6 py-6 transition-colors hover:bg-[hsl(var(--color-bg-secondary))]">
                          <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                            收款差额
                          </span>
                          {payment.roundingAmount !== 0 ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-2xl font-bold tracking-tight ${
                                  payment.roundingAmount < 0
                                    ? 'text-[hsl(var(--color-error))]'
                                    : 'text-[hsl(var(--color-success))]'
                                }`}
                              >
                                {payment.roundingAmount < 0 ? '+' : '-'}
                                {formatCurrency(
                                  Math.abs(payment.roundingAmount)
                                )}
                              </span>
                              <span
                                className={`mt-1 text-xs ${
                                  payment.roundingAmount < 0
                                    ? 'text-[hsl(var(--color-error))]'
                                    : 'text-[hsl(var(--color-success))]'
                                }`}
                              >
                                {payment.roundingAmount < 0 ? '多收' : '少收'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-tertiary))]">
                              -
                            </span>
                          )}
                        </div>

                        {/* 3. 实际收款 */}
                        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[hsl(var(--color-success))]/5 to-white px-6 py-6 transition-all hover:from-[hsl(var(--color-success))]/10">
                          <span className="mb-2 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                            实际收款
                          </span>
                          <span className="text-2xl font-bold tracking-tight text-[hsl(var(--color-success))]">
                            {formatCurrency(payment.actualPaymentAmount)}
                          </span>
                        </div>
                      </div>

                      {/* 订单收款情况 */}
                      <div className="bg-[hsl(var(--color-bg-tertiary))]/30 px-6 py-4">
                        <div className="mb-3 text-xs font-semibold tracking-wider text-[hsl(var(--color-text-tertiary))] uppercase">
                          订单收款进度
                        </div>

                        {/* 订单金额卡片网格 */}
                        <div className="mb-3 grid grid-cols-5 gap-3">
                          {/* 订单总额 */}
                          <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
                            <div className="mb-1 text-xs text-gray-500">
                              订单总额
                            </div>
                            <div className="text-base font-bold text-blue-600">
                              {formatCurrency(orderTotal)}
                            </div>
                          </div>

                          {/* 订单抹零 */}
                          {orderRoundingRaw !== 0 && (
                            <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
                              <div className="mb-1 text-xs text-gray-500">
                                订单抹零
                              </div>
                              <div
                                className={`text-base font-bold ${
                                  orderRoundingRaw > 0
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {orderRoundingRaw > 0 ? '+' : ''}
                                {formatCurrency(Math.abs(orderRoundingRaw))}
                              </div>
                            </div>
                          )}

                          {/* 应收金额 */}
                          <div className="rounded-lg bg-purple-50 px-3 py-2.5 shadow-sm">
                            <div className="mb-1 text-xs text-purple-600">
                              应收金额
                            </div>
                            <div className="text-base font-bold text-purple-600">
                              {formatCurrency(orderActualAmount)}
                            </div>
                          </div>

                          {/* 已确认 */}
                          <div className="rounded-lg bg-green-50 px-3 py-2.5 shadow-sm">
                            <div className="mb-1 text-xs text-green-600">
                              已确认
                            </div>
                            <div className="text-base font-bold text-green-600">
                              {formatCurrency(orderPaid)}
                            </div>
                          </div>

                          {/* 待确认 */}
                          {orderPending > 0 && (
                            <div className="rounded-lg bg-yellow-50 px-3 py-2.5 shadow-sm">
                              <div className="mb-1 text-xs text-yellow-600">
                                待确认
                              </div>
                              <div className="text-base font-bold text-yellow-600">
                                {formatCurrency(orderPending)}
                              </div>
                            </div>
                          )}

                          {/* 待收款 */}
                          <div className="rounded-lg bg-orange-50 px-3 py-2.5 shadow-sm">
                            <div className="mb-1 text-xs text-orange-600">
                              待收款
                            </div>
                            <div className="text-base font-bold text-orange-600">
                              {formatCurrency(orderRemaining)}
                            </div>
                          </div>
                        </div>

                        {/* 收款进度条 */}
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-600">
                              收款进度
                            </span>
                            <span className="font-bold text-green-600">
                              {progressPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                              style={{
                                width: `${Math.min(progressPercent, 100)}%`,
                              }}
                            ></div>
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
