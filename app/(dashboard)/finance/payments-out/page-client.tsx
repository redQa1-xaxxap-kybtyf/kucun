'use client';

import { DollarSign, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PaymentsOutClient } from '@/components/finance/payments-out-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  PAYMENT_OUT_SORT_OPTIONS,
  type PaymentOutMethod,
  type PaymentOutRecordDetail,
  type PaymentOutStatus,
} from '@/lib/types/payable';

type PaymentOutSortField = 'createdAt' | 'paymentAmount' | 'paymentDate';

interface PaymentsOutQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: PaymentOutStatus;
  paymentMethod?: PaymentOutMethod;
  sortBy?: PaymentOutSortField;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface ClientPaymentRecord {
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

interface PaymentsOutPageClientProps {
  initialData: {
    payments: PaymentOutRecordDetail[];
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
  initialParams: PaymentsOutQueryParams;
}

export function PaymentsOutPageClient({
  initialData,
  initialParams,
}: PaymentsOutPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const PAYMENT_STATUS_VALUES = React.useMemo<PaymentOutStatus[]>(
    () => ['pending', 'confirmed', 'cancelled'],
    []
  );
  const PAYMENT_METHOD_VALUES = React.useMemo<PaymentOutMethod[]>(
    () => ['cash', 'bank_transfer', 'check', 'other'],
    []
  );
  const paymentOutSortValues = React.useMemo(
    () => PAYMENT_OUT_SORT_OPTIONS.map(option => option.value),
    []
  );

  const isPaymentStatus = React.useCallback(
    (value?: string): value is PaymentOutStatus =>
      !!value && PAYMENT_STATUS_VALUES.includes(value as PaymentOutStatus),
    [PAYMENT_STATUS_VALUES]
  );

  const isPaymentMethod = React.useCallback(
    (value?: string): value is PaymentOutMethod =>
      !!value && PAYMENT_METHOD_VALUES.includes(value as PaymentOutMethod),
    [PAYMENT_METHOD_VALUES]
  );

  const isPaymentSortField = React.useCallback(
    (value?: string): value is PaymentOutSortField =>
      !!value && paymentOutSortValues.includes(value as PaymentOutSortField),
    [paymentOutSortValues]
  );

  const normalizedInitialParams = React.useMemo<PaymentsOutQueryParams>(() => {
    const next: PaymentsOutQueryParams = {
      page: initialParams.page || 1,
      limit: initialParams.limit || 20,
      search: initialParams.search || '',
      status: undefined,
      paymentMethod: undefined,
      sortBy: 'createdAt',
      sortOrder: initialParams.sortOrder === 'asc' ? 'asc' : 'desc',
      startDate: initialParams.startDate,
      endDate: initialParams.endDate,
    };

    if (isPaymentStatus(initialParams.status)) {
      next.status = initialParams.status;
    }

    if (isPaymentMethod(initialParams.paymentMethod)) {
      next.paymentMethod = initialParams.paymentMethod;
    }

    if (isPaymentSortField(initialParams.sortBy)) {
      next.sortBy = initialParams.sortBy;
    }

    return next;
  }, [
    initialParams.limit,
    initialParams.page,
    initialParams.paymentMethod,
    initialParams.search,
    initialParams.sortBy,
    initialParams.sortOrder,
    initialParams.startDate,
    initialParams.endDate,
    initialParams.status,
    isPaymentMethod,
    isPaymentSortField,
    isPaymentStatus,
  ]);

  const normalizeDate = (value: Date | string): string =>
    value instanceof Date ? value.toISOString() : value;

  const normalizedInitialData = React.useMemo(() => {
    const payments: ClientPaymentRecord[] = initialData.payments.map(
      payment => ({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        paymentAmount: payment.paymentAmount,
        paymentMethod: payment.paymentMethod,
        paymentDate: normalizeDate(payment.paymentDate),
        status: payment.status,
        remarks: payment.remarks ?? undefined,
        voucherNumber: payment.voucherNumber ?? undefined,
        payableRecord: payment.payableRecord
          ? {
              id: payment.payableRecord.id,
              payableNumber: payment.payableRecord.payableNumber,
              payableAmount: payment.payableRecord.payableAmount,
              remainingAmount: payment.payableRecord.remainingAmount,
            }
          : undefined,
        supplier: {
          id: payment.supplier.id,
          name: payment.supplier.name,
          phone: payment.supplier.phone ?? undefined,
        },
        user: {
          id: payment.user.id,
          name: payment.user.name,
        },
        createdAt: normalizeDate(payment.createdAt),
        updatedAt: normalizeDate(payment.updatedAt),
      })
    );

    return {
      payments,
      statistics: initialData.statistics,
      pagination: initialData.pagination,
    };
  }, [initialData]);

  const [search, setSearch] = React.useState(
    normalizedInitialParams.search || ''
  );
  const [status, setStatus] = React.useState<PaymentOutStatus | undefined>(
    normalizedInitialParams.status
  );
  const [paymentMethod, setPaymentMethod] = React.useState<
    PaymentOutMethod | undefined
  >(normalizedInitialParams.paymentMethod);
  const [sortBy, setSortBy] = React.useState<PaymentOutSortField>(
    normalizedInitialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    normalizedInitialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState<string | undefined>(
    normalizedInitialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    normalizedInitialParams.endDate
  );

  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: PaymentsOutQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.paymentMethod) {
          params.set('paymentMethod', filters.paymentMethod);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.startDate) {
          params.set('startDate', filters.startDate);
        }
        if (filters.endDate) {
          params.set('endDate', filters.endDate);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/finance/payments-out?${params.toString()}`);
      });
    },
    300
  );

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        page: 1,
        limit: normalizedInitialParams.limit,
        search: value || undefined,
        status,
        paymentMethod,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      normalizedInitialParams.limit,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      let nextStatus = status;
      let nextPaymentMethod = paymentMethod;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextLimit = normalizedInitialParams.limit;

      if (key === 'status') {
        nextStatus = isPaymentStatus(value) ? value : undefined;
        setStatus(nextStatus);
      } else if (key === 'paymentMethod') {
        nextPaymentMethod = isPaymentMethod(value) ? value : undefined;
        setPaymentMethod(nextPaymentMethod);
      } else if (key === 'sortBy') {
        nextSortBy = isPaymentSortField(value) ? value : 'createdAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = value === 'asc' ? 'asc' : 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'limit') {
        const parsed = value ? Number.parseInt(value, 10) : nextLimit;
        if (Number.isFinite(parsed) && parsed > 0) {
          nextLimit = parsed;
        }
      }

      debouncedUpdateURL(search, {
        page: 1,
        limit: nextLimit,
        search: search || undefined,
        status: nextStatus,
        paymentMethod: nextPaymentMethod,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      isPaymentMethod,
      isPaymentSortField,
      isPaymentStatus,
      normalizedInitialParams.limit,
      paymentMethod,
      search,
      sortBy,
      sortOrder,
      status,
      startDate,
      endDate,
    ]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
        }
        if (paymentMethod) {
          params.set('paymentMethod', paymentMethod);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (startDate) {
          params.set('startDate', startDate);
        }
        if (endDate) {
          params.set('endDate', endDate);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (normalizedInitialParams.limit) {
          params.set('limit', normalizedInitialParams.limit.toString());
        }

        router.push(`/finance/payments-out?${params.toString()}`);
      });
    },
    [
      router,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      normalizedInitialParams.limit,
      startDate,
      endDate,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextStart = range.startDate || undefined;
      const nextEnd = range.endDate || undefined;

      setStartDate(nextStart);
      setEndDate(nextEnd);

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
        }
        if (paymentMethod) {
          params.set('paymentMethod', paymentMethod);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (normalizedInitialParams.limit) {
          params.set('limit', normalizedInitialParams.limit.toString());
        }
        if (nextStart) {
          params.set('startDate', nextStart);
        }
        if (nextEnd) {
          params.set('endDate', nextEnd);
        }

        router.push(`/finance/payments-out?${params.toString()}`);
      });
    },
    [
      router,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      normalizedInitialParams.limit,
    ]
  );

  const currentParams = React.useMemo(
    () => ({
      ...normalizedInitialParams,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    }),
    [
      normalizedInitialParams,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    付款记录
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理采购订单的付款记录，跟踪付款状态和金额
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments-out/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments-out/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建付款
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户端交互组件 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <PaymentsOutClient
            initialData={normalizedInitialData}
            initialParams={currentParams}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
