'use client';

import { Download, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { FinanceListSkeleton } from '@/components/ui/skeleton-compositions';
import { useFinanceExport } from '@/hooks/use-finance-export';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  PAYMENT_OUT_SORT_OPTIONS,
  type PaymentOutMethod,
  type PaymentOutRecordDetail,
  type PaymentOutStatus,
} from '@/lib/types/payable';

type PaymentOutSortField = 'createdAt' | 'paymentAmount' | 'paymentDate';

const PaymentsOutClient = dynamic(
  () =>
    import('@/components/finance/payments-out-client').then(
      mod => mod.PaymentsOutClient
    ),
  {
    ssr: false,
    loading: () => <FinanceListSkeleton />,
  }
);

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

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

export function PaymentsOutPageClient({
  initialData,
  initialParams,
}: PaymentsOutPageClientProps) {
  const router = useRouter();
  const { exportData, isExporting } = useFinanceExport();

  const PAYMENT_STATUS_VALUES = React.useMemo<PaymentOutStatus[]>(
    () => ['pending', 'confirmed', 'cancelled'],
    []
  );
  const PAYMENT_METHOD_VALUES = React.useMemo<PaymentOutMethod[]>(
    () => ['cash', 'bank_transfer', 'alipay', 'wechat', 'check', 'other'],
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
        actualPaymentAmount: payment.actualPaymentAmount,
        roundingAmount: payment.roundingAmount,
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

  const [committedSearch, setCommittedSearch] = React.useState(
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
  const [page, setPage] = React.useState(normalizedInitialParams.page);
  const [limit, setLimit] = React.useState(normalizedInitialParams.limit);
  const [startDate, setStartDate] = React.useState<string | undefined>(
    normalizedInitialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    normalizedInitialParams.endDate
  );

  React.useEffect(() => {
    setCommittedSearch(normalizedInitialParams.search || '');
    setStatus(normalizedInitialParams.status);
    setPaymentMethod(normalizedInitialParams.paymentMethod);
    setSortBy(normalizedInitialParams.sortBy || 'createdAt');
    setSortOrder(normalizedInitialParams.sortOrder || 'desc');
    setPage(normalizedInitialParams.page);
    setLimit(normalizedInitialParams.limit);
    setStartDate(normalizedInitialParams.startDate);
    setEndDate(normalizedInitialParams.endDate);
  }, [normalizedInitialParams]);

  const currentParams = React.useMemo(
    () => ({
      ...normalizedInitialParams,
      search: normalizeSearch(committedSearch),
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      page,
      limit,
      startDate,
      endDate,
    }),
    [
      committedSearch,
      endDate,
      limit,
      normalizedInitialParams,
      page,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      status,
    ]
  );

  const syncUrl = React.useCallback(
    (filters: PaymentsOutQueryParams) => {
      const params = new URLSearchParams();
      const normalizedSearch = normalizeSearch(filters.search);

      if (normalizedSearch) {
        params.set('search', normalizedSearch);
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

      const queryString = params.toString();
      router.replace(
        queryString
          ? `/finance/payments-out?${queryString}`
          : '/finance/payments-out',
        { scroll: false }
      );
    },
    [router]
  );

  const buildFilters = React.useCallback(
    (
      overrides: Partial<PaymentsOutQueryParams> = {}
    ): PaymentsOutQueryParams => ({
      ...normalizedInitialParams,
      search: overrides.search ?? normalizeSearch(committedSearch),
      status: overrides.status ?? status,
      paymentMethod: overrides.paymentMethod ?? paymentMethod,
      sortBy: overrides.sortBy ?? sortBy,
      sortOrder: overrides.sortOrder ?? sortOrder,
      page: overrides.page ?? page,
      limit: overrides.limit ?? limit,
      startDate: overrides.startDate ?? startDate,
      endDate: overrides.endDate ?? endDate,
    }),
    [
      committedSearch,
      endDate,
      limit,
      normalizedInitialParams,
      page,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      status,
    ]
  );

  const {
    searchInput,
    isSearching: isSearchPending,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: committedSearch,
    onCommit: search => {
      const nextSearch = search ?? '';
      setCommittedSearch(nextSearch);
      setPage(1);
      syncUrl(
        buildFilters({
          search,
          page: 1,
        })
      );
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = syncPendingSearch();
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

      setPage(1);
      setLimit(nextLimit);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page: 1,
          limit: nextLimit,
          status: nextStatus,
          paymentMethod: nextPaymentMethod,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
        })
      );
    },
    [
      buildFilters,
      isPaymentMethod,
      isPaymentSortField,
      isPaymentStatus,
      normalizedInitialParams.limit,
      paymentMethod,
      sortBy,
      sortOrder,
      status,
      syncPendingSearch,
      syncUrl,
    ]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      setPage(page);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page,
        })
      );
    },
    [buildFilters, syncPendingSearch, syncUrl]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextSearch = syncPendingSearch();
      const nextStart = range.startDate || undefined;
      const nextEnd = range.endDate || undefined;

      setStartDate(nextStart);
      setEndDate(nextEnd);
      setPage(1);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page: 1,
          startDate: nextStart,
          endDate: nextEnd,
        })
      );
    },
    [buildFilters, syncPendingSearch, syncUrl]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setStatus(undefined);
    setPaymentMethod(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setLimit(normalizedInitialParams.limit);
    setStartDate(undefined);
    setEndDate(undefined);
    router.replace('/finance/payments-out', { scroll: false });
  }, [
    cancelPendingCommit,
    normalizedInitialParams.limit,
    router,
    setSearchInput,
  ]);

  const handleExport = React.useCallback(() => {
    // 导出使用当前筛选条件，一次性导出最多 50,000 条记录
    const filters: PaymentsOutQueryParams = {
      page: 1,
      limit: 50000,
      search: normalizeSearch(searchInput),
      status,
      paymentMethod,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      startDate,
      endDate,
    };

    exportData('/api/finance/payments-out/export', {
      format: 'excel',
      // 导出接口接收通用的 Record<string, unknown>，这里显式转换类型
      filters: filters as unknown as Record<string, unknown>,
    });
  }, [
    exportData,
    searchInput,
    status,
    paymentMethod,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  ]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="付款管理"
          description="查看待确认与已完成付款，方便核对供应商结算。"
          icon={<ChineseYuan className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={handleExport}
                disabled={isExporting}
                className="h-11 rounded-lg"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? '导出中...' : '导出'}
              </Button>
              <Button size="lg" asChild className="h-11 rounded-lg">
                <Link href="/finance/payments-out/create">
                  <Plus className="mr-2 h-4 w-4" />
                  登记付款
                </Link>
              </Button>
            </>
          }
        />

        {/* 客户端交互组件 */}
        <Suspense fallback={<FinanceListSkeleton />}>
          <PaymentsOutClient
            initialData={normalizedInitialData}
            initialParams={currentParams}
            searchValue={searchInput}
            isSearching={isSearchPending}
            onSearch={handleSearchChange}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
            onClearFilters={handleClearFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}
