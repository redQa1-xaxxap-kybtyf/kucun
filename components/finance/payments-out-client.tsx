'use client';

import { CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatCurrency } from '@/lib/utils/format';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

import { PaymentsOutTableList } from './payments-out-table-list';

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
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
    startDate?: string;
    endDate?: string;
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  isSearching?: boolean;
  onClearFilters?: () => void;
}

function useConfirmedAmountChange(statistics: {
  totalAmount: number;
  confirmedAmount: number;
  currentMonthConfirmedAmount?: number;
  previousMonthConfirmedAmount?: number;
  confirmedAmountChangePercent?: number | null;
}) {
  const displayedConfirmedAmount =
    typeof statistics.currentMonthConfirmedAmount === 'number'
      ? statistics.currentMonthConfirmedAmount
      : statistics.confirmedAmount;

  const hasPreviousMonthData =
    typeof statistics.previousMonthConfirmedAmount === 'number';

  const confirmedAmountChangeLabel = React.useMemo(() => {
    const change =
      typeof statistics.confirmedAmountChangePercent === 'number'
        ? statistics.confirmedAmountChangePercent
        : null;

    if (!hasPreviousMonthData || change === null) {
      return '暂无上月数据';
    }

    const tolerance = 0.1;
    if (Math.abs(change) < tolerance) {
      return '较上月持平';
    }

    const value = Math.abs(change).toFixed(1);
    return change > 0 ? `较上月增长 ${value}%` : `较上月下降 ${value}%`;
  }, [hasPreviousMonthData, statistics.confirmedAmountChangePercent]);

  return { displayedConfirmedAmount, confirmedAmountChangeLabel };
}

function PaymentOutStatisticsCards({
  statistics,
  displayedConfirmedAmount,
  confirmedAmountChangeLabel,
}: {
  statistics: PaymentsOutClientProps['initialData']['statistics'];
  displayedConfirmedAmount: number;
  confirmedAmountChangeLabel: string;
}) {
  const confirmedRate =
    statistics.totalAmount > 0
      ? ((statistics.confirmedAmount / statistics.totalAmount) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总付款金额</CardTitle>
          <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
            {formatCurrency(statistics.totalAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            {statistics.recordCount} 笔付款
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已完成付款</CardTitle>
          <CheckCircle className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
            {formatCurrency(statistics.confirmedAmount)}
          </div>
          <p className="text-muted-foreground text-xs">完成率 {confirmedRate}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">待确认付款</CardTitle>
          <Clock className="h-4 w-4 text-[hsl(var(--color-warning))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
            {formatCurrency(statistics.pendingAmount)}
          </div>
          <p className="text-muted-foreground text-xs">需要尽快确认完成</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">本月已完成付款</CardTitle>
          <TrendingUp className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
            {formatCurrency(displayedConfirmedAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            {confirmedAmountChangeLabel}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function usePaymentOutActions({
  onSearch,
}: {
  onSearch?: (value: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] =
    React.useState<PaymentOutRecord | null>(null);
  const [voidingPayment, setVoidingPayment] =
    React.useState<PaymentOutRecord | null>(null);
  const [voidReason, setVoidReason] = React.useState('');
  const [isVoiding, setIsVoiding] = React.useState(false);

  const handleSearchChange = React.useCallback(
    (value: string, setSearchValue: (value: string) => void) => {
      setSearchValue(value);
      onSearch?.(value);
    },
    [onSearch]
  );

  const handleConfirm = React.useCallback(
    async (paymentId: string) => {
      if (isConfirming) return;

      setIsConfirming(true);
      setConfirmingId(paymentId);
      try {
        const response = await fetch(
          `/api/finance/payments-out/${paymentId}`,
          getCsrfTokenHeader({
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'confirmed',
              idempotencyKey: crypto.randomUUID(),
            }),
          })
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || '确认付款失败');
        }

        toast({
          title: '付款已完成',
          description: '这笔付款已经确认完成。',
          variant: 'success',
        });

        router.refresh();
        return true;
      } catch (error) {
        toast({
          title: '确认失败',
          description: getFriendlyErrorMessage(
            error,
            '这笔付款暂时无法确认，请稍后重试'
          ),
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsConfirming(false);
        setConfirmingId(null);
      }
    },
    [isConfirming, router, toast]
  );

  const handleVoidRequest = React.useCallback(
    (payment: PaymentOutRecord) => {
      if (isVoiding) return;
      setVoidingPayment(payment);
      setVoidReason('');
    },
    [isVoiding]
  );

  const handleVoidConfirm = React.useCallback(async () => {
    if (!voidingPayment || isVoiding) return;

    setIsVoiding(true);
    try {
      const trimmedReason = voidReason.trim().slice(0, 64);
      const payload: Record<string, unknown> = {
        idempotencyKey: crypto.randomUUID(),
        ...(trimmedReason ? { voidReason: trimmedReason } : {}),
      };

      const response = await fetch(
        `/api/finance/payments-out/${voidingPayment.id}`,
        getCsrfTokenHeader({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || '作废付款失败');
      }

      toast({
        title: '付款已作废',
        description: data.message || '这笔付款已作废',
        variant: 'success',
      });

      setVoidingPayment(null);
      router.refresh();
    } catch (error) {
      toast({
        title: '作废失败',
        description: getFriendlyErrorMessage(
          error,
          '这笔付款暂时无法作废，请稍后重试'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsVoiding(false);
    }
  }, [isVoiding, router, toast, voidReason, voidingPayment]);

  const handleConfirmRequest = React.useCallback(
    (payment: PaymentOutRecord) => {
      if (isConfirming || isVoiding) {
        return;
      }

      setConfirmingPayment(payment);
    },
    [isConfirming, isVoiding]
  );

  const handleConfirmSubmit = React.useCallback(async () => {
    if (!confirmingPayment) {
      return;
    }

    const confirmed = await handleConfirm(confirmingPayment.id);
    if (confirmed) {
      setConfirmingPayment(null);
    }
  }, [confirmingPayment, handleConfirm]);

  return {
    confirmingPayment,
    confirmingId,
    handleConfirm,
    handleConfirmRequest,
    handleConfirmSubmit,
    handleSearchChange,
    handleVoidConfirm,
    handleVoidRequest,
    isConfirming,
    isVoiding,
    setConfirmingPayment,
    setVoidReason,
    setVoidingPayment,
    voidReason,
    voidingPayment,
  };
}

function PaymentsOutFilters({
  searchValue,
  initialParams,
  onSearchChange,
  onFilterChange,
  onDateRangeChange,
  isSearching = false,
  onClearFilters,
}: {
  searchValue: string;
  initialParams?: PaymentsOutClientProps['initialParams'];
  onSearchChange: (value: string) => void;
  onFilterChange?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  isSearching?: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <div className="relative z-10">
      <SearchFilterCard
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder="搜索付款单号、供应商名称或联系人"
        isSearching={isSearching}
        variant="bordered"
        compact={true}
        filters={[
          {
            key: 'status',
            label: '状态',
            options: [
              { label: '待确认付款', value: 'pending' },
              { label: '已完成付款', value: 'confirmed' },
              { label: '已作废', value: 'cancelled' },
            ],
            width: 'w-[140px]',
          },
          {
            key: 'paymentMethod',
            label: '付款方式',
            options: [
              { label: '现金', value: 'cash' },
              { label: '银行转账', value: 'bank_transfer' },
              { label: '支付宝', value: 'alipay' },
              { label: '微信', value: 'wechat' },
              { label: '支票', value: 'check' },
              { label: '其他', value: 'other' },
            ],
            width: 'w-[160px]',
          },
        ]}
        filterValues={{
          status: initialParams?.status || 'all',
          paymentMethod: initialParams?.paymentMethod || 'all',
        }}
        onFilterChange={onFilterChange}
        dateRangeFilter={
          onDateRangeChange
            ? {
                key: 'dateRange',
                label: '付款日期',
                value: {
                  startDate: initialParams?.startDate,
                  endDate: initialParams?.endDate,
                },
                onChange: onDateRangeChange,
                placeholder: '选择付款日期范围',
              }
            : undefined
        }
        onClearFilters={onClearFilters}
      />
    </div>
  );
}

function VoidPaymentDialog({
  payment,
  voidReason,
  isVoiding,
  onReasonChange,
  onConfirm,
  onOpenChange,
}: {
  payment: PaymentOutRecord | null;
  voidReason: string;
  isVoiding: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认作废这笔付款？</AlertDialogTitle>
          <AlertDialogDescription>
            {payment ? (
              <>
                将作废付款单 <strong>{payment.paymentNumber}</strong>。
                <br />
                作废后，会把对应应付单的待付金额加回去，并保留这次作废记录。
              </>
            ) : (
              '确认作废这笔付款吗？'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">作废说明（可选）</div>
          <Textarea
            value={voidReason}
            onChange={e => onReasonChange(e.target.value)}
            placeholder="例如：金额录错 / 重复付款 / 改为其他付款方式（最多64字）"
            disabled={isVoiding}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isVoiding}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isVoiding}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isVoiding ? '正在作废...' : '确认作废'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmPaymentDialog({
  payment,
  isConfirming,
  onConfirm,
  onOpenChange,
}: {
  payment: PaymentOutRecord | null;
  isConfirming: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认这笔付款已经完成？</AlertDialogTitle>
          <AlertDialogDescription>
            {payment ? (
              <>
                将把付款单 <strong>{payment.paymentNumber}</strong> 记为已完成。
                <br />
                确认后，这笔付款会记入已付款，对应应付单的待付金额也会减少。
              </>
            ) : (
              '确认当前付款已经完成。'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>
            我再核对一下
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? '确认中...' : '确认付款完成'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PaymentsOutClient({
  initialData,
  initialParams,
  onSearch: _onSearch,
  onFilter: _onFilter,
  onDateRangeChange: _onDateRangeChange,
  onPageChange,
  searchValue: controlledSearchValue,
  isSearching = false,
  onClearFilters,
}: PaymentsOutClientProps) {
  const [localSearchValue, setLocalSearchValue] = React.useState(
    initialParams?.search ?? ''
  );

  React.useEffect(() => {
    setLocalSearchValue(initialParams?.search ?? '');
  }, [initialParams?.search]);
  const effectiveSearchValue = controlledSearchValue ?? localSearchValue;
  const { payments, statistics, pagination } = initialData;
  const { displayedConfirmedAmount, confirmedAmountChangeLabel } =
    useConfirmedAmountChange(statistics);
  const {
    confirmingPayment,
    confirmingId,
    handleConfirmRequest,
    handleConfirmSubmit,
    handleSearchChange,
    handleVoidConfirm,
    handleVoidRequest,
    isConfirming,
    isVoiding,
    setConfirmingPayment,
    setVoidReason,
    setVoidingPayment,
    voidReason,
    voidingPayment,
  } = usePaymentOutActions({ onSearch: _onSearch });

  return (
    <div className="space-y-4">
      <PaymentOutStatisticsCards
        statistics={statistics}
        displayedConfirmedAmount={displayedConfirmedAmount}
        confirmedAmountChangeLabel={confirmedAmountChangeLabel}
      />

      <PaymentsOutFilters
        searchValue={effectiveSearchValue}
        initialParams={initialParams}
        onSearchChange={value =>
          handleSearchChange(
            value,
            controlledSearchValue === undefined ? setLocalSearchValue : () => {}
          )
        }
        onFilterChange={_onFilter}
        onDateRangeChange={_onDateRangeChange}
        isSearching={isSearching}
        onClearFilters={onClearFilters}
      />

      {/* 付款记录列表 */}
      <div className="animate-in fade-in slide-in-from-bottom-4 mt-6 duration-700">
        <PaymentsOutTableList
          payments={payments}
          pagination={pagination}
          onPageChange={onPageChange}
          onConfirm={paymentId => {
            const payment = payments.find(item => item.id === paymentId);
            if (payment) {
              handleConfirmRequest(payment);
            }
          }}
          onVoid={handleVoidRequest}
          confirmingId={confirmingId}
          isConfirming={isConfirming}
          isVoiding={isVoiding}
        />
      </div>

      <ConfirmPaymentDialog
        payment={confirmingPayment}
        isConfirming={isConfirming}
        onConfirm={handleConfirmSubmit}
        onOpenChange={open => {
          if (!open) {
            setConfirmingPayment(null);
          }
        }}
      />

      <VoidPaymentDialog
        payment={voidingPayment}
        voidReason={voidReason}
        isVoiding={isVoiding}
        onReasonChange={setVoidReason}
        onConfirm={handleVoidConfirm}
        onOpenChange={open => {
          if (!open) {
            setVoidingPayment(null);
          }
        }}
      />
    </div>
  );
}
