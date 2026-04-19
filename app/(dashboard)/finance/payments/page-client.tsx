'use client';

import { Download, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { FinanceListSkeleton } from '@/components/ui/skeleton-compositions';
import { useFinanceExport } from '@/hooks/use-finance-export';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import type { PaymentStatus } from '@/lib/types/payment';

const PaymentsClient = dynamic(
  () =>
    import('@/components/finance/payments-client').then(
      mod => mod.PaymentsClient
    ),
  {
    ssr: false,
    loading: () => <FinanceListSkeleton />,
  }
);

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

interface PaymentsQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: PaymentStatus;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  includeTest?: boolean;
  includeVoided?: boolean;
}

interface PaymentsPageClientProps {
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
  initialParams: PaymentsQueryParams;
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

/**
 * 收款记录页面客户端组件
 * 负责用户交互和状态管理
 */
export function PaymentsPageClient({
  initialData,
  initialParams,
}: PaymentsPageClientProps) {
  const router = useRouter();
  const { exportData, isExporting } = useFinanceExport();

  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search || ''
  );
  const [status, setStatus] = React.useState<PaymentStatus | undefined>(
    initialParams.status
  );
  const [paymentMethod, setPaymentMethod] = React.useState(
    initialParams.paymentMethod
  );
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [page, setPage] = React.useState(initialParams.page);
  const [limit, setLimit] = React.useState(initialParams.limit);
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );
  const [includeTest, setIncludeTest] = React.useState<boolean>(
    !!initialParams.includeTest
  );
  const [includeVoided, setIncludeVoided] = React.useState<boolean>(
    !!initialParams.includeVoided
  );
  React.useEffect(() => {
    setCommittedSearch(initialParams.search || '');
    setStatus(initialParams.status);
    setPaymentMethod(initialParams.paymentMethod);
    setSortBy(initialParams.sortBy || 'createdAt');
    setSortOrder(initialParams.sortOrder || 'desc');
    setPage(initialParams.page);
    setLimit(initialParams.limit);
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
    setIncludeTest(!!initialParams.includeTest);
    setIncludeVoided(!!initialParams.includeVoided);
  }, [initialParams]);

  const currentParams = React.useMemo(
    () => ({
      ...initialParams,
      search: normalizeSearch(committedSearch),
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      page,
      limit,
      startDate,
      endDate,
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
    }),
    [
      committedSearch,
      endDate,
      includeTest,
      includeVoided,
      initialParams,
      limit,
      page,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      status,
    ]
  );

  const syncUrl = React.useCallback(
    (filters: PaymentsQueryParams) => {
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
      if (filters.includeTest) {
        params.set('includeTest', 'true');
      }
      if (filters.includeVoided) {
        params.set('includeVoided', 'true');
      }
      if (filters.page && filters.page > 1) {
        params.set('page', filters.page.toString());
      }
      if (filters.limit) {
        params.set('limit', filters.limit.toString());
      }

      const queryString = params.toString();
      router.replace(
        queryString ? `/finance/payments?${queryString}` : '/finance/payments',
        { scroll: false }
      );
    },
    [router]
  );

  const buildFilters = React.useCallback(
    (overrides: Partial<PaymentsQueryParams> = {}): PaymentsQueryParams => ({
      ...initialParams,
      search: overrides.search ?? normalizeSearch(committedSearch),
      status: overrides.status ?? status,
      paymentMethod: overrides.paymentMethod ?? paymentMethod,
      sortBy: overrides.sortBy ?? sortBy,
      sortOrder: overrides.sortOrder ?? sortOrder,
      page: overrides.page ?? page,
      limit: overrides.limit ?? limit,
      startDate: overrides.startDate ?? startDate,
      endDate: overrides.endDate ?? endDate,
      includeTest: overrides.includeTest ?? (includeTest || undefined),
      includeVoided: overrides.includeVoided ?? (includeVoided || undefined),
    }),
    [
      committedSearch,
      endDate,
      includeTest,
      includeVoided,
      initialParams,
      limit,
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

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = syncPendingSearch();
      let nextStatus = status;
      let nextPaymentMethod = paymentMethod;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextIncludeTest = includeTest;
      let nextIncludeVoided = includeVoided;

      if (key === 'status') {
        nextStatus =
          value && value !== 'all' ? (value as PaymentStatus) : undefined;
        setStatus(nextStatus);
      } else if (key === 'paymentMethod') {
        nextPaymentMethod = value;
        setPaymentMethod(value);
      } else if (key === 'sortBy') {
        nextSortBy = value || 'createdAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = (value as 'asc' | 'desc') || 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'includeTest') {
        nextIncludeTest = value === 'true';
        setIncludeTest(nextIncludeTest);
      } else if (key === 'includeVoided') {
        nextIncludeVoided = value === 'true';
        setIncludeVoided(nextIncludeVoided);
      }

      setPage(1);
      syncUrl(
        buildFilters({
          search: nextSearch,
          status: nextStatus,
          paymentMethod: nextPaymentMethod,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          includeTest: nextIncludeTest || undefined,
          includeVoided: nextIncludeVoided || undefined,
          page: 1,
        })
      );
    },
    [
      buildFilters,
      syncPendingSearch,
      syncUrl,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      includeTest,
      includeVoided,
    ]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      setPage(page);
      setLimit(initialParams.limit);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page,
          limit: initialParams.limit,
        })
      );
    },
    [
      buildFilters,
      initialParams.limit,
      syncPendingSearch,
      syncUrl,
    ]
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
          startDate: nextStart,
          endDate: nextEnd,
          page: 1,
          limit: initialParams.limit,
        })
      );
    },
    [
      buildFilters,
      initialParams.limit,
      syncPendingSearch,
      syncUrl,
    ]
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
    setStartDate(undefined);
    setEndDate(undefined);
    setIncludeTest(false);
    setIncludeVoided(false);
    router.replace('/finance/payments', { scroll: false });
  }, [cancelPendingCommit, router, setSearchInput]);

  const handleRefresh = React.useCallback(() => {
    cancelPendingCommit();
    router.refresh();
  }, [cancelPendingCommit, router]);

  const handleExport = React.useCallback(() => {
    const filters: PaymentsQueryParams = {
      page: 1,
      limit: 50000,
      search: normalizeSearch(searchInput),
      status,
      paymentMethod,
      sortBy: sortBy || 'createdAt',
      sortOrder,
      startDate,
      endDate,
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
    };

    exportData('/api/finance/payments/export', {
      format: 'excel',
      filters: filters as unknown as Record<string, unknown>,
    });
  }, [
    endDate,
    exportData,
    includeTest,
    includeVoided,
    paymentMethod,
    searchInput,
    sortBy,
    sortOrder,
    startDate,
    status,
  ]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] shadow-lg shadow-green-600/30 sm:h-12 sm:w-12">
                  <ChineseYuan className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    收款管理
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    查看待确认与已到账收款，方便快速核对
                  </p>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:[&>*]:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="h-11 w-full shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出'}
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 w-full shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments/create">
                    <Plus className="mr-2 h-4 w-4" />
                    登记收款
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户端交互组件 */}
        <Suspense fallback={<FinanceListSkeleton />}>
          <PaymentsClient
            initialData={initialData}
            initialParams={currentParams}
            searchValue={searchInput}
            isSearching={isSearchPending}
            onSearch={handleSearchChange}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
            onRefresh={handleRefresh}
            onClearFilters={handleClearFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}
