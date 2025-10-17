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
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
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

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsOutClientProps {
  initialData: {
    payments: PaymentOutRecord[];
    statistics: {
      totalAmount: number;
      confirmedAmount: number;
      pendingAmount: number;
      recordCount: number;
      currentMonthConfirmedAmount?: number;
      previousMonthConfirmedAmount?: number;
      confirmedAmountChangePercent?: number | null;
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
    status?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待确认', variant: 'secondary' as const, icon: Clock },
    confirmed: {
      label: '已确认',
      variant: 'default' as const,
      icon: CheckCircle,
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
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
 * 付款方式显示组件
 */
function PaymentMethodBadge({ method }: { method: string }) {
  const methodLabels: Record<string, string> = {
    cash: '现金',
    bank_transfer: '银行转账',
    alipay: '支付宝',
    wechat: '微信',
    check: '支票',
    other: '其他',
  };

  return (
    <Badge variant="outline" className="gap-1">
      <Receipt className="h-3 w-3" />
      {methodLabels[method] || method}
    </Badge>
  );
}

/**
 * 付款记录客户端组件
 */
export function PaymentsOutClient({
  initialData,
  initialParams,
  onSearch,
  onFilter,
  onPageChange,
}: PaymentsOutClientProps) {
  const router = useRouter();
  const { payments, statistics, pagination } = initialData;

  const confirmedAmountChangeLabel = React.useMemo(() => {
    const change = statistics.confirmedAmountChangePercent;
    const current = statistics.currentMonthConfirmedAmount ?? 0;
    const previous = statistics.previousMonthConfirmedAmount ?? 0;

    if (typeof change !== 'number') {
      return current === 0 && previous === 0 ? '较上月持平' : '暂无上月数据';
    }

    const TOLERANCE = 0.1;
    if (Math.abs(change) < TOLERANCE) {
      return '较上月持平';
    }

    const value = Math.abs(change).toFixed(1);
    return change > 0 ? `较上月增长 ${value}%` : `较上月下降 ${value}%`;
  }, [
    statistics.confirmedAmountChangePercent,
    statistics.currentMonthConfirmedAmount,
    statistics.previousMonthConfirmedAmount,
  ]);

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总付款金额</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {formatCurrency(statistics.totalAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.recordCount} 条付款记录
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已确认金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(statistics.confirmedAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              {statistics.totalAmount > 0
                ? Math.round(
                    (statistics.confirmedAmount / statistics.totalAmount) * 100
                  )
                : 0}
              % 确认率
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
            <p className="text-muted-foreground text-xs">待财务确认</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月付款</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {formatCurrency(statistics.confirmedAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              {confirmedAmountChangeLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <UnifiedSearchBar
                searchValue={initialParams?.search ?? ''}
                onSearchChange={value => {
                  if (onSearch) {
                    onSearch(value);
                  }
                }}
                searchPlaceholder="搜索付款单号、供应商名称、凭证号..."
                className="max-w-sm"
              />

              <Select
                value={initialParams?.status || 'all'}
                onValueChange={value =>
                  onFilter?.('status', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={initialParams?.paymentMethod || 'all'}
                onValueChange={value =>
                  onFilter?.(
                    'paymentMethod',
                    value === 'all' ? undefined : value
                  )
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="付款方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="alipay">支付宝</SelectItem>
                  <SelectItem value="wechat">微信</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={initialParams?.sortBy || 'createdAt'}
                onValueChange={value => onFilter?.('sortBy', value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="paymentAmount">付款金额</SelectItem>
                  <SelectItem value="paymentDate">付款日期</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 付款记录列表 */}
          <div className="mt-6 space-y-4">
            {payments.length === 0 ? (
              <EmptyState
                icon={<DollarSign className="text-muted-foreground h-8 w-8" />}
                title="暂无付款记录"
                compact
              />
            ) : (
              payments.map(payment => (
                <Card
                  key={payment.id}
                  className="cursor-pointer transition-shadow hover:shadow-[var(--shadow-medium)]"
                  onClick={() => {
                    router.push(`/finance/payments-out/${payment.id}`);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(`/finance/payments-out/${payment.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">
                            {payment.paymentNumber}
                          </h3>
                          <StatusBadge status={payment.status} />
                          <PaymentMethodBadge method={payment.paymentMethod} />
                        </div>

                        <div className="text-muted-foreground space-y-1 text-sm">
                          <p>
                            <span className="font-medium">供应商：</span>
                            {payment.supplier.name}
                            {payment.supplier.phone && (
                              <span className="ml-2">
                                ({payment.supplier.phone})
                              </span>
                            )}
                          </p>

                          {payment.payableRecord && (
                            <p>
                              <span className="font-medium">关联应付款：</span>
                              {payment.payableRecord.payableNumber}
                              <span className="ml-2 text-[hsl(var(--color-warning))]">
                                剩余{' '}
                                {formatCurrency(
                                  payment.payableRecord.remainingAmount
                                )}
                              </span>
                            </p>
                          )}

                          <p>
                            <span className="font-medium">付款日期：</span>
                            {format(
                              new Date(payment.paymentDate),
                              'yyyy-MM-dd'
                            )}
                          </p>

                          {payment.voucherNumber && (
                            <p>
                              <span className="font-medium">凭证号：</span>
                              {payment.voucherNumber}
                            </p>
                          )}

                          {payment.remarks && (
                            <p>
                              <span className="font-medium">备注：</span>
                              {payment.remarks}
                            </p>
                          )}

                          <p className="text-xs">
                            <span className="font-medium">操作人：</span>
                            {payment.user.name} ·{' '}
                            {format(
                              new Date(payment.createdAt),
                              'yyyy-MM-dd HH:mm'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="ml-6 text-right">
                        <p className="text-muted-foreground mb-1 text-sm">
                          付款金额
                        </p>
                        <p className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                          {formatCurrency(payment.paymentAmount)}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/finance/payments-out/${payment.id}`}
                              onClick={event => event.stopPropagation()}
                            >
                              查看详情
                            </Link>
                          </Button>
                          {payment.status === 'pending' && (
                            <Button size="sm" asChild>
                              <Link
                                href={`/finance/payments-out/${payment.id}/edit`}
                                onClick={event => event.stopPropagation()}
                              >
                                编辑
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                pagination={{
                  page: pagination.page,
                  limit: pagination.limit,
                  total: pagination.total,
                  totalPages: pagination.totalPages,
                }}
                onPageChange={page => {
                  if (onPageChange) {
                    onPageChange(page);
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
